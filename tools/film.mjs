// node tools/film.mjs <page.html> sheet <t,t,...> <cols> <out.png> [--dpr 0.6]
// node tools/film.mjs <page.html> video <out.mp4> [--dpr 2.4] [--from 0] [--to <duration>] [--fps 60]
// Steps window.SIM.render(t) frame by frame in Chrome on the real GPU (ANGLE/GL, as tools/still.mjs; the kit's
// capture.mjs falls back to SwiftShader here) and screenshots the whole page (the 3D view and the page around it).
// video: PNG frames piped into ffmpeg, downscaled to 1920x1080 with lanczos, H.264 yuv420p, faststart.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const req = createRequire(process.env.HOME + '/.claude/skills/cutaway/node_modules/x.js');
const {chromium} = req('playwright');
const argv = process.argv.slice(2);
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const [html, mode, a, b, c] = argv;
const dpr = Number(opt('dpr', mode === 'video' ? 2.4 : 0.6));
const br = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--hide-scrollbars']});
const p = await br.newPage({viewport: {width: 1600, height: 900}, deviceScaleFactor: dpr});
p.on('pageerror', (e) => console.log('[err]', e.message));
await p.addInitScript(() => { window.__CAPTURE = true; });
await p.goto(pathToFileURL(html).href);
await p.waitForFunction(() => window.SIM && window.SIM.ready, null, {timeout: 600000});
await p.evaluate(() => document.fonts.ready);
const shot = async (t) => {
  await p.evaluate((x) => window.SIM.render(x), t);
  return p.screenshot({type: 'png', timeout: 300000});
};
const t0 = Date.now();
if (mode === 'sheet') {
  const times = a.split(',').map(Number);
  const cols = Number(b);
  const dir = fs.mkdtempSync((process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp/' : '/tmp/') + 'sheet-');
  const files = [];
  for (const t of times) {
    const f = `${dir}/t${t.toFixed(2)}.png`;
    fs.writeFileSync(f, await shot(t));
    files.push(f);
  }
  // tile with ffmpeg's xstack via python/PIL is simpler: hand the list to a tiny PIL script
  const py = spawn('python3', ['-I', '-c', `
import sys
from PIL import Image, ImageDraw
files, cols, out = sys.argv[1].split(','), int(sys.argv[2]), sys.argv[3]
ims = [Image.open(f).convert('RGB') for f in files]
w, h = ims[0].size
rows = (len(ims) + cols - 1) // cols
s = Image.new('RGB', (w * cols, h * rows), 'white')
d = ImageDraw.Draw(s)
for i, (im, f) in enumerate(zip(ims, files)):
    x, y = (i % cols) * w, (i // cols) * h
    s.paste(im, (x, y))
    d.rectangle([x, y, x + 74, y + 20], fill='black')
    d.text((x + 4, y + 4), 't=' + f.split('/t')[-1][:-4], fill='white')
s.save(out)
`, files.join(','), String(cols), c], {stdio: 'inherit'});
  await new Promise((r) => py.on('close', r));
  console.log('→', c);
} else if (mode === 'frames') {
  // frames <dir>: every frame as a PNG, captured at the dpr and brought down to 1920x1080 with lanczos (PIL), for an
  // ffmpeg-less machine; encode later with tools/encode.sh
  const fps = Number(opt('fps', 60));
  const dur = await p.evaluate(() => window.SIM.duration);
  const n = Math.round(dur * fps);
  fs.mkdirSync(a, {recursive: true});
  const py = spawn('python3', ['-I', '-u', '-c', `
import sys
from PIL import Image
for line in sys.stdin:
    src, dst = line.rstrip('\\n').split('\\t')
    Image.open(src).convert('RGB').resize((1920, 1080), Image.LANCZOS).save(dst, compress_level=3)
    print('ok', flush=True)
`], {stdio: ['pipe', 'pipe', 'inherit']});
  let done = 0;
  py.stdout.on('data', (d) => (done += String(d).split('ok').length - 1));
  const tmp = fs.mkdtempSync((process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + '/tmp/' : '/tmp/') + 'raw-');
  const from = Number(opt('from', 0));
  for (let i = Math.round(from * fps); i < n; i++) {
    const dst = `${a}/f${String(i).padStart(5, '0')}.png`;
    if (fs.existsSync(dst)) continue;
    const raw = `${tmp}/r${i % 8}.png`;
    // keep at most 8 raw frames in flight
    while (i - Math.round(from * fps) - done >= 8) await new Promise((r) => setTimeout(r, 20));
    fs.writeFileSync(raw.replace('.png', `_${i}.png`), await shot(i / fps));
    py.stdin.write(`${raw.replace('.png', `_${i}.png`)}\t${dst}\n`);
    if (i % 60 === 0) console.log(`frame ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  py.stdin.end();
  await new Promise((r) => py.on('close', r));
  fs.rmSync(tmp, {recursive: true, force: true});
  console.log('→', a);
} else {
  const fps = Number(opt('fps', 60));
  const dur = await p.evaluate(() => window.SIM.duration);
  const from = Number(opt('from', 0));
  const to = Number(opt('to', dur));
  const n = Math.round((to - from) * fps);
  const ff = spawn(process.env.FFMPEG || 'ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-', '-vf', 'scale=1920:1080:flags=lanczos', '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', a], {stdio: ['pipe', 'inherit', 'inherit']});
  for (let i = 0; i < n; i++) {
    const buf = await shot(from + i / fps);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 60 === 0) console.log(`frame ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log('→', a);
}
console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s`);
await br.close();

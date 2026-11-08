// open a built page headless, print console output, GPU and how long until window.SIM.ready
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const req = createRequire(process.env.HOME + '/.claude/skills/cutaway/node_modules/x.js');
const {chromium} = req('playwright');
const b = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-webgl', '--hide-scrollbars']});
const p = await b.newPage({viewport: {width: 1600, height: 900}});
p.on('console', (m) => console.log('[c]', m.type(), m.text().slice(0, 300)));
p.on('pageerror', (e) => console.log('[err]', e.message));
await p.addInitScript(() => { window.__CAPTURE = true; });
const t0 = Date.now();
await p.goto(pathToFileURL(process.argv[2]).href);
for (let i = 0; i < 120; i++) {
  const r = await p.evaluate(() => [!!(window.SIM && window.SIM.ready), window.WATCH ? window.WATCH.small : null]).catch((e) => ['eval', e.message]);
  if (r[0]) { console.log('ready', (Date.now() - t0) / 1000, 's small parts', r[1]); break; }
  await new Promise((r) => setTimeout(r, 1000));
}
const gpu = await p.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl2'); const e = gl && gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'none'; });
console.log('gpu', gpu);
await b.close();

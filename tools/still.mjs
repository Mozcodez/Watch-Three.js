// node tools/still.mjs <page.html> <out.png> [t=0] [config.json] [--dpr 1]
// Renders window.SIM.render(t) in headless Chrome on the real GPU (ANGLE/GL) and screenshots it at 1600x900.
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const req = createRequire(process.env.HOME + '/.claude/skills/cutaway/node_modules/x.js');
const {chromium} = req('playwright');
const [html, out, t = '0', cfgFile] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const di = process.argv.indexOf('--dpr');
const dpr = di > 0 ? Number(process.argv[di + 1]) : 1;
const cfg = cfgFile && cfgFile !== '-' ? JSON.parse(fs.readFileSync(cfgFile, 'utf8')) : {};
const b = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--hide-scrollbars']});
const p = await b.newPage({viewport: {width: 1600, height: 900}, deviceScaleFactor: dpr});
p.on('pageerror', (e) => console.log('[err]', e.message));
p.on('console', (m) => m.type() === 'error' && console.log('[c]', m.text().slice(0, 300)));
await p.addInitScript((c) => { window.__CAPTURE = true; window.__SIM_CONFIG = c; }, cfg);
const t0 = Date.now();
await p.goto(pathToFileURL(html).href);
await p.waitForFunction(() => window.SIM && window.SIM.ready, null, {timeout: 600000});
for (const tt of t.split(',')) {
  await p.evaluate((x) => window.SIM.render(x), Number(tt));
  const o = t.includes(',') ? out.replace('.png', `-t${tt}.png`) : out;
  await p.screenshot({path: o});
  console.log('→', o);
}
console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s`, await p.evaluate(() => window.WATCH ? 'small parts ' + window.WATCH.small : ''));
await b.close();

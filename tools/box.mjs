import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const req = createRequire(process.env.HOME + '/.claude/skills/cutaway/node_modules/x.js');
const {chromium} = req('playwright');
const b = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--use-angle=gl', '--ignore-gpu-blocklist']});
const p = await b.newPage({viewport: {width: 1600, height: 900}});
await p.addInitScript(() => { window.__CAPTURE = true; window.__SIM_CONFIG = {}; });
await p.goto(pathToFileURL(process.argv[2]).href);
await p.waitForFunction(() => window.SIM && window.SIM.ready, null, {timeout: 600000});
console.log(await p.evaluate(() => {
  const {w, box} = window.WATCH;
  const out = [JSON.stringify(box)];
  const B = box.constructor;
  for (const c of w.root.children) out.push(c.name + ' ' + JSON.stringify(new B().setFromObject(c)));
  return out.join('\n');
}));
await b.close();

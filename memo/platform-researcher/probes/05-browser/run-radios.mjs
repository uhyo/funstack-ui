// Run: node memo/platform-researcher/probes/05-browser/run-radios.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire('/home/uhyo/repos/funstack-ui/packages/ui/package.json');
const pw = require('playwright');
const esbuild = require('/home/uhyo/repos/funstack-ui/node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild');
const bundle = (await esbuild.build({ entryPoints: [join(here, 'app.js')], bundle: true, write: false, format: 'iife',
  nodePaths: ['/home/uhyo/repos/funstack-ui/packages/ui/node_modules'], define: { 'process.env.NODE_ENV': '"development"' } })).outputFiles[0].text;
for (const name of ['chromium', 'firefox']) {
  const b = await pw[name].launch(); const p = await b.newPage();
  await p.setContent('<!doctype html><button id=before>x</button><div id="root"></div>');
  await p.addScriptTag({ content: bundle });
  await p.evaluate(() => window.mountRadios()); await p.waitForTimeout(50);
  await p.focus('#before'); await p.keyboard.press('Tab');
  await p.keyboard.press('ArrowDown');
  const s1 = await p.evaluate(() => ({ focus: document.activeElement.id, dom: [...document.querySelectorAll('input')].map((x) => x.checked ? x.value : '-').join(''), opt: window.api.radios.optimistic, committed: window.api.radios.committed }));
  await p.keyboard.press('ArrowDown');
  const s2 = await p.evaluate(() => ({ focus: document.activeElement.id, dom: [...document.querySelectorAll('input')].map((x) => x.checked ? x.value : '-').join(''), opt: window.api.radios.optimistic, events: window.api.radios.events }));
  await p.evaluate(() => window.resolveAction()); await p.waitForTimeout(50);
  const s3 = await p.evaluate(() => ({ dom: [...document.querySelectorAll('input')].map((x) => x.checked ? x.value : '-').join(''), committed: window.api.radios.committed }));
  let ax = 'n/a';
  if (name === 'chromium') { const cdp = await p.context().newCDPSession(p); const { nodes } = await cdp.send('Accessibility.getFullAXTree'); ax = nodes.filter((n) => !n.ignored && ['radiogroup', 'group'].includes(n.role?.value)).map((n) => `${n.role.value} name=${JSON.stringify(n.name?.value)}`); }
  console.log(name, b.version(), JSON.stringify({ afterFirstArrow: s1, afterSecondArrow: s2, afterResolve: s3, fieldsetRoleRadiogroupAX: ax }));
  await b.close();
}

// Run: node memo/platform-researcher/probes/05-browser/run.mjs  (uses packages/ui's Playwright install)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire('/home/uhyo/repos/funstack-ui/packages/ui/package.json');
const pw = require('playwright');
const esbuild = require('/home/uhyo/repos/funstack-ui/node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild');
const bundle = (await esbuild.build({ entryPoints: [join(here, 'app.js')], bundle: true, write: false, format: 'iife',
  nodePaths: ['/home/uhyo/repos/funstack-ui/packages/ui/node_modules'], define: { 'process.env.NODE_ENV': '"development"' } })).outputFiles[0].text;

const nativeHtml = `<!doctype html><html><body>
<input type="checkbox" id="cb"><label for="cb">cb</label>
<input type="checkbox" id="sw" switch>
<fieldset id="fs"><legend>G</legend>
<input type="radio" name="r" value="a" id="ra" checked><input type="radio" name="r" value="b" id="rb"><input type="radio" name="r" value="c" id="rc" required>
</fieldset>
<div dir="rtl"><input type="radio" name="q" value="a" id="qa" checked><input type="radio" name="q" value="b" id="qb"><input type="radio" name="q" value="c" id="qc"></div>
<form id="f"><input type="checkbox" name="req" id="req" required><input type="radio" name="rr" value="x" required><input type="radio" name="rr" value="y"></form>
<button id="after">after</button>
<div id="root"></div></body></html>`;

const results = {};
for (const name of ['chromium', 'firefox', 'webkit']) {
  const r = (results[name] = {});
  let browser;
  try { browser = await pw[name].launch(); } catch (e) { r.launchError = String(e).split('\n')[0]; continue; }
  const page = await browser.newPage();
  await page.setContent(nativeHtml);
  r.version = browser.version();
  r.features = await page.evaluate(() => ({
    switchProp: 'switch' in HTMLInputElement.prototype,
    switchReflects: document.getElementById('sw').switch,
    matchesChecked: (() => { const s = document.getElementById('sw'); s.click(); const m = s.matches(':checked'); s.click(); return m; })(),
    accentColor: CSS.supports('accent-color', 'red'),
    appearanceNone: CSS.supports('appearance', 'none'),
    checkmark: CSS.supports('selector(::checkmark)'),
    thumb: CSS.supports('selector(::thumb)'),
    track: CSS.supports('selector(::track)'),
    userInvalid: CSS.supports('selector(:user-invalid)'),
    indeterminateRadio: CSS.supports('selector(:indeterminate)'),
    stateSel: CSS.supports('selector(:state(x))'),
  }));
  // event order with/without preventDefault, mouse click
  r.eventOrder = {};
  for (const prevent of [false, true]) {
    r.eventOrder[prevent ? 'preventDefault' : 'plain'] = await page.evaluate(async (prevent) => {
      const el = document.getElementById('cb'); el.checked = false;
      const log = [];
      const ls = ['click', 'input', 'change'].map((t) => { const f = (e) => { log.push(`${t}(${el.checked})`); if (t === 'click' && prevent) e.preventDefault(); }; el.addEventListener(t, f); return [t, f]; });
      el.click();
      log.push(`after(${el.checked})`);
      await new Promise((r) => setTimeout(r, 10));
      ls.forEach(([t, f]) => el.removeEventListener(t, f));
      return log.join(' > ');
    }, prevent);
  }
  // keyboard: Space toggles checkbox; Enter does not; Enter in a form submits (implicit submission not for checkboxes?)
  await page.evaluate(() => { document.getElementById('cb').checked = false; });
  await page.focus('#cb'); await page.keyboard.press('Space');
  const afterSpace = await page.evaluate(() => document.getElementById('cb').checked);
  await page.keyboard.press('Enter');
  const afterEnter = await page.evaluate(() => document.getElementById('cb').checked);
  r.keyboard = { afterSpace, afterEnter };
  // radio group: tab order and arrows
  await page.focus('#cb');
  await page.keyboard.press('Tab'); // -> sw
  await page.keyboard.press('Tab'); // -> radio group (checked one)
  const radioFocus1 = await page.evaluate(() => document.activeElement.id);
  const changes = [];
  await page.exposeFunction('logChange', (v) => changes.push(v));
  await page.evaluate(() => document.querySelectorAll('input[type=radio]').forEach((el) => el.addEventListener('change', () => window.logChange(el.id))));
  await page.keyboard.press('ArrowDown');
  const afterDown = await page.evaluate(() => [document.activeElement.id, [...document.querySelectorAll('input[name=r]')].find((x) => x.checked)?.id]);
  await page.keyboard.press('ArrowRight');
  const afterRight = await page.evaluate(() => [document.activeElement.id, [...document.querySelectorAll('input[name=r]')].find((x) => x.checked)?.id]);
  await page.keyboard.press('ArrowRight'); // wrap?
  const afterWrap = await page.evaluate(() => [document.activeElement.id, [...document.querySelectorAll('input[name=r]')].find((x) => x.checked)?.id]);
  await page.keyboard.press('Tab');
  const tabOut = await page.evaluate(() => document.activeElement.id);
  await page.keyboard.press('Shift+Tab');
  const shiftBack = await page.evaluate(() => document.activeElement.id);
  r.radio = { tabInto: radioFocus1, afterDown, afterRight, afterWrap, tabOutGoesTo: tabOut, shiftTabBackTo: shiftBack, changeEvents: [...changes] };
  // RTL
  await page.focus('#qa'); await page.keyboard.press('ArrowRight');
  const rtlRight = await page.evaluate(() => document.activeElement.id);
  await page.focus('#qa'); await page.keyboard.press('ArrowLeft');
  const rtlLeft = await page.evaluate(() => document.activeElement.id);
  r.rtl = { fromFirst_ArrowRight: rtlRight, fromFirst_ArrowLeft: rtlLeft };
  // required: radios / checkbox validity, :user-invalid before/after submit attempt
  r.required = await page.evaluate(() => {
    const f = document.getElementById('f');
    const req = document.getElementById('req');
    const rr = f.querySelectorAll('input[name=rr]');
    const before = { cbValid: req.validity.valid, cbUserInvalid: req.matches(':user-invalid'), radioValid: rr[1].validity.valid, radio2Invalid: rr[1].matches(':invalid') };
    f.requestSubmit();
    const after = { cbUserInvalid: req.matches(':user-invalid'), radioYUserInvalid: rr[1].matches(':user-invalid'), cbMsg: req.validationMessage };
    return { before, afterSubmitAttempt: after };
  });
  // React scenarios
  await page.setContent('<!doctype html><div id="root"></div>');
  await page.addScriptTag({ content: bundle });
  r.react = {};
  for (const [label, comp, props] of [['transitionOnly', 'TransitionOnly', {}], ['optimistic', 'Optimistic', {}], ['optimistic+preventDefault', 'Optimistic', { prevent: true }]]) {
    await page.evaluate(([c, p]) => window.mount(c, p), [comp, props]);
    await page.waitForTimeout(50);
    await page.click('input');
    const pend = await page.evaluate(() => document.querySelector('input').checked);
    await page.waitForTimeout(50);
    const pend2 = await page.evaluate(() => [document.querySelector('input').checked, JSON.stringify(window.api.opt ?? null)]);
    await page.evaluate(() => window.resolveAction()); await page.waitForTimeout(50);
    const fin = await page.evaluate(() => document.querySelector('input').checked);
    r.react[label] = { domRightAfterClick: pend, domWhilePending: pend2[0], state: pend2[1], domSettled: fin };
    await page.evaluate(() => { window.unmount(); window.api = {}; });
  }
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));

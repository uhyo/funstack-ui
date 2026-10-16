// Chromium-only: computed accessibility role/state for checkbox/switch/radio markups via CDP.
// Run: node memo/platform-researcher/probes/06-chromium-ax-tree.cjs
const pw = require('/home/uhyo/repos/funstack-ui/packages/ui/node_modules/playwright');
(async () => {
  const b = await pw.chromium.launch(); const p = await b.newPage();
  await p.setContent(`
<input type=checkbox id=cb aria-label="plain checkbox">
<input type=checkbox id=mixed aria-label="indeterminate checkbox">
<input type=checkbox id=ariamixed aria-checked=mixed aria-label="aria-checked=mixed on input">
<input type=checkbox role=switch id=sw checked aria-label="input role=switch">
<input type=checkbox switch id=swattr aria-label="input switch attr">
<button type=button role=switch aria-checked=true aria-label="button role=switch">x</button>
<button type=button role=checkbox aria-checked=mixed aria-label="button role=checkbox mixed">x</button>
<fieldset><legend>Fruit</legend><input type=radio name=f aria-label="apple" checked><input type=radio name=f aria-label="pear"></fieldset>
<div role=radiogroup aria-label="custom group" aria-required=true><input type=radio name=g aria-label="g1"></div>
<input type=checkbox required aria-label="required checkbox"><fieldset><legend>Req</legend><input type=radio name=h aria-label="h1" required><input type=radio name=h aria-label="h2"></fieldset>`);
  await p.evaluate(() => { document.getElementById('mixed').indeterminate = true; });
  const cdp = await p.context().newCDPSession(p);
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  for (const n of nodes) {
    if (n.ignored) continue;
    const role = n.role?.value; if (['none', 'generic', 'RootWebArea', 'StaticText', 'InlineTextBox', 'LineBreak'].includes(role)) continue;
    const props = Object.fromEntries((n.properties || []).filter((x) => ['checked', 'required', 'invalid', 'focusable'].includes(x.name)).map((x) => [x.name, x.value.value]));
    console.log(`${role.padEnd(12)} name=${JSON.stringify(n.name?.value)} ${JSON.stringify(props)}`);
  }
  console.log('chromium', b.version());
  await b.close();
})();

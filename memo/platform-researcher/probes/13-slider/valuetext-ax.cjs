// Is aria-valuetext exposed on a native <input type=range>? Chromium AX tree via CDP. Run: node valuetext-ax.cjs
const pw = require("/home/uhyo/repos/funstack-ui/packages/ui/node_modules/playwright");
(async () => {
  const b = await pw.chromium.launch(); const p = await b.newPage();
  await p.setContent(`
    <input id="a" type="range" value="50" aria-label="native with valuetext" aria-valuetext="fifty percent">
    <input id="b" type="range" value="50" aria-label="native, valuetext set later">
    <input id="c" type="range" value="50" aria-label="native with aria-valuemax" aria-valuemax="10" aria-valuenow="3">
    <div id="d" role="slider" tabindex="0" aria-label="aria slider" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" aria-valuetext="fifty percent"></div>`);
  await p.evaluate(() => document.getElementById("b").setAttribute("aria-valuetext", "set later"));
  const cdp = await p.context().newCDPSession(p); await cdp.send("Accessibility.enable");
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  console.log("chromium", b.version());
  for (const n of nodes.filter(n => n.role?.value === "slider")) {
    const props = Object.fromEntries((n.properties || []).map(x => [x.name, x.value?.value]));
    console.log(n.name?.value.padEnd(32), JSON.stringify({ value: n.value?.value, valuetext: props.valuetext, valuemin: props.valuemin, valuemax: props.valuemax }));
  }
  await b.close();
})();

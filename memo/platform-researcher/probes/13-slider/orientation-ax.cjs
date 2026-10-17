// Does Chromium honour aria-orientation / dynamic min on a native range? Run: node orientation-ax.cjs
const pw = require("/home/uhyo/repos/funstack-ui/packages/ui/node_modules/playwright");
(async () => {
  const b = await pw.chromium.launch(); const p = await b.newPage();
  await p.setContent(`
    <input type="range" aria-label="horizontal + aria-orientation=vertical" aria-orientation="vertical">
    <input type="range" style="writing-mode:vertical-lr;direction:rtl" aria-label="vertical writing-mode">
    <input type="range" min="40" max="100" value="60" aria-label="dynamic min 40">`);
  const cdp = await p.context().newCDPSession(p); await cdp.send("Accessibility.enable");
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  console.log("chromium", b.version());
  for (const n of nodes.filter(n => n.role?.value === "slider")) {
    const props = Object.fromEntries((n.properties || []).map(x => [x.name, x.value?.value]));
    console.log(n.name?.value.padEnd(42), JSON.stringify({ orientation: props.orientation, valuemin: props.valuemin, valuemax: props.valuemax, value: n.value?.value }));
  }
  await b.close();
})();

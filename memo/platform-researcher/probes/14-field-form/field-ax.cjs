// Chromium AX for native validity, aria-invalid, aria-describedby, aria-errormessage. Run: node field-ax.cjs
const pw = require("/home/uhyo/repos/funstack-ui/packages/ui/node_modules/playwright");
(async () => {
  const b = await pw.chromium.launch(); const p = await b.newPage();
  await p.setContent(`<form>
    <label>Required untouched <input id="a" required></label>
    <label>Required typed+cleared <input id="b" required></label>
    <label>Custom validity <input id="c" value="x"></label>
    <label>aria-invalid only <input id="d" value="x" aria-invalid="true"></label>
    <label>valid but aria-invalid=false on required empty <input id="e" required aria-invalid="false"></label>
    <label>describedby <input id="f" aria-invalid="true" aria-describedby="hint ferr"></label><span id="hint">Use 8+ chars.</span><span id="ferr">Too short.</span>
    <label>errormessage <input id="g" aria-invalid="true" aria-errormessage="gerr"></label><span id="gerr">Bad value.</span>
    <label>email typeMismatch <input id="h" type="email" value="nope"></label>
    <label>typeMismatch + aria-invalid=false <input id="i" type="email" value="nope" aria-invalid="false"></label>
    <label>required empty + aria-invalid=true <input id="j" required aria-invalid="true"></label>
    <button>go</button></form>`);
  await p.evaluate(() => document.getElementById("c").setCustomValidity("Server says no"));
  await p.fill("#b", "x"); await p.fill("#b", ""); await p.focus("#c");
  const cdp = await p.context().newCDPSession(p); await cdp.send("Accessibility.enable");
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  console.log("chromium", b.version());
  for (const n of nodes.filter(n => n.role?.value === "textbox")) {
    const props = Object.fromEntries((n.properties || []).map(x => [x.name, x.value?.value ?? x.value?.relatedNodes?.map(r => r.idref)]));
    console.log((n.name?.value || "").padEnd(52), JSON.stringify({ invalid: props.invalid, required: props.required, description: n.description?.value, errormessage: props.errormessage }));
  }
  const css = await p.evaluate(() => [...document.querySelectorAll("input")].map(i => i.id + ":" + (i.matches(":user-invalid") ? "UI" : "-") + (i.matches(":invalid") ? "/I" : "/-")).join(" "));
  console.log("pseudo-classes", css);
  await b.close();
})();

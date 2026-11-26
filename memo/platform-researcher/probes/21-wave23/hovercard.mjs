// Wave 23 research (#166), 2026-11-26. Run: node hovercard.mjs
// Chromium interestfor with a rich (interactive) target, as a HoverCard would render it:
// <a href interestfor> + popover="hint" | "auto" containing a link, a button and a <select>.
// Checks: AX mapping (CDP), keyboard focus open, Tab into the card, Escape, Shift+Tab back
// (re-open suppression), hover into the card, auto-vs-hint stacking with an open auto popover,
// a select picker (auto popover) opened inside a hint card. Also prints interestForElement
// support in Firefox and WebKit.
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");

const page = (type) => `<!doctype html><style>
body{margin:0;font:16px sans-serif} #inv{position:absolute;top:100px;left:100px}
#card{margin:0;position:fixed;top:140px;left:100px;width:240px;padding:8px;border:1px solid}
#menu{margin:0;position:fixed;top:10px;left:400px}
#after{position:absolute;top:400px;left:100px}
#sel,#sel::picker(select){appearance:base-select}
</style>
<button id="menuBtn" popovertarget="menu" style="position:absolute;top:10px;left:10px">menu</button>
<div id="menu" popover="auto">menu</div>
<a id="inv" href="#u" interestfor="card">@user</a>
<div id="card" popover="${type}"><a id="cardLink" href="#p">Profile</a> <button id="follow">Follow</button>
<select id="sel"><option>a</option><option>b</option></select></div>
<a id="after" href="#x">after</a>
<script>
window.log=[];
const card=document.getElementById('card');
card.addEventListener('toggle',e=>log.push('card:'+e.newState));
document.getElementById('menu').addEventListener('toggle',e=>log.push('menu:'+e.newState));
card.addEventListener('interest',e=>log.push('interest'));
card.addEventListener('loseinterest',e=>log.push('loseinterest'));
</script>`;

async function ax(cdp, selector) {
  if (process.env.NOAX) return "(skipped)";
  const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
  const { nodes } = await cdp.send("Accessibility.getPartialAXTree", { nodeId, fetchRelatives: false });
  const n = nodes[0];
  const props = Object.fromEntries((n.properties ?? []).map((p) => [p.name, p.value.value ?? (p.value.relatedNodes ?? []).map((r) => r.idref ?? r.backendDOMNodeId).join(",")]));
  return `${n.role?.value} name=${JSON.stringify(n.name?.value ?? "")} desc=${JSON.stringify(n.description?.value ?? "")} ${JSON.stringify(props)}`;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await pw.chromium.launch();
console.log("Chromium", b.version());
for (const type of ["hint", "auto"]) {
  console.log(`\n== popover="${type}"`);
  const p = await b.newPage();
  await p.setContent(page(type));
  const cdp = process.env.NOAX ? null : await p.context().newCDPSession(p);
  const state = () => p.evaluate(() => ({ open: document.getElementById("card").matches(":popover-open"), focus: document.activeElement?.id || document.activeElement?.tagName, log: log.splice(0) }));
  console.log("AX closed  inv:", await ax(cdp, "#inv"));
  console.log("AX closed card:", await ax(cdp, "#card"));
  // keyboard
  await p.focus("#menuBtn");
  await p.keyboard.press("Tab"); // to #inv (menu popover closed, so next is the link)
  await wait(800);
  console.log("focus inv +800ms:", await state());
  console.log("AX open    inv:", await ax(cdp, "#inv"));
  console.log("AX open   card:", await ax(cdp, "#card"));
  await p.keyboard.press("Tab");
  await wait(800);
  console.log("Tab:", await state());
  await p.keyboard.press("Tab");
  await wait(800);
  console.log("Tab:", await state());
  await p.keyboard.press("Shift+Tab");
  await p.keyboard.press("Shift+Tab");
  await wait(800);
  console.log("Shift+Tab x2 (back to inv):", await state());
  await p.keyboard.press("Escape");
  await wait(100);
  console.log("Escape:", await state());
  // re-focus after Escape: blur then focus
  await p.keyboard.press("Tab");
  await wait(50);
  await p.keyboard.press("Shift+Tab");
  await wait(800);
  console.log("Tab away + back after Escape:", await state());
  // Tab out of the card entirely
  await p.focus("#follow");
  await wait(50);
  await p.focus("#after");
  await wait(800);
  console.log("focus leaves card to #after:", await state());

  // hover
  await p.mouse.move(5, 300);
  await wait(800);
  await state();
  await p.mouse.move(110, 108);
  await wait(800);
  console.log("hover inv +800ms:", await state());
  await p.mouse.move(150, 150, { steps: 5 });
  await wait(800);
  console.log("pointer into card +800ms:", await state());
  await p.mouse.move(600, 500, { steps: 5 });
  await wait(800);
  console.log("pointer leaves +800ms:", await state());

  // stacking with an open auto popover
  await p.click("#menuBtn");
  await wait(50);
  await p.mouse.move(110, 108);
  await wait(800);
  console.log("menu open, hover inv:", await state());
  await p.keyboard.press("Escape");
  await p.keyboard.press("Escape");
  await p.mouse.move(600, 500);
  await wait(800);
  await state();

  // select picker inside the card
  await p.mouse.move(110, 108);
  await wait(800);
  await p.mouse.move(150, 150, { steps: 5 });
  await wait(100);
  const sel = await p.$("#sel");
  const box = (await sel.boundingBox()) ?? (console.log("card not open before select click", await state()), { x: 0, y: 0 });
  await p.mouse.move(box.x + 5, box.y + 5, { steps: 3 });
  await p.mouse.click(box.x + 5, box.y + 5);
  await wait(800);
  console.log("click select in card:", { ...(await state()), pickerOpen: await p.evaluate(() => document.getElementById("sel").matches(":open")) });
  await p.close();
}
await b.close();

for (const [name, type] of [["firefox", pw.firefox], ["webkit", pw.webkit]]) {
  try {
    const br = await type.launch();
    const pg = await br.newPage();
    console.log(name, br.version(), await pg.evaluate(() => ({ interestForElement: "interestForElement" in HTMLButtonElement.prototype, hint: (() => { const d = document.createElement("div"); d.popover = "hint"; return d.popover; })(), baseSelect: CSS.supports("appearance", "base-select") })));
    await br.close();
  } catch (e) {
    console.log(name, "launch failed", e.message.split("\n")[0]);
  }
}

// Chromium-only: interestfor as a hover-submenu trigger, each case on a fresh page. Run: node interest-clean.mjs
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const b = await pw.chromium.launch();
const HTML = (subType, delay) => `<style>[popover]{margin:0;position:fixed;position-area:block-end span-inline-end}
.sub{position-area:span-block-end inline-end}[popover]:popover-open{display:flex;flex-direction:column} button{interest-delay:${delay}}</style>
<button id="t" commandfor="menu" command="toggle-popover">Menu</button>
<div id="menu" popover><button id="i1">Item 1</button><button id="si" interestfor="sub">More</button><button id="i3">Item 3</button>
<div id="sub" popover="${subType}" class="sub"><button id="s1">Sub 1</button></div></div>
<button id="far" style="position:absolute;top:600px;left:600px">far</button>`;
for (const [subType, delay] of [["auto", "0s"], ["auto", "normal"], ["hint", "0s"]]) {
  const run = async (label, steps) => {
    const page = await b.newPage({ viewport: { width: 1000, height: 700 } }); page.setDefaultTimeout(3000);
    await page.setContent(HTML(subType, delay));
    const st = () => page.evaluate(() => (["menu", "sub"].filter((id) => document.getElementById(id).matches(":popover-open")).join(",") || "(none)") + " focus=" + document.activeElement?.id);
    await page.click("#t"); await page.waitForTimeout(50);
    const out = []; for (const s of steps) { await s(page); await page.waitForTimeout(500); out.push(await st()); }
    console.log(`[sub=${subType} delay=${delay}] ${label}: ${out.join(" | ")}`); await page.close();
  };
  await run("hover item, hover sibling item", [(p) => p.hover("#si"), (p) => p.hover("#i1")]);
  await run("hover item, move into sub, move to far", [(p) => p.hover("#si"), (p) => p.hover("#s1"), (p) => p.mouse.move(900, 650)]);
  await run("focus item (keyboard), Escape, Escape", [(p) => p.focus("#si"), (p) => p.keyboard.press("Escape"), (p) => p.keyboard.press("Escape")]);
  await run("focus item, focus sibling item", [(p) => p.focus("#si"), (p) => p.focus("#i1")]);
  await run("focus item, ArrowRight, Tab", [(p) => p.focus("#si"), (p) => p.keyboard.press("ArrowRight"), (p) => p.keyboard.press("Tab")]);
}
console.log("chromium", b.version());
await b.close();

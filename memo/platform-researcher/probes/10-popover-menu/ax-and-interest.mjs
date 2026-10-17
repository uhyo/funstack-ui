// Chromium-only: AX tree for popover invokers (popovertarget vs commandfor), interestfor submenu behaviour,
// focusgroup="menu" behaviour. Run: node ax-and-interest.mjs
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const b = await pw.chromium.launch();
const page = await b.newPage({ viewport: { width: 1000, height: 700 } }); page.setDefaultTimeout(3000);
const CSS = `<style>[popover]{margin:0;position:fixed;position-area:block-end span-inline-end}
.sub{position-area:span-block-end inline-end}[popover]:popover-open{display:flex;flex-direction:column}</style>`;
const cdp = await page.context().newCDPSession(page);
const dump = async (label) => {
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  const out = nodes.filter((n) => !n.ignored && !["none", "generic", "InlineTextBox", "StaticText", "RootWebArea"].includes(n.role?.value))
    .map((n) => `  ${n.role?.value} "${n.name?.value ?? ""}" ${(n.properties ?? []).filter((p) => !["focusable", "readonly"].includes(p.name)).map((p) => `${p.name}=${JSON.stringify(p.value.value ?? p.value.relatedNodes?.map((r) => r.idref || r.text))}`).join(" ")}`);
  console.log(`--- ${label}\n` + out.join("\n"));
};
// 1. AX of invokers
await page.setContent(CSS + `
<button id="a" popovertarget="pa">popovertarget (adjacent)</button><div id="pa" popover><button>pa item</button></div>
<button id="c" commandfor="pc" command="toggle-popover">commandfor toggle (far)</button>
<button id="cs" commandfor="pc2" command="show-popover">commandfor show (far)</button>
<button id="m" commandfor="pm" command="toggle-popover" aria-haspopup="menu">menu button (explicit haspopup)</button>
<p>filler</p>
<div id="pc" popover><button>pc item</button></div><div id="pc2" popover><button>pc2 item</button></div>
<div id="pm" popover role="menu" aria-labelledby="m"><button role="menuitem" tabindex="-1">Cut</button><button role="menuitem" tabindex="-1">Copy</button></div>`);
await dump("all closed");
await page.click("#c"); await dump("pc open via commandfor toggle-popover");
await page.keyboard.press("Escape");
await page.click("#m"); await dump("menu open");
await page.keyboard.press("Escape");

// 2. interestfor submenu inside an auto menu
await page.setContent(CSS + `<button id="t" commandfor="menu" command="toggle-popover">Menu</button>
<div id="menu" popover><button id="i1">Item 1</button><button id="si" interestfor="sub" style="interest-delay: 0s">More ▸</button><button id="i3">Item 3</button>
<div id="sub" popover class="sub"><button id="s1">Sub 1</button></div></div><button id="far" style="position:absolute;top:600px;left:600px">far</button>`);
const st = () => page.evaluate(() => ["menu", "sub"].filter((id) => document.getElementById(id).matches(":popover-open")).join(",") || "(none)");
const af = () => page.evaluate(() => document.activeElement?.id);
const r = {};
await page.click("#t"); await page.waitForTimeout(50);
await page.hover("#si"); await page.waitForTimeout(400); r.hoverItem = await st();
await page.hover("#s1"); await page.waitForTimeout(400); r.moveIntoSub = await st();
await page.hover("#i1"); await page.waitForTimeout(600); r.hoverSibling = await st();
await page.focus("#si"); await page.waitForTimeout(400); r.keyboardFocusItem = await st() + " focus=" + await af();
await page.keyboard.press("Escape"); await page.waitForTimeout(100); r.escapeAfterFocusInterest = await st() + " focus=" + await af();
await page.keyboard.press("Escape"); await page.waitForTimeout(100); r.escape2 = await st();
await page.click("#t"); await page.waitForTimeout(50);
await page.click("#si"); await page.waitForTimeout(400); r.clickItemWithInterestfor = await st();
r.subPopoverType = await page.evaluate(() => document.getElementById("sub").popover);
console.log("interestfor submenu", JSON.stringify(r, null, 1));

// 3. focusgroup="menu"
await page.setContent(`<div id="fg" focusgroup="menu" aria-label="Edit"><button id="f1">Cut</button><button id="f2" disabled>Copy</button><button id="f3">Paste</button><span id="f4" tabindex="-1" role="menuitem">Span item</span></div><button id="out">out</button>`);
const seq = [];
await page.focus("#f1");
for (const k of ["ArrowDown", "ArrowDown", "ArrowDown", "ArrowDown", "ArrowUp", "ArrowRight", "End", "Home", "p"]) { await page.keyboard.press(k); seq.push(`${k}->${await af()}`); }
await page.keyboard.press("Tab"); seq.push(`Tab->${await af()}`);
await page.keyboard.down("Shift"); await page.keyboard.press("Tab"); await page.keyboard.up("Shift"); seq.push(`ShiftTab->${await af()}`);
console.log("focusgroup=menu", seq.join("  "));
const tabidx = await page.evaluate(() => [...document.querySelectorAll("#fg > *")].map((e) => `${e.id}:tabIndex=${e.tabIndex}`).join(" "));
console.log("tabIndex", tabidx);
await dump("focusgroup=menu AX");
// wrap modifier
await page.setContent(`<div focusgroup="menu wrap"><button id="w1">a</button><button id="w2">b</button></div>`);
await page.focus("#w2"); await page.keyboard.press("ArrowDown"); console.log("menu wrap: ArrowDown from last ->", await af());
// focusgroup across popover boundary
await page.setContent(CSS + `<button id="t" popovertarget="pm">Menu</button><div id="pm" popover focusgroup="menu wrap"><button id="x1">x1</button><button id="x2">x2</button></div>`);
await page.click("#t"); await page.focus("#x1"); await page.keyboard.press("ArrowDown"); const a1 = await af(); await page.keyboard.press("ArrowDown");
console.log("focusgroup inside popover:", a1, await af());
console.log("chromium", b.version());
await b.close();

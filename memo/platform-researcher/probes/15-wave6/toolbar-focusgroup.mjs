// focusgroup="toolbar" in Chromium (2026-10-18, wave 6). Run: node toolbar-focusgroup.mjs
// Firefox has no focusgroup; it runs only to show the attribute is inert there.
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");

const PAGE = `<!doctype html><html lang="en"><body>
<button id="before">before</button>
<div id="tb" focusgroup="toolbar" aria-label="Format">
  <button id="bold" aria-pressed="false">B</button>
  <button id="italic" aria-pressed="true">I</button>
  <button id="dis" disabled>disabled</button>
  <button id="adis" aria-disabled="true">aria-disabled</button>
  <input id="text" value="hello" aria-label="text">
  <div id="align" role="radiogroup" focusgroup="radiogroup" aria-label="Align">
    <button id="left" role="radio" aria-checked="true">L</button>
    <button id="center" role="radio" aria-checked="false">C</button>
  </div>
  <input id="num" type="number" value="5" aria-label="num">
  <button id="last">last</button>
</div>
<button id="after">after</button>
<div dir="rtl"><div id="rtl" focusgroup="toolbar"><button id="r1">r1</button><button id="r2">r2</button><button id="r3">r3</button></div></div>
<div id="v" focusgroup="toolbar block" aria-orientation="vertical"><button id="v1">v1</button><button id="v2">v2</button></div>
<div id="wrap" focusgroup="toolbar wrap"><button id="w1">w1</button><button id="w2">w2</button></div>
<div id="pressed" focusgroup="toolbar nomemory"><button id="p1">p1</button><button id="p2" focusgroupstart>p2</button><button id="p3">p3</button></div>
</body></html>`;

for (const name of ["chromium", "firefox"]) {
  const browser = await pw[name].launch();
  const page = await browser.newPage();
  await page.setContent(PAGE);
  console.log(`\n######## ${name} ${browser.version()}`);
  const out = (k, v) => console.log(k.padEnd(52), JSON.stringify(v));
  const active = () => page.evaluate(() => document.activeElement?.id + (document.activeElement?.selectionStart != null ? "@" + document.activeElement.selectionStart : ""));
  const seq = async (start, keys) => {
    await page.focus("#" + start);
    const r = [await active()];
    for (const k of keys) { await page.keyboard.press(k); r.push(k.replace("Arrow", "") + ">" + (await active())); }
    return r.join(" ");
  };
  out("focusGroup IDL", await page.evaluate(() => "focusGroup" in HTMLElement.prototype));
  out("tabIndex of items (bold, italic, dis, adis)", await page.evaluate(() => ["bold", "italic", "dis", "adis"].map((id) => document.getElementById(id).tabIndex)));
  out("Right x8 from bold", await seq("bold", Array(8).fill("ArrowRight")));
  out("Left from num / last", await seq("last", ["ArrowLeft", "ArrowLeft", "ArrowLeft"]));
  out("text: caret at end, Right / Left", await page.evaluate(() => { const t = document.getElementById("text"); t.focus(); t.setSelectionRange(5, 5); return 0; }) && "" || await seq("text", ["ArrowRight", "ArrowLeft", "Home", "End"]));
  out("Tab from text (inside group)", await seq("text", ["Tab", "Tab"]));
  out("Home/End from italic", await seq("italic", ["End", "Home"]));
  out("Down/Up inside radiogroup", await seq("left", ["ArrowDown", "ArrowDown", "ArrowRight"]));
  out("num: Up (spin) / Right", await seq("num", ["ArrowUp", "ArrowRight"]));
  out("num value after", await page.evaluate(() => document.getElementById("num").value));
  // Tab entry / memory
  await page.focus("#bold"); await page.keyboard.press("ArrowRight");
  out("Tab from before (memory: italic expected)", await seq("before", ["Tab"]));
  out("Shift+Tab from after", await seq("after", ["Shift+Tab"]));
  out("Tab from italic leaves group", await seq("italic", ["Tab"]));
  out("RTL Right/Left from r1", await seq("r1", ["ArrowRight", "ArrowLeft", "ArrowLeft"]));
  out("vertical Down/Right", await seq("v1", ["ArrowRight", "ArrowDown", "ArrowDown"]));
  out("wrap: Right x2", await seq("w1", ["ArrowRight", "ArrowRight"]));
  out("nowrap default: Right x2 from bold-group last", await seq("last", ["ArrowRight"]));
  await page.focus("#p3");
  await page.focus("#after");
  out("nomemory + focusgroupstart: Shift+Tab into #pressed", await seq("after", ["Tab", "Tab", "Tab", "Tab", "Tab", "Tab"]));
  out("preventDefault on keydown blocks move", await page.evaluate(() => { document.getElementById("w1").addEventListener("keydown", (e) => e.preventDefault(), { once: true }); return 1; }) && await seq("w1", ["ArrowRight"]));
  if (name === "chromium") {
    const cdp = await page.context().newCDPSession(page); await cdp.send("Accessibility.enable");
    const { nodes } = await cdp.send("Accessibility.getFullAXTree");
    const byId = {};
    for (const n of nodes) if (n.backendDOMNodeId) byId[n.backendDOMNodeId] = n;
    for (const id of ["tb", "bold", "dis", "adis", "align", "left", "rtl", "v"]) {
      const { node } = await cdp.send("DOM.describeNode", { objectId: (await cdp.send("Runtime.evaluate", { expression: `document.getElementById("${id}")` })).result.objectId });
      const ax = byId[node.backendNodeId];
      const props = Object.fromEntries((ax?.properties || []).map((x) => [x.name, x.value?.value]));
      out("AX #" + id, { role: ax?.role?.value, name: ax?.name?.value, pressed: props.pressed, checked: props.checked, orientation: props.orientation, disabled: props.disabled, focusable: props.focusable });
    }
  }
  await browser.close();
}

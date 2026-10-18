// #74 probe: a same-name native radio group inside focusgroup="toolbar" in Chromium.
// Run: node memo/architect/probes/toolbar-radios-focusgroup.mjs (from the repo root; Chromium only)
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");

const PAGE = `<!doctype html><html lang="en"><body>
<button id="before">before</button>
<div id="tb" role="toolbar" focusgroup="toolbar wrap" aria-label="Format">
  <button id="b1">b1</button>
  <span role="radiogroup" aria-label="Align" id="g1">
    <input type="radio" name="align" id="left" value="left">
    <input type="radio" name="align" id="center" value="center" checked>
    <input type="radio" name="align" id="right" value="right">
  </span>
  <button id="b2">b2</button>
  <span role="radiogroup" aria-label="Size" id="g2">
    <input type="radio" name="size" id="s" value="s">
    <input type="radio" name="size" id="m" value="m">
    <input type="radio" name="size" id="l" value="l">
  </span>
  <button id="b3">b3</button>
</div>
<button id="after">after</button>
<div id="v" role="toolbar" focusgroup="toolbar block" aria-orientation="vertical">
  <button id="v1">v1</button>
  <input type="radio" name="vg" id="va" checked><input type="radio" name="vg" id="vb">
  <button id="v2">v2</button>
</div>
</body></html>`;

const browser = await pw.chromium.launch();
const page = await browser.newPage();
await page.setContent(PAGE);
console.log(`######## chromium ${browser.version()}`);
const out = (k, v) => console.log(k.padEnd(56), JSON.stringify(v));
const active = () => page.evaluate(() => document.activeElement?.id ?? null);
const checked = (ids) =>
  page.evaluate((ids) => ids.map((id) => id + "=" + document.getElementById(id).checked), ids);
const reset = () =>
  page.evaluate(() => {
    for (const id of ["left", "right", "s", "m", "l", "vb"])
      document.getElementById(id).checked = false;
    document.getElementById("center").checked = true;
    document.getElementById("va").checked = true;
  });
const seq = async (start, keys) => {
  await page.focus("#" + start);
  const r = [await active()];
  for (const k of keys) {
    await page.keyboard.press(k);
    r.push(k.replace("Arrow", "").replace("Shift+", "S+") + ">" + (await active()));
  }
  return r.join(" ");
};

out("focusGroup IDL", await page.evaluate(() => "focusGroup" in HTMLElement.prototype));
out(
  "tabIndex (left, center, right, s, m, l)",
  await page.evaluate(() =>
    ["left", "center", "right", "s", "m", "l"].map((id) => document.getElementById(id).tabIndex),
  ),
);

// 1. Toolbar arrows arriving at the group from a neighbour
out("Right from b1 (checked=center)", await seq("b1", ["ArrowRight"]));
out("  checked", await checked(["left", "center", "right"]));
await reset();
out("Left from b2 (checked=center)", await seq("b2", ["ArrowLeft"]));
out("  checked", await checked(["left", "center", "right"]));
await reset();
out("Right from b2 into unchecked group", await seq("b2", ["ArrowRight"]));
out("  checked", await checked(["s", "m", "l"]));
await reset();
out("Left from b3 into unchecked group", await seq("b3", ["ArrowLeft"]));
out("  checked", await checked(["s", "m", "l"]));
await reset();

// 2. Arrows inside and at the edges of the group
out(
  "Right x4 from left",
  await seq("left", ["ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight"]),
);
out("  checked", await checked(["left", "center", "right"]));
await reset();
out("Left x3 from right", await seq("right", ["ArrowLeft", "ArrowLeft", "ArrowLeft"]));
out("  checked", await checked(["left", "center", "right"]));
await reset();
out(
  "Down x4 from left (perpendicular)",
  await seq("left", ["ArrowDown", "ArrowDown", "ArrowDown", "ArrowDown"]),
);
out("  checked", await checked(["left", "center", "right"]));
await reset();
out("Up from left", await seq("left", ["ArrowUp"]));
out("  checked", await checked(["left", "center", "right"]));
await reset();
out("Home / End from center", await seq("center", ["Home", "End"]));
out("  checked", await checked(["left", "center", "right"]));
await reset();
out(
  "Right x4 from s (unchecked group)",
  await seq("s", ["ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight"]),
);
out("  checked", await checked(["s", "m", "l"]));
await reset();

// 3. Tab / Shift+Tab from a radio
out("Tab from center (checked)", await seq("center", ["Tab"]));
await reset();
out("Tab from left (unchecked)", await seq("left", ["Tab"]));
await reset();
out("Shift+Tab from center (checked)", await seq("center", ["Shift+Tab"]));
await reset();
out("Shift+Tab from right (unchecked)", await seq("right", ["Shift+Tab"]));
await reset();
out("Tab from s (unchecked group)", await seq("s", ["Tab"]));
await reset();
out("Tab from m (unchecked group, middle)", await seq("m", ["Tab"]));
await reset();
out("Shift+Tab from l (unchecked group)", await seq("l", ["Shift+Tab"]));
await reset();
out("Tab x6 from b1", await seq("b1", ["Tab", "Tab", "Tab", "Tab", "Tab", "Tab"]));
await reset();

// 4. Entry from outside
out("Tab from before (fresh memory?)", await seq("before", ["Tab"]));
await page.focus("#center");
await page.keyboard.press("ArrowRight"); // memory on 'right'
out("Tab from before after arrowing to right", await seq("before", ["Tab"]));
await reset();
await page.focus("#m");
out("Tab from before after focusing m", await seq("before", ["Tab"]));
await reset();
out("Shift+Tab from after", await seq("after", ["Shift+Tab"]));

// 5. Vertical toolbar
out("vertical: Down x3 from v1", await seq("v1", ["ArrowDown", "ArrowDown", "ArrowDown"]));
out("  checked", await checked(["va", "vb"]));
await reset();
out("vertical: Right from va (perpendicular)", await seq("va", ["ArrowRight", "ArrowLeft"]));
out("  checked", await checked(["va", "vb"]));
await reset();
out("vertical: Up from v2", await seq("v2", ["ArrowUp", "ArrowUp"]));
out("  checked", await checked(["va", "vb"]));
await reset();
out("vertical: Tab from va / vb", (await seq("va", ["Tab"])) + " | " + (await seq("vb", ["Tab"])));

await browser.close();

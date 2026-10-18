// focusgroup="toolbar" with a text input in the middle: Tab / Shift+Tab from the input (2026-10-18, Chromium only).
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const browser = await pw.chromium.launch();
const page = await browser.newPage();
await page.setContent(`<button id="before">before</button>
<div focusgroup="toolbar" aria-label="t"><button id="a">a</button><input id="in" aria-label="in" value="x"><button id="b">b</button><button id="c">c</button></div>
<button id="after">after</button>
<div focusgroup="toolbar" aria-label="t2"><button id="m">menu</button><button id="n">n</button></div>`);
const active = () => page.evaluate(() => document.activeElement.id);
const seq = async (start, keys) => { await page.focus("#" + start); const r = [await active()]; for (const k of keys) { await page.keyboard.press(k); r.push(k + ">" + (await active())); } return r.join(" "); };
console.log("chromium", browser.version());
console.log("Tab x3 from before          ", await seq("before", ["Tab", "Tab", "Tab"]));
console.log("Tab from in, then Tab       ", await seq("in", ["Tab", "Tab"]));
console.log("Shift+Tab from in           ", await seq("in", ["Shift+Tab", "Shift+Tab"]));
console.log("Right from a into in, Right ", await seq("a", ["ArrowRight", "ArrowRight", "ArrowRight"]));
console.log("Left from b                 ", await seq("b", ["ArrowLeft", "ArrowLeft"]));
// ArrowDown on an item that handles it (menu trigger pattern) in a horizontal toolbar
await page.evaluate(() => document.getElementById("m").addEventListener("keydown", (e) => { if (e.key === "ArrowDown") { e.preventDefault(); window.__opened = true; } }));
console.log("ArrowDown on m (handled)    ", await seq("m", ["ArrowDown"]), await page.evaluate(() => window.__opened));
await browser.close();

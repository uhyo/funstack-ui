// Positioning wave 11 research (#53), 2026-10-22. Run: node anchor-insets-rtl.mjs
// Does placing with anchor() insets (instead of position-area) avoid the Firefox RTL-parent bug,
// including centred alignment and flips? Anchor 200x30, popup 120x40. Each case compares the
// popup rect in an RTL parent with the same case in an LTR parent (which both engines get right),
// position-anchor:auto is required: since "normal" (151) the implicit anchor only applies with a
// position-area. For an anchor in the middle of the viewport and one near the right/bottom edge (forces flips).
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const F = "position-try-fallbacks:flip-block,flip-inline,flip-block flip-inline";
const variants = {
  "area bottom span-right": `position-area:bottom span-right;${F}`,
  "area bottom": `position-area:bottom;${F}`,
  "insets bottom/start": `top:anchor(bottom);left:anchor(left);${F}`,
  "insets bottom/end": `top:anchor(bottom);right:anchor(right);${F}`,
  "insets bottom/center (anchor-center)": `top:anchor(bottom);justify-self:anchor-center;${F}`,
  "insets bottom/center (left:anchor(center)-60px)": `top:anchor(bottom);left:calc(anchor(center) - 60px);${F}`,
  "insets right/center (anchor-center)": `left:anchor(right);align-self:anchor-center;${F}`,
};
const anchors = { mid: "left:300px;top:200px", "bottom-right edge": "left:590px;top:540px" };
const results = {};
for (const name of ["chromium", "firefox"]) {
  const browser = await pw[name].launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const out = { version: browser.version() };
  for (const [vl, css] of Object.entries(variants)) for (const [al, apos] of Object.entries(anchors)) {
    const r = {};
    for (const dir of ["ltr", "rtl"]) {
      await page.setContent(`<!doctype html><style>body{margin:0}#a{position:absolute;${apos};width:200px;height:30px;margin:0;padding:0;border:0}
#p{padding:0;border:0;width:120px;height:40px;margin:0;inset:auto;position-anchor:auto;${css}}</style>
<div dir="${dir}"><button id="a"></button><div id="p" popover="manual"></div></div>`);
      r[dir] = await page.evaluate(() => {
        const a = document.getElementById("a"), p = document.getElementById("p");
        p.showPopover({ source: a });
        const b = p.getBoundingClientRect();
        p.hidePopover();
        return `${b.left},${b.top}`;
      });
    }
    out[`${vl} @ ${al}`] = `ltr ${r.ltr}  rtl ${r.rtl}  ${r.ltr === r.rtl ? "same" : "DIFFERENT"}`;
  }
  results[name] = out;
  await browser.close();
}
for (const [b, o] of Object.entries(results)) { console.log("==", b, o.version); for (const [k, v] of Object.entries(o)) if (k !== "version") console.log(k.padEnd(62), v); }

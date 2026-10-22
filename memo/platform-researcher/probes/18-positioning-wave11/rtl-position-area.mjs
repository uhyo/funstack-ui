// Positioning wave 11 research (#53), 2026-10-22. Run: node rtl-position-area.mjs
// Which direction do logical position-area keywords on a top-layer popover resolve against?
// Anchor: 200px-wide button at x=300..500. Popup: 120px wide, popover="manual", implicit anchor
// via showPopover({ source }). "L" = popup left edge == anchor left (300, the LTR result of
// "span-inline-end"), "R" = popup right edge == anchor right (left == 380, the RTL result).
// Note: the grammar does not allow mixing groups ("block-end span-self-inline-end" is invalid).
// Each value is checked with CSS.supports and the style is reset between cases.
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const areas = [
  "block-end span-inline-end", // containing block's writing mode
  "self-block-end span-self-inline-end", // popup's own writing mode
  "bottom span-x-end", // containing block's direction, physical axis
  "bottom span-self-x-end", // own direction, physical axis
  "end span-end", // short form, containing block
  "self-end span-self-end", // short form, own
  "bottom span-right", // physical control (always L)
];
const setups = {
  "ltr page": {},
  "html dir=rtl": { html: "rtl" },
  "html ltr, body style direction:rtl": { body: "rtl" },
  "container dir=rtl, popup inside container": { container: "rtl" },
  "container dir=rtl, popup outside container (ltr)": { container: "rtl", popupOutside: true },
  "container dir=rtl, popup inside, popup dir=ltr": { container: "rtl", popup: "ltr" },
  "ltr page, popup dir=rtl only": { popup: "rtl" },
  "ltr page, popup style direction:rtl": { popupStyle: "direction:rtl" },
  "html dir=rtl, popup dir=ltr": { html: "rtl", popup: "ltr" },
  "container dir=rtl, popup inside, UA inset/margin (no inset:auto)": { container: "rtl", uaInset: true },
  "ltr page, popup dir=rtl, UA inset/margin": { popup: "rtl", uaInset: true },
};
const results = {};
for (const name of ["chromium", "firefox"]) {
  const browser = await pw[name].launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const out = { version: browser.version() };
  for (const [label, s] of Object.entries(setups)) {
    const popup = `<div id="p" popover="manual" ${s.popup ? `dir="${s.popup}"` : ""} ${s.popupStyle ? `style="${s.popupStyle}"` : ""}></div>`;
    const html = `<!doctype html><html ${s.html ? `dir="${s.html}"` : ""}><style>
body{margin:0} #c{position:absolute;left:0;top:0;width:800px;height:100px}
#a{position:absolute;left:300px;top:20px;width:200px;height:30px;margin:0;padding:0;border:0}
#p{padding:0;border:0;width:120px;height:40px;${s.uaInset ? "" : "margin:0;inset:auto"}}
</style><body ${s.body ? `style="direction:${s.body}"` : ""}><div id="c" ${s.container ? `dir="${s.container}"` : ""}>
<button id="a"></button>${s.popupOutside ? "" : popup}</div>${s.popupOutside ? popup : ""}</body></html>`;
    await page.setContent(html);
    out[label] = await page.evaluate((areas) => {
      const a = document.getElementById("a"), p = document.getElementById("p");
      const r = { popupDir: getComputedStyle(p).direction };
      for (const area of areas) {
        if (!CSS.supports("position-area", area)) { r[area] = "UNSUPPORTED"; continue; }
        p.style.positionArea = area;
        p.showPopover({ source: a });
        const left = p.getBoundingClientRect().left;
        r[area] = `${left} ${left === 300 ? "L" : left === 380 ? "R" : "?"}`;
        p.hidePopover();
        p.style.positionArea = "";
      }
      return r;
    }, areas);
  }
  results[name] = out;
  await browser.close();
}
console.log(JSON.stringify(results, null, 1));

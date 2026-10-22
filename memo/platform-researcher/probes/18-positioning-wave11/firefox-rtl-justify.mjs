// Positioning wave 11 research (#53), 2026-10-22. Run: node firefox-rtl-justify.mjs
// Matrix: physical position-area x explicit justify-self, popup's DOM parent LTR vs RTL, plus a
// display:contents dir="ltr" wrapper around the popup. Anchor x=300..500, popup 120 wide.
// Reports "ok" when the left edge equals the LTR expectation for the area with justify-self normal:
// bottom span-right 300, bottom span-left 380, bottom 340, right(+span-bottom) 500, left 180.
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const areas = { "bottom span-right": 300, "bottom span-left": 380, "bottom": 340, "right span-bottom": 500, "left span-bottom": 180 };
const justifies = ["normal", "start", "end", "left", "right", "self-start", "center", "anchor-center", "stretch"];
const parents = {
  ltr: (p) => `<div>${p}</div>`,
  rtl: (p) => `<div dir="rtl">${p}</div>`,
  "rtl + contents ltr wrapper": (p) => `<div dir="rtl"><div dir="ltr" style="display:contents">${p}</div></div>`,
};
const results = {};
for (const name of ["chromium", "firefox"]) {
  const browser = await pw[name].launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const out = { version: browser.version() };
  for (const [pl, wrap] of Object.entries(parents)) {
    for (const [area, expect] of Object.entries(areas)) {
      const row = [];
      for (const j of justifies) {
        const html = `<!doctype html><style>body{margin:0}#a{position:absolute;left:300px;top:200px;width:200px;height:30px;margin:0;padding:0;border:0}
#p{padding:0;border:0;width:120px;height:40px;margin:0;inset:auto}</style>
<button id="a"></button>` + wrap(`<div id="p" popover="manual" style="position-area:${area};justify-self:${j}"></div>`);
        await page.setContent(html);
        const left = await page.evaluate(() => {
          const a = document.getElementById("a"), p = document.getElementById("p");
          p.showPopover({ source: a });
          const r = p.getBoundingClientRect().left;
          p.hidePopover();
          return r;
        });
        row.push(`${j}=${left}${left === expect ? "" : "!"}`);
      }
      out[`${pl} | ${area}`] = row.join(" ");
    }
  }
  results[name] = out;
  await browser.close();
}
for (const [b, o] of Object.entries(results)) { console.log("==", b, o.version); for (const [k, v] of Object.entries(o)) if (k !== "version") console.log(k.padEnd(45), v); }

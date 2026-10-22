// Positioning wave 11 research (#53), 2026-10-22. Run: node firefox-rtl-parent.mjs
// Isolates the Firefox misplacement seen in rtl-position-area.mjs: a top-layer popover whose DOM
// parent is RTL. Anchor at x=300..500 (200 wide), popup 120 wide. Expected left edge for
// "bottom span-right" (physical): 300. Container 800 wide unless stated.
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const cases = {
  "anchor ltr, popup in rtl div (abs container)": `<div style="position:absolute;left:0;top:0;width:800px;height:100px"><button id="a"></button></div><div dir="rtl" style="position:absolute;left:0;top:200px;width:800px;height:10px">POPUP</div>`,
  "anchor+popup in rtl div, static container": `<div dir="rtl"><button id="a"></button>POPUP</div>`,
  "anchor+popup in rtl div 400px wide, static": `<div dir="rtl" style="width:400px"><button id="a"></button>POPUP</div>`,
  "anchor+popup in rtl span (inline)": `<div><span dir="rtl"><button id="a"></button>POPUP</span></div>`,
  "popup in rtl div, anchor-name instead of source": `<div dir="rtl"><button id="a" style="anchor-name:--x"></button>POPUP</div>`,
  "popup in rtl div, anchor() insets instead of position-area": `<div dir="rtl"><button id="a" style="anchor-name:--x"></button>POPUP</div>`,
  "popup in rtl div, popover with position:fixed+left:auto only": `<div dir="rtl"><button id="a"></button>POPUP</div>`,
};
const results = {};
for (const name of ["chromium", "firefox"]) {
  const browser = await pw[name].launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const out = { version: browser.version() };
  for (const [label, body] of Object.entries(cases)) {
    let pstyle = "position-area:bottom span-right";
    if (label.includes("anchor-name")) pstyle = "position-anchor:--x;position-area:bottom span-right";
    if (label.includes("anchor() insets")) pstyle = "position-anchor:--x;top:anchor(bottom);left:anchor(left)";
    if (label.includes("left:auto only")) pstyle = "position-area:none;top:50px;left:auto;right:auto";
    const html = `<!doctype html><style>body{margin:0}#a{position:absolute;left:300px;top:20px;width:200px;height:30px;margin:0;padding:0;border:0}
#p{padding:0;border:0;width:120px;height:40px;margin:0;inset:auto}</style>` +
      body.replace("POPUP", `<div id="p" popover="manual" style="${pstyle}"></div>`);
    await page.setContent(html);
    out[label] = await page.evaluate(() => {
      const a = document.getElementById("a"), p = document.getElementById("p");
      p.showPopover({ source: a });
      const ar = a.getBoundingClientRect(), pr = p.getBoundingClientRect();
      const r = `anchor ${ar.left}..${ar.right}, popup left ${pr.left} top ${pr.top}`;
      p.hidePopover();
      return r;
    });
  }
  results[name] = out;
  await browser.close();
}
console.log(JSON.stringify(results, null, 1));

// Positioning wave 11 research (#53), 2026-10-22. Run: node firefox-rtl-workarounds.mjs
// Firefox: a position-area popup whose DOM parent is RTL is misplaced (firefox-rtl-parent.mjs).
// Try workarounds. Anchor x=300..500, popup 120 wide, inside <div dir="rtl">.
// Expected left edge: "bottom span-right" -> 300, "bottom span-left" -> 380, "bottom" -> 340,
// "self-block-end span-self-inline-end" with an RTL popup -> 380.
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const cases = [
  ["bottom span-right", ""],
  ["bottom span-left", ""],
  ["bottom", ""],
  ["self-block-end span-self-inline-end", ""],
  ["bottom span-right", "justify-self:start"],
  ["bottom span-right", "justify-self:left"],
  ["bottom span-right", "justify-self:self-start"],
  ["bottom span-left", "justify-self:right"],
  ["bottom", "justify-self:anchor-center"],
  ["bottom span-right", "left:0;right:0"],
  ["bottom span-right", "left:0"],
  ["bottom span-right", "right:0"],
  ["bottom span-left", "right:0"],
  ["self-block-end span-self-inline-end", "left:0"],
  ["bottom span-right", "direction:ltr"],
  ["bottom span-right", "unicode-bidi:isolate;direction:ltr"],
];
const results = {};
for (const name of ["chromium", "firefox"]) {
  const browser = await pw[name].launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const out = { version: browser.version() };
  for (const [area, extra] of cases) {
    const html = `<!doctype html><style>body{margin:0}#a{position:absolute;left:300px;top:20px;width:200px;height:30px;margin:0;padding:0;border:0}
#p{padding:0;border:0;width:120px;height:40px;margin:0;inset:auto}</style>
<div dir="rtl"><button id="a"></button><div id="p" popover="manual" style="position-area:${area};${extra}"></div></div>`;
    await page.setContent(html);
    out[`${area} + {${extra}}`] = await page.evaluate(() => {
      const a = document.getElementById("a"), p = document.getElementById("p");
      p.showPopover({ source: a });
      const r = p.getBoundingClientRect().left;
      p.hidePopover();
      return r;
    });
  }
  results[name] = out;
  await browser.close();
}
console.log(JSON.stringify(results, null, 1));

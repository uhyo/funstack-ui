// Positioning wave 11 research (#53), 2026-10-22. Run: node firefox-rtl-wrapper.mjs
// Which ancestor's direction triggers the Firefox position-area misplacement? Anchor x=300..500,
// popup 120 wide, "bottom span-right" (expected left 300) and "bottom" (expected 340).
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const P = `<div id="p" popover="manual"></div>`;
const cases = {
  "rtl div > popup": `<div dir="rtl">${P}</div>`,
  "rtl div > ltr block div > popup": `<div dir="rtl"><div dir="ltr">${P}</div></div>`,
  "rtl div > ltr contents div > popup": `<div dir="rtl"><div dir="ltr" style="display:contents">${P}</div></div>`,
  "rtl div > ltr abs span > popup": `<div dir="rtl"><span dir="ltr" style="position:absolute">${P}</span></div>`,
  "rtl div > ltr inline span > popup": `<div dir="rtl"><span dir="ltr">${P}</span></div>`,
  "ltr div > rtl inline span > popup": `<div><span dir="rtl">${P}</span></div>`,
  "rtl div > ltr flex div > popup": `<div dir="rtl"><div dir="ltr" style="display:flex">${P}</div></div>`,
  "html rtl, ltr div > popup": `<div dir="ltr">${P}</div>`,
};
const results = {};
for (const name of ["chromium", "firefox"]) {
  const browser = await pw[name].launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const out = { version: browser.version() };
  for (const [label, body] of Object.entries(cases)) {
    const r = [];
    for (const area of ["bottom span-right", "bottom"]) {
      await page.setContent(`<!doctype html><html${label.startsWith("html rtl") ? ' dir="rtl"' : ""}><style>body{margin:0}#a{position:absolute;left:300px;top:200px;width:200px;height:30px;margin:0;padding:0;border:0}
#p{padding:0;border:0;width:120px;height:40px;margin:0;inset:auto;position-area:${area}}</style><button id="a"></button>${body}</html>`);
      r.push(`${area}=${await page.evaluate(() => {
        const a = document.getElementById("a"), p = document.getElementById("p");
        p.showPopover({ source: a });
        const l = p.getBoundingClientRect().left;
        p.hidePopover();
        return l;
      })}`);
    }
    out[label] = r.join("  ");
  }
  results[name] = out;
  await browser.close();
}
for (const [b, o] of Object.entries(results)) { console.log("==", b, o.version); for (const [k, v] of Object.entries(o)) if (k !== "version") console.log(k.padEnd(40), v); }
console.log("expected: bottom span-right=300 bottom=340 (html rtl case: span-right still 300, bottom 340)");

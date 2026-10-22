// Context menu research (#45), 2026-10-22. Run: node anchor-transform.mjs
// The virtual anchor is a zero-size position:fixed <span> inside the trigger region. When an
// ancestor has a transform, the span's containing block is that ancestor, and anchor positioning
// may or may not follow the transform. Where does the popover land for a click at (300, 250)?
//  T1 translate(50px,30px) on the region, span left/top = client point (naive)
//  T2 same, span corrected so that its getBoundingClientRect() equals the client point
//  T3 scale(1.5) on the region (origin 0 0), corrected
//  T4 no transform, but region inside a `contain: layout` / `filter` ancestor (also a fixed CB)
//  T5 span rendered outside the region, as a sibling of the popover at <body> level (no transform)
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const html = `<!doctype html><style>body{margin:0}
.region{position:absolute;left:100px;top:100px;width:400px;height:300px;background:#eee;transform-origin:0 0}
.a{position:fixed;width:0;height:0}
.m{margin:0;padding:0;border:0;width:100px;height:60px;inset:auto;position-area:bottom right;position-try-fallbacks:flip-block,flip-inline,flip-block flip-inline}
</style>
<div class="region" id="r1" style="transform:translate(50px,30px)"><span class="a" id="a1"></span></div>
<div class="region" id="r3" style="transform:scale(1.5);display:none"><span class="a" id="a3"></span></div>
<div class="region" id="r4" style="filter:blur(0);display:none"><span class="a" id="a4"></span></div>
<span class="a" id="a5"></span>
<div class="m" id="m" popover="auto"></div>`;
for (const name of ["chromium", "firefox"]) {
  const browser = await pw[name].launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  await page.setContent(html);
  const out = { version: browser.version() };
  out.res = await page.evaluate(() => {
    const X = 300, Y = 250, m = document.getElementById("m"), r = {};
    const place = (a, correct) => {
      a.style.left = X + "px"; a.style.top = Y + "px";
      if (correct) { const b = a.getBoundingClientRect(); a.style.left = X + (X - b.left) + "px"; a.style.top = Y + (Y - b.top) + "px"; }
      const b2 = a.getBoundingClientRect();
      m.showPopover({ source: a }); const mb = m.getBoundingClientRect(); m.hidePopover();
      return { anchorRect: [Math.round(b2.left), Math.round(b2.top)], popup: [Math.round(mb.left), Math.round(mb.top)] };
    };
    const show = (id, on) => (document.getElementById(id).style.display = on ? "" : "none");
    r.T1_translate_naive = place(document.getElementById("a1"), false);
    r.T2_translate_corrected = place(document.getElementById("a1"), true);
    show("r1", false); show("r3", true);
    r.T3_scale_corrected = place(document.getElementById("a3"), true);
    show("r3", false); show("r4", true);
    r.T4_filter_naive = place(document.getElementById("a4"), false);
    r.T4_filter_corrected = place(document.getElementById("a4"), true);
    show("r4", false);
    r.T5_outside = place(document.getElementById("a5"), false);
    return r;
  });
  out.wanted = "popup at [300,250]";
  console.log(JSON.stringify(out));
  await browser.close();
}

// Context menu research (#45), 2026-10-22. Run: node anchor-point.mjs
// Placing a popover="auto" at a point with viewport-edge flipping. Viewport 800x600, menu 120x80.
// S1 virtual anchor: zero-size position:fixed <span> at the point with anchor-name, popover
//    position-anchor + position-area + position-try-fallbacks.
// S2 same span as implicit anchor via showPopover({ source: span }) (no anchor-name).
// S3 no anchor: left/top at the point + position-try-fallbacks: flip-block, flip-inline.
// S4 no anchor: left/top from custom properties + @position-try rules that mirror around the point.
// S5 virtual anchor position:absolute inside a scrolled container (does the menu follow scroll?).
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const html = `<!doctype html><style>
body{margin:0;height:3000px}
.m{margin:0;padding:0;border:0;width:120px;height:80px;inset:auto}
#a{position:fixed;width:0;height:0;anchor-name:--cm}
#a2{position:fixed;width:0;height:0}
#m1{position-anchor:--cm;position-area:bottom right;position-try-fallbacks:flip-block,flip-inline,flip-block flip-inline}
#m2{position-area:bottom right;position-try-fallbacks:flip-block,flip-inline,flip-block flip-inline}
#m3{position:fixed;position-try-fallbacks:flip-block,flip-inline,flip-block flip-inline}
@position-try --up{top:auto;bottom:calc(100% - var(--y))}
@position-try --left{left:auto;right:calc(100% - var(--x))}
@position-try --upleft{top:auto;bottom:calc(100% - var(--y));left:auto;right:calc(100% - var(--x))}
#m4{position:fixed;left:var(--x);top:var(--y);position-try-fallbacks:--up,--left,--upleft}
#scroller{position:absolute;left:0;top:0;width:400px;height:300px;overflow:auto}
#scroller>div{height:2000px;position:relative}
#a5{position:absolute;width:0;height:0;anchor-name:--cm5}
#m5{position-anchor:--cm5;position-area:bottom right}
</style>
<span id="a"></span><span id="a2"></span>
<div id="scroller"><div><span id="a5"></span></div></div>
<div id="m1" class="m" popover="auto"></div><div id="m2" class="m" popover="auto"></div>
<div id="m3" class="m" popover="auto"></div><div id="m4" class="m" popover="auto"></div>
<div id="m5" class="m" popover="auto"></div>`;
const points = [[200, 200], [780, 200], [200, 580], [780, 580]];
for (const name of ["chromium", "firefox"]) {
  const browser = await pw[name].launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.setContent(html);
  const out = { version: browser.version() };
  for (const [x, y] of points) {
    out[`${x},${y}`] = await page.evaluate(([x, y]) => {
      const r = {};
      const rect = (el) => { const b = el.getBoundingClientRect(); return `${b.left},${b.top}`; };
      const a = document.getElementById("a"), a2 = document.getElementById("a2");
      a.style.left = a2.style.left = x + "px"; a.style.top = a2.style.top = y + "px";
      const m1 = document.getElementById("m1"); m1.showPopover(); r.S1 = rect(m1); m1.hidePopover();
      const m2 = document.getElementById("m2"); m2.showPopover({ source: a2 }); r.S2 = rect(m2); m2.hidePopover();
      const m3 = document.getElementById("m3"); m3.style.left = x + "px"; m3.style.top = y + "px"; m3.showPopover(); r.S3 = rect(m3); m3.hidePopover();
      const m4 = document.getElementById("m4"); m4.style.setProperty("--x", x + "px"); m4.style.setProperty("--y", y + "px"); m4.showPopover(); r.S4 = rect(m4); m4.hidePopover();
      return r;
    }, [x, y]);
  }
  out.expected = { "200,200": "200,200", "780,200": "660,200", "200,580": "200,500", "780,580": "660,500" };
  out.S5_scroll = await page.evaluate(async () => {
    const a5 = document.getElementById("a5"); a5.style.left = "100px"; a5.style.top = "100px";
    const m5 = document.getElementById("m5"); m5.showPopover();
    const before = m5.getBoundingClientRect().top;
    document.getElementById("scroller").scrollTop = 50;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const after = m5.getBoundingClientRect().top;
    m5.hidePopover();
    return { before, after };
  });
  console.log(JSON.stringify(out));
  await browser.close();
}

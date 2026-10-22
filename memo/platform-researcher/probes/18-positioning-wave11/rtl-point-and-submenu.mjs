// Positioning wave 11 research (#88, #53), 2026-10-22. Run: node rtl-point-and-submenu.mjs
// 1. RTL point placement: the menu's right edge at the point (right: calc(100% - x)), with
//    @position-try options mirrored (up; rightward; both), inside an RTL container vs RTL page.
//    Menu 120x80, viewport 800x600. Expected left,top: (200,200)->80,200; (50,200)->50,200 (flip
//    rightward); (200,580)->80,500; (50,580)->50,500.
// 2. Submenu side "inline-end" spelled self-x-end span-bottom with flip-inline: anchor (the
//    SubmenuTrigger) at x=300..500, y=200..230; submenu 120 wide. Expected left: LTR 500,
//    RTL 180; anchor at x=20..220 in RTL (no room on the left) -> 220.
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const rules = `@position-try --up{top:auto;bottom:calc(100% - var(--y))}
@position-try --right{right:auto;left:var(--x)}
@position-try --upright{top:auto;bottom:calc(100% - var(--y));right:auto;left:var(--x)}`;
const results = {};
for (const name of ["chromium", "firefox"]) {
  const browser = await pw[name].launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const out = { version: browser.version() };
  for (const where of ["rtl container", "rtl page"]) for (const pt of [[200, 200], [50, 200], [200, 580], [50, 580], null]) {
    await page.setContent(`<!doctype html><html${where === "rtl page" ? ' dir="rtl"' : ""}><style>body{margin:0}${rules}
#m{margin:0;padding:0;border:0;width:120px;height:80px;inset:auto;top:var(--y);right:calc(100% - var(--x));left:auto;bottom:auto;
position-try-fallbacks:--up,--right,--upright}
#a{position:absolute;top:200px;height:30px;width:200px;margin:0;padding:0;border:0}
#s{margin:0;padding:0;border:0;width:120px;height:40px;inset:auto;position-area:self-x-end span-bottom;position-try-fallbacks:flip-inline}
</style><div dir="rtl"><div id="m" popover="manual"></div><button id="a"></button><div id="s" popover="manual"></div></div></html>`);
    // One document per point: a same-task re-show keeps the previous fallback (context-menu research).
    Object.assign((out[where] ??= {}), await page.evaluate((pt) => {
      const m = document.getElementById("m"), a = document.getElementById("a"), s = document.getElementById("s");
      const r = {};
      if (pt) {
        const [x, y] = pt;
        m.style.setProperty("--x", x + "px"); m.style.setProperty("--y", y + "px");
        m.showPopover(); const b = m.getBoundingClientRect(); r[`point ${x},${y}`] = `${b.left},${b.top}`; m.hidePopover();
        return r;
      }
      for (const left of [300, 20]) {
        a.style.left = left + "px";
        s.showPopover({ source: a }); r[`submenu anchor ${left}..${left + 200}`] = s.getBoundingClientRect().left; s.hidePopover();
      }
      return r;
    }, pt));
  }
  results[name] = out;
  await browser.close();
}
console.log(JSON.stringify(results, null, 1));

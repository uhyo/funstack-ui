// Positioning wave 11 research (#20), 2026-10-22. Run: node resolved-side-timing.mjs
// When does getComputedStyle(popup).positionArea reflect the applied fallback? Popup requested on
// top (position-area: top span-right) with flip-block / flip-inline fallbacks; the trigger sits at
// the top-right corner so the popup flips both ways ("bottom span-left").
// Reads: synchronously after showPopover(), after getBoundingClientRect(), in the "toggle" event,
// in the next rAF. Then a scroll moves the trigger down so "top" fits again: read in the scroll
// event, after a forced layout in the scroll event, in the next rAF. (A scroll that merely makes
// "top" fit again changes nothing: the last successful option is kept while it fits, so the scroll
// moves the trigger to the bottom edge where the flipped option no longer fits.) Also: the FX arrow with
// position-anchor: --t (trigger as default anchor, so its anchor() refs are scroll-compensated).
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const html = `<!doctype html><style>
body{margin:0;height:3000px;padding-top:1000px}
#t{position:absolute;left:740px;top:1005px;width:50px;height:30px;margin:0;padding:0;border:0;anchor-name:--t}
#p{padding:0;border:0;width:120px;height:40px;inset:auto;margin:0;overflow:visible;anchor-name:--p;
  position-area:top span-right;position-try-fallbacks:flip-block,flip-inline,flip-block flip-inline}
#fx{position:fixed;width:8px;height:8px;position-anchor:--t;
  left:calc(clamp(anchor(--p left), anchor(--t center), anchor(--p right)) - 4px);
  top:calc(clamp(anchor(--p top), anchor(--t center), anchor(--p bottom)) - 4px)}
</style><button id="t"></button><div id="p" popover="manual"><span id="fx"></span></div>`;
const results = {};
for (const name of ["chromium", "firefox"]) {
  const browser = await pw[name].launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.setContent(html);
  results[name] = { version: browser.version(), ...(await page.evaluate(async () => {
    const t = document.getElementById("t"), p = document.getElementById("p"), fx = document.getElementById("fx");
    const area = () => getComputedStyle(p).positionArea;
    const fxc = () => { const b = fx.getBoundingClientRect(), pr = p.getBoundingClientRect(), tr = t.getBoundingClientRect();
      return `arrow ${b.left + 4},${b.top + 4} popup ${pr.left},${pr.top}..${pr.bottom} trigger centre ${tr.left + 25},${tr.top}..${tr.bottom}`; };
    const r = {};
    window.scrollTo(0, 1000); // trigger at viewport y=5: no room above
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    const toggled = new Promise((res) => p.addEventListener("toggle", () => { r.inToggleEvent = area(); res(); }, { once: true }));
    p.showPopover({ source: t });
    r.syncAfterShow = area();
    p.getBoundingClientRect();
    r.afterLayout = area();
    await toggled;
    await new Promise((res) => requestAnimationFrame(res));
    r.nextFrame = area();
    r.fxAfterOpen = fxc();
    const scrolled = new Promise((res) => addEventListener("scroll", () => {
      r.inScrollEvent = area();
      p.getBoundingClientRect();
      r.inScrollEventAfterLayout = area();
      res();
    }, { once: true }));
    window.scrollTo(0, 435); // trigger at viewport y=570: bottom no longer fits, top does
    await scrolled;
    await new Promise((res) => requestAnimationFrame(res));
    r.frameAfterScroll = area();
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    r.twoFramesAfterScroll = area();
    r.fxAfterScroll = fxc();
    return r;
  })) };
  await browser.close();
}
console.log(JSON.stringify(results, null, 1));

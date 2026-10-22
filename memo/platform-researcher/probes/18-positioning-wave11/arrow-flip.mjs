// Positioning wave 11 research (#20), 2026-10-22. Run: node arrow-flip.mjs
// Can an arrow (or JS) learn which position-try fallback applied? Tooltip-like popup requested on
// top of its trigger (position-area: top), fallbacks flip-block etc. Trigger 100x30, popup
// 120x40, 8px gap through margin-bottom (flip-block turns it into margin-top).
// Scenarios: "fits" (trigger at y=300, popup above), "flipped" (trigger at y=5, popup below),
// "scrolled" (trigger at y=300 in a 3000px page, open, then scroll 290px so it is near the top).
// Techniques, each reporting where the arrow centre ends up (expected: on the popup edge that
// faces the trigger, x at the trigger centre):
//  CS  getComputedStyle(popup): position-area, margin-top/-bottom after the flip.
//  CQ  container-type: anchored on the popup + @container anchored(fallback: flip-block).
//  MG  margin trick: popup margin-block "auto <gap>" (the auto side away from the trigger, used as
//      0 under position-area); flip-block swaps it; the arrow inherits margin-block and sits at the
//      non-auto end of a symmetric strip.
//  FX  position:fixed arrow (child of the popup) placed with anchor() against the trigger
//      (anchor-name --t) and the popup (anchor-name --p): centre = popup box clamped to trigger
//      centre per axis.
//  AB  position:absolute arrow (CB = popup) with anchor(--t ...): expected unacceptable anchor.
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const css = `
body{margin:0;height:3000px}
#t{position:absolute;left:340px;width:100px;height:30px;margin:0;padding:0;border:0;anchor-name:--t}
#p{padding:0;border:0;width:120px;height:40px;inset:auto;overflow:visible;
  position-area:top;position-try-fallbacks:flip-block,flip-inline,flip-block flip-inline;
  margin:0;margin-top:auto;margin-bottom:8px;anchor-name:--p;container-type:anchored}
.ar{width:8px;height:8px;padding:0;margin:0;background:red}
/* CQ: default (no fallback) arrow at the bottom edge; flip-block -> top edge. */
#cq{position:absolute;left:56px;top:auto;bottom:-4px}
@container anchored(fallback: flip-block) { #cq{top:-4px;bottom:auto} }
/* MG: symmetric strip around the popup, margins inherited from the popup. */
#mg{position:absolute;left:56px;top:-12px;bottom:-12px;height:8px;margin-block:inherit}
/* FX: fixed, centre = clamp(popup edge, trigger centre, popup edge) per axis. */
#fx{position:fixed;
  left:calc(clamp(anchor(--p left), anchor(--t center), anchor(--p right)) - 4px);
  top:calc(clamp(anchor(--p top), anchor(--t center), anchor(--p bottom)) - 4px)}
/* AB: absolute in the popup, same formula against the trigger only. */
#ab{position:absolute;left:calc(anchor(--t center) - 4px);top:calc(anchor(--t bottom) - 4px)}
`;
const html = `<!doctype html><style>${css}</style><button id="t"></button>
<div id="p" popover="manual"><span class="ar" id="cq"></span><span class="ar" id="mg"></span><span class="ar" id="fx"></span><span class="ar" id="ab"></span></div>`;
const results = {};
for (const name of ["chromium", "firefox"]) {
  const browser = await pw[name].launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.setContent(html);
  const out = { version: browser.version(), supportsAnchored: await page.evaluate(() => CSS.supports("container-type", "anchored")) };
  for (const sc of ["fits", "flipped", "scrolled"]) {
    out[sc] = await page.evaluate(async (sc) => {
      const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const t = document.getElementById("t"), p = document.getElementById("p");
      window.scrollTo(0, 0);
      t.style.top = sc === "flipped" ? "5px" : "300px";
      p.showPopover({ source: t });
      await frame();
      if (sc === "scrolled") { window.scrollTo(0, 290); await frame(); }
      const tr = t.getBoundingClientRect(), pr = p.getBoundingClientRect();
      const cs = getComputedStyle(p);
      const c = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return `${b.left + 4},${b.top + 4}`; };
      const r = {
        trigger: `${tr.left}..${tr.right} x ${tr.top}..${tr.bottom}`,
        popup: `${pr.left}..${pr.right} x ${pr.top}..${pr.bottom} (${pr.bottom <= tr.top ? "above" : pr.top >= tr.bottom ? "below" : "?"})`,
        expectedArrowCentre: `${tr.left + 50},${pr.bottom <= tr.top ? pr.bottom : pr.top}`,
        CS: `position-area=${cs.positionArea} margin-top=${cs.marginTop} margin-bottom=${cs.marginBottom}`,
        CQ: c("cq"), MG: c("mg"), FX: c("fx"), AB: c("ab"),
      };
      p.hidePopover();
      return r;
    }, sc);
  }
  results[name] = out;
  await browser.close();
}
console.log(JSON.stringify(results, null, 1));

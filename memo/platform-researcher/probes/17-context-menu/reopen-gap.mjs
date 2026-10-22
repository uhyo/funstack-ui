// Context menu research (#45), 2026-10-22. Run: node reopen-gap.mjs
// The last successful position option (CSS Anchor Positioning 6.5.1.1) survives a hidePopover()
// + showPopover() in the same task, so a menu re-opened at a new point keeps the previous flip.
// What gap clears it? Popup anchored to a zero-size fixed span via showPopover({ source }).
// First open at (780,580) flips up-left; re-open at (300,250) should be bottom-right: [300,250].
// toggleFallbacksWhileOpen: same task, but the third fallback respelled "flip-inline flip-block".
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const html = `<!doctype html><style>body{margin:0}.a{position:fixed;width:0;height:0}
#m{margin:0;padding:0;border:0;width:120px;height:80px;inset:auto;position-area:bottom right;position-try-fallbacks:flip-block,flip-inline,flip-block flip-inline}</style>
<span class="a" id="a"></span><div id="m" popover="auto"></div>`;
for (const name of ["chromium", "firefox"]) {
  const browser = await pw[name].launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.setContent(html);
  const r = await page.evaluate(async () => {
    const m = document.getElementById("m"), a = document.getElementById("a");
    const raf = () => new Promise((r) => requestAnimationFrame(r));
    const task = () => new Promise((r) => setTimeout(r));
    const setA = (x, y) => { a.style.left = x + "px"; a.style.top = y + "px"; };
    const pos = () => { const b = m.getBoundingClientRect(); return [b.left, b.top]; };
    const out = {};
    const gaps = {
      sameTask: async () => {},
      flushStyle: async () => { getComputedStyle(m).display; m.offsetWidth; },
      oneRaf: raf,
      rafThenTask: async () => { await raf(); await task(); },
      twoRaf: async () => { await raf(); await raf(); },
      moveWhileOpen: null,
      toggleFallbacksWhileOpen: null,
    };
    for (const [k, gap] of Object.entries(gaps)) {
      setA(780, 580); m.showPopover({ source: a }); await raf(); await raf();
      if (k === "moveWhileOpen") { setA(300, 250); await raf(); await raf(); out[k] = pos(); m.hidePopover(); await raf(); await raf(); continue; }
      if (k === "toggleFallbacksWhileOpen") { m.hidePopover(); setA(300, 250); m.style.positionTryFallbacks = "flip-block, flip-inline, flip-inline flip-block"; m.showPopover({ source: a }); out[k + "_sync"] = pos(); await raf(); await raf(); out[k] = pos(); m.hidePopover(); m.style.positionTryFallbacks = ""; await raf(); await raf(); continue; }
      m.hidePopover(); await gap(); setA(300, 250); m.showPopover({ source: a });
      out[k + "_sync"] = pos(); await raf(); await raf(); out[k] = pos();
      m.hidePopover(); await raf(); await raf();
    }
    return out;
  });
  console.log(name, JSON.stringify(r), "wanted [300,250]");
  await browser.close();
}

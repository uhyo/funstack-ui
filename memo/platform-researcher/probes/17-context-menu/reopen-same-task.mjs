// Context menu research (#45), 2026-10-22. Run: node reopen-same-task.mjs
// Same-task hidePopover() + showPopover() at a new point: anchorless @position-try (B) and
// virtual-anchor (A) placement keep the previous fallback (CSS Anchor Positioning 6.5.1.1).
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const html = `<!doctype html><style>body{margin:0}
@position-try --fsui-up{top:auto;bottom:calc(100% - var(--y))}
@position-try --fsui-left{left:auto;right:calc(100% - var(--x))}
@position-try --fsui-upleft{top:auto;bottom:calc(100% - var(--y));left:auto;right:calc(100% - var(--x))}
.a{position:fixed;width:0;height:0}
#m2{position-area:bottom right;position-try-fallbacks:flip-block,flip-inline,flip-block flip-inline}
</style><span class="a" id="a"></span><div id="m" popover="auto" style="margin:0;padding:0;border:0;width:120px;height:80px;inset:auto;left:var(--x);top:var(--y);position-try-fallbacks:--fsui-up,--fsui-left,--fsui-upleft"></div>
<div id="m2" popover="auto" style="margin:0;padding:0;border:0;width:120px;height:80px;inset:auto"></div>`;
for (const name of ["firefox", "chromium"]) {
  const browser = await pw[name].launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.setContent(html);
  const r = await page.evaluate(async () => {
    const raf2 = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const m = document.getElementById("m"), m2 = document.getElementById("m2"), a = document.getElementById("a");
    const out = {};
    // B: same-task reopen at a new point
    const setB = (x, y) => { m.style.setProperty("--x", x + "px"); m.style.setProperty("--y", y + "px"); };
    setB(300, 250); m.showPopover(); await raf2();
    m.hidePopover(); setB(780, 580); m.showPopover();
    out.B_sameTask_sync = [m.getBoundingClientRect().left, m.getBoundingClientRect().top];
    await raf2(); out.B_sameTask_after2raf = [m.getBoundingClientRect().left, m.getBoundingClientRect().top];
    m.hidePopover(); setB(300, 250); m.showPopover();
    out.B_back_sync = [m.getBoundingClientRect().left, m.getBoundingClientRect().top];
    await raf2(); out.B_back_after2raf = [m.getBoundingClientRect().left, m.getBoundingClientRect().top]; m.hidePopover(); await raf2();
    // A: same for the virtual anchor
    const setA = (x, y) => { a.style.left = x + "px"; a.style.top = y + "px"; };
    setA(300, 250); m2.showPopover({ source: a }); await raf2();
    m2.hidePopover(); setA(780, 580); m2.showPopover({ source: a });
    out.A_sameTask_sync = [m2.getBoundingClientRect().left, m2.getBoundingClientRect().top];
    await raf2(); out.A_sameTask_after2raf = [m2.getBoundingClientRect().left, m2.getBoundingClientRect().top];
    m2.hidePopover(); setA(300, 250); m2.showPopover({ source: a });
    out.A_back_sync = [m2.getBoundingClientRect().left, m2.getBoundingClientRect().top];
    await raf2(); out.A_back_after2raf = [m2.getBoundingClientRect().left, m2.getBoundingClientRect().top];
    return out;
  });
  console.log(name, JSON.stringify(r), "expected 780,580 -> [660,500]; 300,250 -> [300,250]");
  await browser.close();
}

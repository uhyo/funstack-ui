// Context menu research (#45), 2026-10-22. Run: node point-try-transform.mjs
// Strategy B: no anchor. The popup (top layer) gets --x/--y and `left/top` from them, with
// document-level @position-try rules mirroring it around the point. The popup's DOM parent is a
// transformed / filtered element. Viewport 800x600, popup 120x80.
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const html = `<!doctype html><style>body{margin:0}
@position-try --fsui-up{top:auto;bottom:calc(100% - var(--y))}
@position-try --fsui-left{left:auto;right:calc(100% - var(--x))}
@position-try --fsui-upleft{top:auto;bottom:calc(100% - var(--y));left:auto;right:calc(100% - var(--x))}
.region{position:absolute;left:100px;top:100px;width:400px;height:300px;transform:translate(50px,30px) scale(1.2)}
</style>
<div class="region" style="filter:blur(0)"><div id="m" popover="auto" style="margin:0;padding:0;border:0;width:120px;height:80px;inset:auto;left:var(--x);top:var(--y);position-try-fallbacks:--fsui-up,--fsui-left,--fsui-upleft"></div></div>`;
for (const name of ["chromium", "firefox"]) {
  const browser = await pw[name].launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.setContent(html);
  const out = { version: browser.version() };
  for (const [x, y] of [[300, 250], [780, 250], [300, 580], [780, 580]]) {
    out[`${x},${y}`] = await page.evaluate(([x, y]) => {
      const m = document.getElementById("m");
      m.style.setProperty("--x", x + "px"); m.style.setProperty("--y", y + "px");
      m.showPopover(); const b = m.getBoundingClientRect(); m.hidePopover();
      return [Math.round(b.left), Math.round(b.top), Math.round(b.width)];
    }, [x, y]);
  }
  out.expected = { "300,250": [300, 250], "780,250": [660, 250], "300,580": [300, 500], "780,580": [660, 500] };
  console.log(JSON.stringify(out));
  await browser.close();
}

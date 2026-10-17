// Dual-thumb via two overlaid native range inputs (pointer-events:none on input, auto on thumb pseudo).
// Also: an opacity:0 native range as the hit surface over custom visuals. Run: node overlay-dual.mjs
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const PAGE = `<style>
 body{margin:0} .wrap{position:relative;width:300px;height:30px;margin:40px}
 .wrap input{position:absolute;inset:0;width:100%;margin:0;appearance:none;background:none;pointer-events:none}
 .wrap input::-webkit-slider-thumb{appearance:none;pointer-events:auto;width:20px;height:20px;background:red}
 .wrap input::-moz-range-thumb{pointer-events:auto;width:20px;height:20px;background:red;border:0;border-radius:0}
 #ghost{opacity:0;position:absolute;left:40px;top:150px;width:300px;margin:0}
</style>
<div class="wrap"><input id="lo" type="range" min="0" max="100" value="20" aria-label="min"><input id="hi" type="range" min="0" max="100" value="80" aria-label="max"></div>
<input id="ghost" type="range" min="0" max="100" value="50" aria-label="ghost">`;
for (const name of ["chromium", "firefox"]) {
  const b = await pw[name].launch(); const p = await b.newPage(); await p.setContent(PAGE);
  const r = {};
  const box = await p.locator(".wrap").boundingBox(); const y = box.y + box.height / 2;
  const x = (v) => box.x + 10 + (box.width - 20) * v / 100; // thumb center for value v (20px thumb)
  // drag lower thumb from 20 to 40
  await p.mouse.move(x(20), y); await p.mouse.down(); await p.mouse.move(x(40), y, { steps: 5 }); await p.mouse.up();
  r.afterDragLo = await p.evaluate(() => [lo.value, hi.value]);
  // drag upper thumb from 80 to 60
  await p.mouse.move(x(80), y); await p.mouse.down(); await p.mouse.move(x(60), y, { steps: 5 }); await p.mouse.up();
  r.afterDragHi = await p.evaluate(() => [lo.value, hi.value]);
  // click on the track between thumbs (no thumb there)
  await p.mouse.click(x(50), y);
  r.afterTrackClick = await p.evaluate(() => [lo.value, hi.value]);
  r.elementAtTrack = await p.evaluate(([X, Y]) => document.elementFromPoint(X, Y)?.id || document.elementFromPoint(X, Y)?.className, [x(50), y]);
  // ghost (opacity 0) input still works with pointer
  const g = await p.locator("#ghost").boundingBox();
  await p.mouse.click(g.x + g.width * 0.8, g.y + g.height / 2);
  r.ghostClickAt80pct = await p.evaluate(() => ghost.value);
  r.ghostFocused = await p.evaluate(() => document.activeElement.id);
  console.log(name, b.version(), JSON.stringify(r)); await b.close();
}

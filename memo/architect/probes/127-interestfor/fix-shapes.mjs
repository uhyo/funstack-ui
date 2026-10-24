// #127 follow-up probe: reliability of the three hide shapes (sync / microtask / task) from a
// `loseinterest` listener, 3 cycles each, with the `toggle` arrival and timings; and the
// slow-open re-hover case with the fix applied (the popup appeared after the pointer left).
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const { chromium } = require("playwright");
const html = `<!doctype html>
<style>
  body { margin: 0; padding: 100px; }
  button { width: 100px; height: 30px; margin-right: 20px; interest-delay: 0s; }
  [popover] { margin: 0; inset: auto; top: 300px; left: 100px; width: 100px; height: 40px; }
</style>
<button id="b" interestfor="p">Interest</button><button id="t">Trigger</button>
<div id="p" popover>pop</div>`;
const setup = `
  window.log = []; window.t0 = performance.now();
  const src = (e) => (e.source ? e.source.id : String(e.source));
  const push = (s) => log.push(Math.round(performance.now() - t0) + "ms " + s);
  for (const type of ["interest", "loseinterest"]) p.addEventListener(type, (e) => {
    push(type + " src=" + src(e) + " open=" + p.matches(":popover-open"));
    if (type === "loseinterest") window.onLoseInterest?.(e);
  });
  for (const type of ["beforetoggle", "toggle"]) p.addEventListener(type, (e) => {
    push(type + " " + e.oldState + "->" + e.newState + " src=" + src(e));
    if (type === "beforetoggle") window.onBeforeToggle?.(e);
  });
  window.opening = false;
  window.show = (source) => { window.opening = true; try { p.showPopover(source ? { source } : undefined); } finally { window.opening = false; } };
  window.setMode = (mode, delay) => {
    window.onBeforeToggle = (e) => { if (e.newState === "open" && !window.opening) { e.preventDefault(); push("cancelled"); setTimeout(() => show(t), delay); } };
    const hideNow = () => { if (p.matches(":popover-open")) { push("lib hidePopover"); try { p.hidePopover(); } catch (err) { push("threw " + err.name); } } else push("lib: not open, skip"); };
    window.onLoseInterest = mode === "sync" ? hideNow : mode === "micro" ? () => queueMicrotask(hideNow) : () => setTimeout(hideNow, 0);
  };
`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch(); const page = await browser.newPage();
await page.setContent(html); await page.evaluate(setup);
const box = await page.locator("#b").boundingBox(); const c = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
for (const mode of ["sync", "micro", "task"]) {
  await page.evaluate((m) => setMode(m, 50), mode);
  for (let i = 1; i <= 3; i++) {
    await page.mouse.move(600, 600); await sleep(100);
    await page.evaluate(() => { if (p.matches(":popover-open")) p.hidePopover(); log.length = 0; t0 = performance.now(); });
    await page.mouse.move(c.x, c.y); await sleep(300);
    await page.mouse.move(600, 600); await sleep(700);
    const r = await page.evaluate(() => ({ open: p.matches(":popover-open"), log: log.slice() }));
    console.log(`\n[${mode} #${i}] open=${r.open}`); for (const l of r.log) console.log("   ", l);
  }
}
// slow open + fix (micro): pointer leaves during the pending open; the popup appears; re-hover, leave.
await page.evaluate(() => setMode("micro", 600));
await page.mouse.move(600, 600); await sleep(100);
await page.evaluate(() => { if (p.matches(":popover-open")) p.hidePopover(); log.length = 0; t0 = performance.now(); });
await page.mouse.move(c.x, c.y); await sleep(300); await page.mouse.move(600, 600); await sleep(700);
console.log("\n[slow-open+micro] after appear:", await page.evaluate(() => p.matches(":popover-open")));
await page.mouse.move(c.x, c.y); await sleep(300); await page.mouse.move(600, 600); await sleep(700);
const r = await page.evaluate(() => ({ open: p.matches(":popover-open"), log: log.slice() }));
console.log("[slow-open+micro] after re-hover+leave: open=" + r.open); for (const l of r.log) console.log("   ", l);
await browser.close();

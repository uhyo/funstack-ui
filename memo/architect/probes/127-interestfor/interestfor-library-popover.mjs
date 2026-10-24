// Probe for #127: why a library-mode Popover opened by a foreign `interestfor` button is not
// hidden on lost interest in Chromium, and which fix shapes work. The "library" is simulated:
// the popup cancels every foreign open at `beforetoggle` and re-shows later with its own source.
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const { chromium } = require("playwright");

const html = `<!doctype html>
<style>
  body { margin: 0; padding: 100px; }
  button { width: 100px; height: 30px; margin-right: 20px; interest-delay: 0s; }
  [popover] { margin: 0; inset: auto; top: 300px; left: 100px; width: 100px; height: 40px; }
  #far { position: absolute; top: 600px; left: 600px; width: 50px; height: 50px; background: #ddd; }
</style>
<button id="b" interestfor="p">Interest</button>
<button id="t">Trigger</button>
<div id="p" popover>pop</div>
<div id="far">far</div>
`;

const setup = `
  window.log = [];
  const src = (e) => (e.source ? e.source.id : String(e.source));
  for (const type of ["interest", "loseinterest"]) {
    p.addEventListener(type, (e) => {
      log.push(type + " src=" + src(e) + " cancelable=" + e.cancelable + " open=" + p.matches(":popover-open"));
      if (type === "loseinterest") window.onLoseInterest?.(e);
    });
  }
  for (const type of ["beforetoggle", "toggle"]) {
    p.addEventListener(type, (e) => {
      log.push(type + " " + e.oldState + "->" + e.newState + " src=" + src(e));
      if (type === "beforetoggle") window.onBeforeToggle?.(e);
    });
  }
  window.opening = false;
  window.show = (source) => {
    window.opening = true;
    try { p.showPopover(source ? { source } : undefined); } finally { window.opening = false; }
    log.push("reshown src=" + (source ? source.id : "none"));
  };
  window.state = () => {
    const q = (el, s) => { try { return el.matches(s); } catch { return "n/a"; } };
    return { open: p.matches(":popover-open"), bSource: q(b, ":interest-source"), pTarget: q(p, ":interest-target") };
  };
  window.setMode = (mode) => {
    window.onBeforeToggle = null; window.onLoseInterest = null;
    const cancel = (reshow) => (e) => {
      if (e.newState === "open" && !window.opening) { e.preventDefault(); log.push("cancelled"); reshow?.(); }
    };
    const hideNow = () => { if (p.matches(":popover-open")) { log.push("lib hidePopover"); p.hidePopover(); } };
    switch (mode) {
      case "plain": break;
      case "cancel-micro-button": window.onBeforeToggle = cancel(() => queueMicrotask(() => show(b))); break;
      case "cancel-task-trigger": window.onBeforeToggle = cancel(() => setTimeout(() => show(t), 50)); break;
      case "cancel-task-none": window.onBeforeToggle = cancel(() => setTimeout(() => show(null), 50)); break;
      case "cancel-only": window.onBeforeToggle = cancel(null); break;
      case "fix-sync":
        window.onBeforeToggle = cancel(() => setTimeout(() => show(t), 50));
        window.onLoseInterest = hideNow; break;
      case "fix-micro":
        window.onBeforeToggle = cancel(() => setTimeout(() => show(t), 50));
        window.onLoseInterest = () => queueMicrotask(hideNow); break;
      case "slow-open":
        // The "action" takes 600 ms; the pointer leaves at ~300 ms.
        window.onBeforeToggle = cancel(() => setTimeout(() => show(t), 600)); break;
    }
  };
  window.resetAll = () => { if (p.matches(":popover-open")) p.hidePopover(); };
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html);
  await page.evaluate(setup);
  console.log("chromium", browser.version());
  console.log("interestForElement:", await page.evaluate(() => "interestForElement" in HTMLButtonElement.prototype));

  const bBox = await page.locator("#b").boundingBox();
  const bCenter = { x: bBox.x + bBox.width / 2, y: bBox.y + bBox.height / 2 };
  const far = { x: 625, y: 625 };

  async function hoverCycle(label, waitBeforeLeave = 300) {
    await page.evaluate(() => { log.length = 0; });
    await page.mouse.move(bCenter.x, bCenter.y);
    await sleep(waitBeforeLeave);
    const afterHover = await page.evaluate(() => state());
    await page.mouse.move(far.x, far.y);
    await sleep(500);
    const afterLeave = await page.evaluate(() => state());
    const log = await page.evaluate(() => log.slice());
    console.log(`\n[${label}] after hover:`, JSON.stringify(afterHover), " after leave:", JSON.stringify(afterLeave));
    for (const l of log) console.log("   ", l);
  }

  for (const mode of ["plain", "cancel-micro-button", "cancel-task-trigger", "cancel-task-none", "cancel-only", "fix-sync", "fix-micro"]) {
    await page.mouse.move(far.x, far.y); await sleep(100);
    await page.evaluate((m) => { resetAll(); setMode(m); }, mode);
    await sleep(100);
    await hoverCycle(mode + " #1");
    // A second cycle: does interest work again after the first?
    await hoverCycle(mode + " #2");
  }

  // Slow open: pointer leaves while the open is pending; the popup appears later.
  await page.mouse.move(far.x, far.y); await sleep(100);
  await page.evaluate(() => { resetAll(); setMode("slow-open"); });
  await page.evaluate(() => { log.length = 0; });
  await page.mouse.move(bCenter.x, bCenter.y);
  await sleep(300);
  await page.mouse.move(far.x, far.y);
  await sleep(600);
  console.log("\n[slow-open] after pointer left during pending open, 900ms:", JSON.stringify(await page.evaluate(() => state())));
  for (const l of await page.evaluate(() => log.slice())) console.log("   ", l);
  // Hover again and leave: does interest re-form and hide it?
  await hoverCycle("slow-open re-hover");

  // Keyboard: focus-driven interest, fix-sync mode.
  await page.evaluate(() => { resetAll(); setMode("fix-sync"); log.length = 0; });
  await page.mouse.move(far.x, far.y); await sleep(100);
  await page.evaluate(() => document.body.focus());
  await page.keyboard.press("Tab"); // focuses #b
  await sleep(300);
  const afterFocus = await page.evaluate(() => ({ ...state(), active: document.activeElement.id }));
  await page.keyboard.press("Tab"); // focuses #t -> blur b
  await sleep(500);
  const afterBlur = await page.evaluate(() => ({ ...state(), active: document.activeElement.id }));
  console.log("\n[keyboard fix-sync] after focus:", JSON.stringify(afterFocus), " after blur:", JSON.stringify(afterBlur));
  for (const l of await page.evaluate(() => log.slice())) console.log("   ", l);

  // Escape while interest-open (fix-sync): what fires?
  await page.evaluate(() => { resetAll(); setMode("fix-sync"); });
  await page.mouse.move(far.x, far.y); await sleep(100);
  await page.evaluate(() => { log.length = 0; });
  await page.mouse.move(bCenter.x, bCenter.y);
  await sleep(300);
  await page.keyboard.press("Escape");
  await sleep(300);
  console.log("\n[escape while hovered, fix-sync]:", JSON.stringify(await page.evaluate(() => state())));
  for (const l of await page.evaluate(() => log.slice())) console.log("   ", l);
  await page.mouse.move(far.x, far.y); await sleep(500);
  console.log("   after leave:", JSON.stringify(await page.evaluate(() => state())));
  for (const l of await page.evaluate(() => log.slice())) console.log("   ", l);

  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });

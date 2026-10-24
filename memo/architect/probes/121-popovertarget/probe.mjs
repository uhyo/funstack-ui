// #121 probe: popovertarget vs commandfor on light dismiss, cancelled-click activation, implicit
// anchor, nested stacking, ToggleEvent.source and the command event. Plain DOM, real pointer.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const here = new URL(".", import.meta.url).pathname;
const html = readFileSync(here + "page.html", "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function probe(engine) {
  const b = await pw[engine].launch();
  const page = await b.newPage({ viewport: { width: 1000, height: 700 } });
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.setContent(html);
  const out = (k, v) => console.log(`${engine}\t${k}\t${JSON.stringify(v)}`);
  const open = (id) => page.evaluate((id) => window.open(id), id);
  const reset = () => page.evaluate(() => { for (const el of document.querySelectorAll("[popover]")) if (el.matches(":popover-open")) el.hidePopover(); window.log = []; window.cancelClicks.clear(); });
  const takeLog = () => page.evaluate(() => { const l = window.log; window.log = []; return l; });
  const center = async (id) => { const r = await page.evaluate((id) => window.rect(id), id); return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 }; };
  const press = async (id) => { const c = await center(id); await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.up(); };
  const version = b.version();
  out("version", version);

  // ---- 1. Light-dismiss exemption, library style: shown by script, click cancelled -----------
  for (const [btn, pop] of [["cf-btn", "cf-pop"], ["pt-btn", "pt-pop"], ["ptshow-btn", "ptshow-pop"], ["none-btn", "none-pop"], ["dis-btn", "dis-pop"]]) {
    await reset();
    await page.evaluate(([btn, pop]) => { window.cancelClicks.add(btn); document.getElementById(pop).showPopover(); }, [btn, pop]);
    await sleep(30);
    const before = await open(pop);
    const c = await center(btn);
    await page.mouse.move(c.x, c.y); await page.mouse.down();
    const atDown = await open(pop);
    await page.mouse.up();
    await sleep(20);
    const afterUp = await open(pop);
    await sleep(100);
    const settled = await open(pop);
    out(`1.lightdismiss.${btn}.cancelledClick`, { before, atDown, afterUp20ms: afterUp, settled, log: await takeLog() });
  }
  // disabled button: also with the popover shown and the button *not* cancelled (it cannot click anyway)
  // ---- 1b. pt light dismiss when shown with a *different* source (Combobox: source = input) ----
  await reset();
  await page.evaluate(() => { window.cancelClicks.add("pt-btn"); document.getElementById("pt-pop").showPopover({ source: document.getElementById("none-btn") }); });
  await sleep(30);
  await press("pt-btn"); await sleep(20);
  out("1b.pt.shownWithOtherSource.pressOnPtBtn", { afterUp20ms: await open("pt-pop"), log: await takeLog() });

  // ---- 2. Cancelled click suppresses the popovertarget activation (library mode) ---------------
  await reset();
  await page.evaluate(() => { window.cancelClicks.add("pt-btn"); window.cancelClicks.add("cf-btn"); });
  await press("pt-btn"); await sleep(20);
  await press("cf-btn"); await sleep(20);
  out("2.cancelledClick.opensNothing", { pt: await open("pt-pop"), cf: await open("cf-pop"), log: await takeLog() });
  // keyboard activation too
  await page.focus("#pt-btn"); await page.keyboard.press("Enter"); await sleep(20);
  await page.keyboard.press("Space"); await sleep(20);
  out("2.cancelledClick.keyboard", { pt: await open("pt-pop"), log: await takeLog() });

  // ---- 3. Native activation (JS-free): toggle, implicit anchor, ToggleEvent.source, command ----
  for (const [btn, pop] of [["cf-btn", "cf-pop"], ["pt-btn", "pt-pop"]]) {
    await reset();
    await press(btn); await sleep(30);
    const isOpen = await open(pop);
    const br = await page.evaluate((id) => window.rect(id), btn);
    const pr = await page.evaluate((id) => window.rect(id), pop);
    const anchored = pr.top === br.bottom && pr.left < br.right && pr.right > br.left;
    const log1 = await takeLog();
    await press(btn); await sleep(30);
    const closedAgain = !(await open(pop));
    out(`3.native.${btn}`, { opensOnClick: isOpen, anchoredBelowButton: anchored, btn: br, pop: pr, closesOnSecondClick: closedAgain, log: [...log1, ...(await takeLog())] });
  }
  // 3b. script showPopover() with no source: no anchor (centred)
  await reset();
  await page.evaluate(() => document.getElementById("pt-pop").showPopover());
  await sleep(30);
  out("3b.script.noSource", { pop: await page.evaluate(() => window.rect("pt-pop")), log: await takeLog() });

  // ---- 4. Escape / light dismiss: ToggleEvent.source is null; the hide button inside -----------
  await reset();
  await press("pt-btn"); await sleep(30); await takeLog();
  await page.keyboard.press("Escape"); await sleep(30);
  out("4.escape.source", { open: await open("pt-pop"), active: await page.evaluate(() => document.activeElement.id), log: await takeLog() });
  await press("pt-btn"); await sleep(30); await takeLog();
  await press("pt-hide"); await sleep(30);
  out("4.hideButtonInside.source", { open: await open("pt-pop"), active: await page.evaluate(() => document.activeElement.id), log: await takeLog() });
  await press("pt-btn"); await sleep(30); await takeLog();
  await page.mouse.click(900, 650); await sleep(30);
  out("4.outsideClick.source", { open: await open("pt-pop"), log: await takeLog() });
  // a foreign popovertarget invoker closing a popover the library opened by script
  await reset();
  await page.evaluate(() => document.getElementById("pt-pop").showPopover({ source: document.getElementById("none-btn") }));
  await sleep(30); await takeLog();
  await press("pt-btn"); await sleep(30);
  out("4.foreignPtInvokerCloses.source", { open: await open("pt-pop"), log: await takeLog() });

  // ---- 5. Nested stacking: inner opened natively from a button inside the outer ----------------
  for (const kind of ["cf", "pt"]) {
    for (const inner of [`inner-${kind}`, `desc-${kind}`]) {
      await reset();
      await page.evaluate((id) => document.getElementById(id).showPopover({ source: document.getElementById(id + "-btn") }), `outer-${kind}`);
      await sleep(30); await takeLog();
      await press(`${inner}-btn`); await sleep(30);
      const afterInner = { outer: await open(`outer-${kind}`), inner: await open(inner) };
      const log1 = await takeLog();
      await page.keyboard.press("Escape"); await sleep(30);
      const afterEsc = { outer: await open(`outer-${kind}`), inner: await open(inner), active: await page.evaluate(() => document.activeElement.id || document.activeElement.tagName) };
      out(`5.nested.${inner}`, { afterInnerClick: afterInner, afterEscape: afterEsc, log: [...log1, ...(await takeLog())] });
    }
  }
  // 5b. library-style nesting: inner shown by script with source = inner button (no attribute needed)
  await reset();
  await page.evaluate(() => { document.getElementById("outer-pt").showPopover(); document.getElementById("inner-pt").showPopover({ source: document.getElementById("inner-pt-btn") }); });
  await sleep(30);
  out("5b.nested.scriptSource", { outer: await open("outer-pt"), inner: await open("inner-pt") });

  // ---- 6. Light dismiss on the *outer's* invoker while a nested stack is open ------------------
  await reset();
  await page.evaluate(() => { window.cancelClicks.add("outer-pt-btn"); document.getElementById("outer-pt").showPopover({ source: document.getElementById("outer-pt-btn") }); document.getElementById("inner-pt").showPopover({ source: document.getElementById("inner-pt-btn") }); });
  await sleep(30); await takeLog();
  await press("outer-pt-btn"); await sleep(20);
  out("6.pressOuterInvoker.stackOpen", { outer: await open("outer-pt"), inner: await open("inner-pt"), log: await takeLog() });

  // ---- 7. Feature detection ---------------------------------------------------------------------
  out("7.features", await page.evaluate(() => ({
    popoverTargetElement: "popoverTargetElement" in HTMLButtonElement.prototype,
    commandForElement: "commandForElement" in HTMLButtonElement.prototype,
    toggleEventSource: "source" in ToggleEvent.prototype,
    commandEvent: typeof CommandEvent !== "undefined",
  })));
  await b.close();
}

for (const engine of (process.env.ENGINES ?? "chromium,firefox").split(",")) {
  try { await probe(engine); } catch (e) { console.log(engine, "FAILED", e.message); }
}

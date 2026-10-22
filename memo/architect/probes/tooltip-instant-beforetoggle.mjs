// Probe for #93 (tooltip `data-instant`): is an attribute written from the synchronous
// `beforetoggle` event in the DOM before the first style recalc of the open, so that
// `[data-instant] { transition: none }` suppresses the entry transition entirely (no
// `transitionrun`), in Chromium, Firefox and WebKit? And on Chromium's native `interestfor` +
// `popover="hint"` path, is the previous hint still `:popover-open` when the next one's
// `beforetoggle` fires (so the listener can classify the open)?
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const { chromium, firefox, webkit } = require("playwright");

const CHROMIUM_ARGS = process.env.CHROMIUM_ARGS ? process.env.CHROMIUM_ARGS.split(" ") : [];

const page_html = `<!doctype html>
<style>
  body { margin: 0; padding: 100px; }
  button { width: 100px; height: 30px; margin: 0 20px 0 0; }
  .tip { margin: 0; padding: 0; border: 0; width: 60px; height: 20px;
    opacity: 0; translate: 0 4px;
    transition: opacity 1s, translate 1s, display 1s allow-discrete, overlay 1s allow-discrete; }
  .tip:popover-open { opacity: 1; translate: 0 0; @starting-style { opacity: 0; translate: 0 4px; } }
  .tip[data-instant] { transition: none; }
  .anim:popover-open { animation: fade 1s; }
  .anim[data-instant] { animation: none; }
  @keyframes fade { from { opacity: 0 } to { opacity: 1 } }
  @property --fsui-tooltip-warm { syntax: "<number>"; inherits: false; initial-value: 0; }
  :root:has([role="tooltip"]:popover-open) [interestfor] { --fsui-tooltip-warm: 1; }
</style>
<button id="ta" interestfor="a" style="interest-delay-start: calc(300ms * (1 - var(--fsui-tooltip-warm, 0))); interest-delay-end: 0.15s">A</button>
<div id="a" class="tip" role="tooltip" popover="hint">A tip</div>
<button id="tb" interestfor="b" style="interest-delay-start: calc(300ms * (1 - var(--fsui-tooltip-warm, 0))); interest-delay-end: 0.15s">B</button>
<div id="b" class="tip" role="tooltip" popover="hint">B tip</div>
<button id="tc" interestfor="c" style="interest-delay-start: 0.3s">C</button>
<div id="c" class="tip anim" role="tooltip" popover="hint">C tip</div>
<button id="elsewhere" style="margin-left: 200px">Elsewhere</button>
`;

const setup = `
  window.log = [];
  const counts = (el) => {
    const c = { run: 0, cancel: 0, end: 0, animstart: 0 };
    el.addEventListener("transitionrun", (e) => { if (e.target === el) c.run++; });
    el.addEventListener("transitioncancel", (e) => { if (e.target === el) c.cancel++; });
    el.addEventListener("transitionend", (e) => { if (e.target === el) c.end++; });
    el.addEventListener("animationstart", (e) => { if (e.target === el) c.animstart++; });
    return c;
  };
  window.counts = { a: counts(a), b: counts(b), c: counts(c) };
  window.otherOpen = (self) => [...document.querySelectorAll('[role="tooltip"][popover]')]
    .some((el) => el !== self && el.matches(":popover-open"));
  window.mark = (el) => el.addEventListener("beforetoggle", (e) => {
    if (e.newState === "open") {
      const warm = otherOpen(el);
      log.push(el.id + " beforetoggle open, other open: " + warm + ", self popover-open: " + el.matches(":popover-open"));
      if (warm) el.setAttribute("data-instant", ""); else el.removeAttribute("data-instant");
    } else {
      log.push(el.id + " beforetoggle closed (had data-instant: " + el.hasAttribute("data-instant") + ")");
      el.removeAttribute("data-instant");
    }
  });
  window.reset = () => { for (const el of [a, b, c]) { if (el.matches(":popover-open")) el.hidePopover(); } };
`;

async function run(name, browserType, launch) {
  const browser = await browserType.launch(launch);
  const page = await browser.newPage();
  await page.setContent(page_html);
  await page.evaluate(setup);
  const out = { engine: name };
  out.version = browser.version();
  out.supportsInterestFor = await page.evaluate(
    () => "interestForElement" in HTMLButtonElement.prototype,
  );
  out.supportsHint = await page.evaluate(() => {
    const d = document.createElement("div");
    d.setAttribute("popover", "hint");
    return d.popover === "hint";
  });

  // P1: beforetoggle write (JS path order: show B, then hide A).
  out.p1 = await page.evaluate(async () => {
    mark(a);
    mark(b);
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    a.showPopover();
    await frame();
    const aCold = {
      run: counts.a.run,
      anims: a.getAnimations().length,
      instant: a.hasAttribute("data-instant"),
    };
    b.showPopover();
    if (a.matches(":popover-open")) a.hidePopover();
    const bSync = {
      instant: b.hasAttribute("data-instant"),
      anims: b.getAnimations().length,
      run: counts.b.run,
    };
    await frame();
    const bLater = {
      anims: b.getAnimations().length,
      run: counts.b.run,
      cancel: counts.b.cancel,
      instant: b.hasAttribute("data-instant"),
      open: b.matches(":popover-open"),
      aOpen: a.matches(":popover-open"),
    };
    // Close B: attribute removed at beforetoggle(closed); does the exit transition run?
    const runBefore = counts.b.run;
    b.hidePopover();
    await frame();
    const bExit = { runDelta: counts.b.run - runBefore, instant: b.hasAttribute("data-instant") };
    // Next cold open of B after A is gone.
    b.showPopover();
    await frame();
    const bCold = { instant: b.hasAttribute("data-instant"), anims: b.getAnimations().length };
    b.hidePopover();
    await frame();
    return { aCold, bSync, bLater, bExit, bCold, log: log.splice(0) };
  });

  // P2: late write at `toggle` (a task later): the transition starts and is cancelled.
  out.p2 = await page.evaluate(async () => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const late = document.createElement("div");
    late.className = "tip";
    late.setAttribute("role", "tooltip");
    late.setAttribute("popover", "manual");
    document.body.append(late);
    const c = { run: 0, cancel: 0 };
    late.addEventListener("transitionrun", () => c.run++);
    late.addEventListener("transitioncancel", () => c.cancel++);
    late.addEventListener("toggle", (e) => {
      if (e.newState === "open") late.setAttribute("data-instant", "");
    });
    late.showPopover();
    const sync = { anims: late.getAnimations().length };
    await new Promise((r) => setTimeout(r, 50));
    await frame();
    const after = { run: c.run, cancel: c.cancel, anims: late.getAnimations().length };
    late.hidePopover();
    late.remove();
    return { sync, after };
  });

  // P3: CSS animation variant.
  out.p3 = await page.evaluate(async () => {
    mark(c);
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    a.showPopover();
    await frame();
    c.showPopover();
    if (a.matches(":popover-open")) a.hidePopover();
    await frame();
    const warm = {
      animstart: counts.c.animstart,
      anims: c.getAnimations().length,
      instant: c.hasAttribute("data-instant"),
    };
    c.hidePopover();
    await frame();
    c.showPopover();
    await frame();
    const cold = {
      animstart: counts.c.animstart,
      anims: c.getAnimations().length,
      instant: c.hasAttribute("data-instant"),
    };
    c.hidePopover();
    await frame();
    return { warm, cold, log: log.splice(0) };
  });

  // P6: hidePopover() on a hidden popover.
  out.p6 = await page.evaluate(() => {
    try {
      a.hidePopover();
      return "no throw";
    } catch (e) {
      return e.name;
    }
  });

  // P4: native path (Chromium with interestfor): real hover.
  if (out.supportsInterestFor) {
    await page.evaluate(() => {
      reset();
      log.length = 0;
      counts.a.run = 0;
      counts.b.run = 0;
      counts.b.cancel = 0;
    });
    const box = async (id) => page.locator("#" + id).boundingBox();
    const ba = await box("ta"),
      bb = await box("tb"),
      be = await box("elsewhere");
    await page.mouse.move(ba.x + 10, ba.y + 10);
    await page.waitForFunction(() => a.matches(":popover-open"));
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    const aRun = await page.evaluate(() => counts.a.run);
    const t0 = Date.now();
    await page.mouse.move(bb.x + 10, bb.y + 10);
    await page.waitForFunction(() => b.matches(":popover-open"));
    const dt = Date.now() - t0;
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    out.p4 = await page.evaluate(() => ({
      instant: b.hasAttribute("data-instant"),
      bRun: counts.b.run,
      bCancel: counts.b.cancel,
      bAnims: b.getAnimations().length,
      aOpen: a.matches(":popover-open"),
      log: log.splice(0),
    }));
    out.p4.aColdRun = aRun;
    out.p4.msToOpenB = dt;
    await page.mouse.move(be.x + 10, be.y + 10);
    await page.waitForFunction(() => !b.matches(":popover-open"));
  }
  await browser.close();
  return out;
}

const only = process.env.ENGINES?.split(",");
for (const [name, type, launch] of [
  ["chromium", chromium, { args: CHROMIUM_ARGS }],
  ["firefox", firefox, {}],
  ["webkit", webkit, {}],
]) {
  if (only && !only.includes(name)) continue;
  try {
    console.log(JSON.stringify(await run(name, type, launch), null, 2));
  } catch (error) {
    console.log(JSON.stringify({ engine: name, launchError: String(error.message).split("\n")[0] }));
  }
}

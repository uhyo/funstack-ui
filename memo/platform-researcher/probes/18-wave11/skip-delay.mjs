// Wave 11 research (#21), 2026-10-22. Run: node skip-delay.mjs
// Native interestfor (Chromium only): how long does a second tooltip take to open when the pointer
// moves to its trigger (1) straight from an open tooltip's trigger, (2) 300 ms after leaving it
// (first tooltip closed by then)? Variants:
//   base     inline interest-delay-start/end only (what Tooltip.Trigger renders today)
//   has      the explainer's pattern: :root:has(:interest-source) [interestfor] { interest-delay-start: 0s }
//   trig     the recommended shape: a non-inherited registered property set on the triggers only
//            while any [role=tooltip] popover is open; the inline delay is calc(delay * (1 - warm))
//   cooldown a registered custom property whose transition-delay keeps "warm" for 500 ms after the
//            last :interest-source goes away; triggers use calc(delay * (1 - warm))
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");

const css = {
  base: `.t { interest-delay-start: 400ms; interest-delay-end: 150ms; }`,
  has: `.t { interest-delay-start: 400ms; interest-delay-end: 150ms; }
        :root:has(:interest-source) .t { interest-delay-start: 0s; }`,
  trig: `@property --fsui-tooltip-warm { syntax: "<number>"; inherits: false; initial-value: 0; }
        :root:has([role="tooltip"]:popover-open) .t { --fsui-tooltip-warm: 1; }`,
  cooldown: `@property --warm { syntax: "<number>"; inherits: true; initial-value: 0; }
        :root { --warm: 0; transition: --warm 0s step-end 500ms; }
        :root:has(:interest-source) { --warm: 1; transition: none; }
        .t { interest-delay-start: calc(400ms * (1 - var(--warm))); interest-delay-end: 150ms; }`,
};
const page = (v) => `<!doctype html><style>body{margin:0} .t{position:absolute;top:100px;width:80px;height:40px}
#a{left:100px} #b{left:190px} [popover]{margin:0;position:fixed;top:200px;left:100px} ${css[v]}</style>
<button class="t" id="a" interestfor="pa" ${v === "trig" ? 'style="interest-delay-start: calc(400ms * (1 - var(--fsui-tooltip-warm))); interest-delay-end: 150ms"' : ""}>A</button><button class="t" id="b" interestfor="pb" ${v === "trig" ? 'style="interest-delay-start: calc(400ms * (1 - var(--fsui-tooltip-warm))); interest-delay-end: 150ms"' : ""}>B</button>
<div id="pa" popover="hint" role="tooltip">tip A</div><div id="pb" popover="hint" role="tooltip">tip B</div>
<script>window.log=[];for(const id of ['pa','pb'])document.getElementById(id).addEventListener('toggle',e=>log.push([id,e.newState,Math.round(performance.now())]));
window.mark=()=>Math.round(performance.now());</script>`;

const browser = await pw.chromium.launch();
console.log("Chromium", browser.version());
for (const v of ["base", "has", "trig", "cooldown"]) {
  for (const gap of [0, 300, 800]) {
    const p = await browser.newPage();
    await p.setContent(page(v));
    await p.mouse.move(10, 10);
    await p.mouse.move(140, 120); // hover A
    await p.waitForTimeout(700);
    let t0;
    if (gap === 0) {
      t0 = await p.evaluate(() => mark());
      await p.mouse.move(230, 120); // straight to B (adjacent)
    } else {
      await p.mouse.move(140, 400); // leave A to empty space
      await p.waitForTimeout(gap);
      t0 = await p.evaluate(() => mark());
      await p.mouse.move(230, 120);
    }
    await p.waitForTimeout(900);
    const log = await p.evaluate(() => log);
    const bOpen = log.find(([id, s]) => id === "pb" && s === "open");
    const aClosed = log.filter(([id, s]) => id === "pa" && s === "closed").pop();
    console.log(
      `${v.padEnd(8)} gap=${gap}ms: B opened ${bOpen ? bOpen[2] - t0 + " ms" : "never"} after hover;`,
      `A closed ${aClosed ? aClosed[2] - t0 + " ms" : "never"} after hover of B`,
    );
    await p.close();
  }
}
await browser.close();

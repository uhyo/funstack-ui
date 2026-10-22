// Positioning wave 11 research (#20, #53), 2026-10-22. Run: node computed-serialization.mjs
// Computed position-area serialization, unflipped and after each flip, for the values a resolver
// would have to parse: physical (Tooltip/Popover/Menu), self-logical (proposed Combobox), and
// self-x (proposed align/submenu). Trigger placed so the requested side does not fit.
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const values = ["top", "top span-right", "self-block-end span-self-inline-end", "self-x-end span-bottom", "bottom span-self-x-end"];
const results = {};
for (const name of ["chromium", "firefox"]) {
  const browser = await pw[name].launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const out = { version: browser.version() };
  for (const dir of ["ltr", "rtl"]) for (const v of values) for (const pos of ["middle", "corner"]) {
    await page.setContent(`<!doctype html><html dir="${dir}"><style>body{margin:0}
#a{position:absolute;width:100px;height:30px;margin:0;padding:0;border:0;${pos === "middle" ? "left:350px;top:285px" : dir === "ltr" ? "left:695px;top:565px" : "left:5px;top:565px"}}
#p{margin:0;padding:0;border:0;width:120px;height:40px;inset:auto;position-area:${v};position-try-fallbacks:flip-block,flip-inline,flip-block flip-inline}
</style><button id="a"></button><div id="p" popover="manual"></div></html>`);
    out[`${dir} ${v} @${pos}`] = await page.evaluate(() => {
      const a = document.getElementById("a"), p = document.getElementById("p");
      p.showPopover({ source: a });
      const b = p.getBoundingClientRect(), t = a.getBoundingClientRect();
      const where = `${b.bottom <= t.top ? "above" : b.top >= t.bottom ? "below" : b.right <= t.left ? "left" : b.left >= t.right ? "right" : "overlap"}`;
      const r = `${getComputedStyle(p).positionArea}  [${where}]`;
      p.hidePopover();
      return r;
    });
  }
  results[name] = out;
  await browser.close();
}
for (const [b, o] of Object.entries(results)) { console.log("==", b, o.version); for (const [k, v] of Object.entries(o)) if (k !== "version") console.log(k.padEnd(52), v); }

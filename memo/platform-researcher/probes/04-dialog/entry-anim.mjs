// Entry (@starting-style) animation on dialog, and exit animation on popover, sampled from screenshots.
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const { PNG } = await import("/home/uhyo/repos/funstack-ui/node_modules/.pnpm/node_modules/pngjs/lib/png.js");
const px = (buf, x, y) => { const p = PNG.sync.read(buf); const i = (p.width * y + x) << 2; return [p.data[i], p.data[i + 1], p.data[i + 2]].join(","); };
for (const name of ["chromium", "firefox"]) {
  const b = await pw[name].launch();
  const page = await b.newPage({ viewport: { width: 400, height: 400 } });
  await page.setContent(`<!doctype html><style>body{margin:0;background:#fff}
    dialog,[popover]{position:fixed;inset:0;margin:auto;width:100px;height:100px;padding:0;border:0;background:rgb(255,0,0);
      opacity:1;transition: opacity 2s, display 2s allow-discrete, overlay 2s allow-discrete}
    @starting-style{dialog[open],[popover]:popover-open{opacity:0}}
    dialog:not([open]),[popover]:not(:popover-open){opacity:0}
    dialog::backdrop{background:transparent}</style><dialog id="d"></dialog><div id="p" popover></div>`);
  await page.evaluate(() => document.getElementById("d").showModal());
  await page.waitForTimeout(500);
  const dialogEntry = px(await page.screenshot(), 200, 200);
  await page.evaluate(() => document.getElementById("d").close());
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.getElementById("p").showPopover());
  await page.waitForTimeout(2500);
  const popoverOpen = px(await page.screenshot(), 200, 200);
  await page.evaluate(() => document.getElementById("p").hidePopover());
  await page.waitForTimeout(500);
  const popoverExit = px(await page.screenshot(), 200, 200);
  console.log(name, JSON.stringify({ dialogEntryAt500of2000ms: dialogEntry, popoverOpen, popoverExitAt500of2000ms: popoverExit }));
  await b.close();
}

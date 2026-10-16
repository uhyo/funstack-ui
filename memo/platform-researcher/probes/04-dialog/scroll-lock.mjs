// Background scroll while a modal dialog is open: none / overscroll-behavior on dialog / html:has(:modal) overflow hidden.
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const variants = {
  none: "",
  "dialog overscroll-behavior:contain": "dialog{overscroll-behavior:contain}",
  "html:has(dialog:modal){overflow:hidden}": "html{scrollbar-gutter:stable} html:has(dialog:modal){overflow:hidden}",
};
for (const name of ["chromium", "firefox"]) {
  const b = await pw[name].launch();
  for (const [k, css] of Object.entries(variants)) {
    const page = await b.newPage({ viewport: { width: 600, height: 600 } });
    await page.setContent(`<!doctype html><style>body{margin:0;height:5000px} dialog{width:200px;height:200px} ${css}</style><button id="o">o</button><dialog id="d"><p>short</p><button id="in">in</button></dialog>`);
    await page.click("#o"); await page.evaluate(() => document.getElementById("d").showModal());
    const r = {};
    await page.mouse.move(20, 300); await page.mouse.wheel(0, 600); await page.waitForTimeout(400);
    r.wheelOverBackdrop = await page.evaluate(() => scrollY); await page.evaluate(() => scrollTo(0, 0));
    await page.mouse.move(300, 300); await page.mouse.wheel(0, 600); await page.waitForTimeout(400);
    r.wheelOverDialog = await page.evaluate(() => scrollY); await page.evaluate(() => scrollTo(0, 0));
    await page.keyboard.press("PageDown"); await page.waitForTimeout(400);
    r.pageDownFocusInDialog = await page.evaluate(() => scrollY); await page.evaluate(() => scrollTo(0, 0));
    r.layoutShiftWidth = await page.evaluate(() => document.documentElement.clientWidth);
    console.log(name, k, JSON.stringify(r));
    await page.close();
  }
  await b.close();
}

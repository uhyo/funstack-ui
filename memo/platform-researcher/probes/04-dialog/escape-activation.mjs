// Is `cancel` cancelable on repeated Escape without user activation? Also CloseWatcher directly.
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
for (const name of ["chromium", "firefox"]) {
  const b = await pw[name].launch();
  const page = await b.newPage();
  await page.setContent(`<dialog id="d"><p>x</p></dialog>`);
  const r = await page.evaluate(() => {
    window.log = [];
    const d = document.getElementById("d");
    d.addEventListener("cancel", (e) => { log.push(`dialog cancel cancelable=${e.cancelable} hasBeenActive=${navigator.userActivation.hasBeenActive}`); e.preventDefault(); });
    d.showModal();
    return navigator.userActivation.hasBeenActive;
  });
  for (let i = 0; i < 3; i++) { await page.keyboard.press("Escape"); await page.waitForTimeout(50); }
  const dialogRes = { activeBefore: r, open: await page.evaluate(() => document.getElementById("d").open), log: await page.evaluate(() => log) };
  // CloseWatcher with no activation
  const page2 = await b.newPage();
  await page2.setContent(`<p>x</p>`);
  await page2.evaluate(() => { window.log = []; if (typeof CloseWatcher === "undefined") return; const w = new CloseWatcher(); w.oncancel = (e) => { log.push("cw cancel cancelable=" + e.cancelable); e.preventDefault(); }; w.onclose = () => log.push("cw close"); });
  for (let i = 0; i < 2; i++) { await page2.keyboard.press("Escape"); await page2.waitForTimeout(50); }
  const cw = await page2.evaluate(() => log);
  console.log(name, b.version(), JSON.stringify({ dialogRes, cw }));
  await b.close();
}

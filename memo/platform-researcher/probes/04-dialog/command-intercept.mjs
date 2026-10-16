// Can the library intercept command="show-modal" (preventDefault on the `command` event) and open later
// itself? Does ToggleEvent.source report the invoker? Is focus restored to the invoker when the library
// calls showModal() asynchronously (after a delay, no activation) instead?
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
for (const name of ["chromium", "firefox"]) {
  const b = await pw[name].launch(); const page = await b.newPage();
  await page.setContent(`<button id="t" commandfor="d" command="show-modal">open</button><dialog id="d"><button id="x">x</button></dialog>`);
  await page.evaluate(() => {
    window.log = []; const d = document.getElementById("d");
    d.addEventListener("command", (e) => { log.push(`command ${e.command} cancelable=${e.cancelable} source=${e.source?.id}`); if (e.command === "show-modal") { e.preventDefault(); setTimeout(() => d.showModal(), 300); } });
    d.addEventListener("toggle", (e) => log.push(`toggle ${e.newState} source=${e.source?.id ?? null}`));
    d.addEventListener("cancel", (e) => log.push(`cancel cancelable=${e.cancelable}`));
  });
  await page.click("#t"); await page.waitForTimeout(50);
  const openRightAfterClick = await page.evaluate(() => document.getElementById("d").open);
  await page.waitForTimeout(400);
  const openLater = await page.evaluate(() => [document.getElementById("d").matches(":modal"), document.activeElement.id]);
  await page.keyboard.press("Escape"); await page.waitForTimeout(50);
  const afterEsc = await page.evaluate(() => [document.getElementById("d").open, document.activeElement.id]);
  console.log(name, JSON.stringify({ openRightAfterClick, openLater, afterEsc, log: await page.evaluate(() => log) }));
  await b.close();
}

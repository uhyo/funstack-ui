// Does requestClose() (and command="request-close") close a dialog with closedby="none"? Does Escape?
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
for (const name of ["chromium", "firefox"]) {
  const b = await pw[name].launch(); const page = await b.newPage();
  await page.setContent(`<button id="o">o</button><dialog id="d" closedby="none"><button id="rc" commandfor="d" command="request-close">rc</button></dialog>`);
  await page.evaluate(() => { window.log = []; const d = document.getElementById("d"); d.oncancel = () => log.push("cancel"); d.onclose = () => log.push("close"); document.getElementById("o").onclick = () => d.showModal(); });
  await page.click("#o"); await page.keyboard.press("Escape"); await page.waitForTimeout(50);
  const afterEscape = await page.evaluate(() => document.getElementById("d").open);
  await page.evaluate(() => document.getElementById("d").requestClose()); await page.waitForTimeout(50);
  const afterRequestClose = await page.evaluate(() => document.getElementById("d").open);
  await page.click("#o"); await page.click("#rc"); await page.waitForTimeout(50);
  const afterCommand = await page.evaluate(() => document.getElementById("d").open);
  console.log(name, JSON.stringify({ afterEscape, afterRequestClose, afterCommand, log: await page.evaluate(() => log) }));
  await b.close();
}

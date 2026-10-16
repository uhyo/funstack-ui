// Which factor makes repeated Escape cancelable: a prior click (activation) or a focused button?
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const variants = {
  "no-click/no-button": { click: false, inner: "<p>x</p>" },
  "no-click/button": { click: false, inner: "<button>in</button>" },
  "click/no-button": { click: true, inner: "<p>x</p>" },
  "click/button": { click: true, inner: "<button>in</button>" },
};
for (const name of ["chromium", "firefox"]) {
  const b = await pw[name].launch();
  for (const [k, v] of Object.entries(variants)) {
    const page = await b.newPage();
    await page.setContent(`<button id="o">o</button><dialog id="d">${v.inner}</dialog>`);
    await page.evaluate(() => { window.log = []; const d = document.getElementById("d"); d.addEventListener("cancel", (e) => { log.push(e.cancelable ? "C" : "nc"); e.preventDefault(); }); document.getElementById("o").onclick = () => d.showModal(); });
    if (v.click) await page.click("#o"); else await page.evaluate(() => document.getElementById("d").showModal());
    for (let i = 0; i < 4; i++) { await page.keyboard.press("Escape"); await page.waitForTimeout(30); }
    console.log(name, k, JSON.stringify(await page.evaluate(() => [log, document.getElementById("d").open])));
    await page.close();
  }
  await b.close();
}

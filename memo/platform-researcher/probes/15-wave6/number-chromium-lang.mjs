// Does Chromium's number input follow the browser UI locale? (2026-10-18). Run: node number-chromium-lang.mjs
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
for (const lang of ["en-US", "de-DE", "fr-FR"]) {
  const browser = await pw.chromium.launch({ args: [`--lang=${lang}`], env: { ...process.env, LANG: lang.replace("-", "_") + ".UTF-8", LANGUAGE: lang.replace("-", "_") } });
  const page = await browser.newPage({ locale: lang });
  await page.setContent(`<input id="d" type="number" step="0.01" aria-label="d"><input id="v" type="number" value="1234.5" aria-label="v">`);
  const r = {};
  for (const s of ["1,5", "1.5", "1.234,5", "1 234,5"]) { await page.fill("#d", ""); await page.focus("#d"); await page.keyboard.type(s); r[s] = await page.$eval("#d", (e) => [e.value, e.validity.badInput]); }
  // what is displayed for value=1234.5: select all and read via clipboard is blocked; use the inner editor text in the UA shadow root is closed, so use a screenshot-free trick: copy event
  await page.focus("#v"); await page.keyboard.press("ControlOrMeta+a");
  const shown = await page.evaluate(() => new Promise((res) => { document.addEventListener("copy", (e) => { res(String(getSelection())); }, { once: true }); document.execCommand("copy"); setTimeout(() => res("(no copy event)"), 300); }));
  console.log(lang, JSON.stringify(r), "navigator.language=" + (await page.evaluate(() => navigator.language)), "display of 1234.5:", JSON.stringify(shown));
  await browser.close();
}

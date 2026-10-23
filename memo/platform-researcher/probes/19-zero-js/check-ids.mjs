import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT ?? "playwright");
const [url, label] = process.argv.slice(2);
for (const name of ["chromium","firefox","webkit"]) {
  let browser;
  try { browser = await pw[name].launch(); } catch (e) { console.log(name, "unavailable"); continue; }
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type()==="error") errors.push(m.text()); });
  await page.goto(url); await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const ids=[...document.querySelectorAll("[id]")].map(e=>e.id);
    return { dupes: ids.filter((x,i)=>ids.indexOf(x)!==i),
      bars: [...document.querySelectorAll('[role=progressbar]')].map(b=>({labelledby:b.getAttribute("aria-labelledby"), resolves: document.getElementById(b.getAttribute("aria-labelledby"))?.textContent, sameRoot: b.contains(document.getElementById(b.getAttribute("aria-labelledby")))})) };
  });
  const snap = await page.locator("main").ariaSnapshot();
  console.log(label, name, JSON.stringify(r), "errors:", JSON.stringify(errors));
  console.log(snap);
  await browser.close();
}

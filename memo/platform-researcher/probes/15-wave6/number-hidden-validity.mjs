// Visible type=text + visually hidden type=number carrying name/min/max/step (Base UI shape):
// what do constraint validation, submit, reset and :user-invalid do? (2026-10-18). Run: node number-hidden-validity.mjs
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const PAGE = `<!doctype html><html lang="en"><body>
<form id="f" action="javascript:void 0">
  <label for="vis">Qty</label>
  <input id="vis" type="text" inputmode="decimal" value="5">
  <input id="hid" type="number" name="qty" min="0" max="10" step="1" value="5" aria-hidden="true" tabindex="-1"
    style="position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0;padding:0">
  <button id="go">Submit</button>
</form>
<script>
  window.__log = [];
  const f = document.getElementById("f");
  f.addEventListener("submit", () => __log.push("submit:" + new FormData(f).get("qty")));
  for (const id of ["vis","hid"]) document.getElementById(id).addEventListener("invalid", (e) => __log.push("invalid:" + id + ":" + e.target.validationMessage));
</script></body></html>`;
for (const name of ["chromium", "firefox"]) {
  const browser = await pw[name].launch();
  const page = await browser.newPage();
  const msgs = []; page.on("console", (m) => msgs.push(m.text()));
  await page.setContent(PAGE);
  console.log(`\n######## ${name} ${browser.version()}`);
  const out = (k, v) => console.log(k.padEnd(52), JSON.stringify(v));
  // the library writes the parsed value to the hidden input (as a property: dirty value flag set)
  await page.evaluate(() => { document.getElementById("hid").value = "11"; });
  out("hidden validity after value=11", await page.evaluate(() => { const h = document.getElementById("hid"); return { over: h.validity.rangeOverflow, msg: h.validationMessage, userInvalid: h.matches(":user-invalid"), willValidate: h.willValidate }; }));
  await page.evaluate(() => document.getElementById("f").requestSubmit()); await page.waitForTimeout(200);
  out("requestSubmit: events / focus", { log: await page.evaluate(() => __log.splice(0)), focus: await page.evaluate(() => document.activeElement.id || document.activeElement.tagName), console: msgs.splice(0) });
  out(":user-invalid on hidden after submit attempt", await page.evaluate(() => document.getElementById("hid").matches(":user-invalid")));
  // mirror the message onto the visible input
  await page.evaluate(() => { const h = document.getElementById("hid"); document.getElementById("vis").setCustomValidity(h.validationMessage); });
  await page.evaluate(() => document.getElementById("f").requestSubmit()); await page.waitForTimeout(200);
  out("mirrored: requestSubmit events / focus", { log: await page.evaluate(() => __log.splice(0)), focus: await page.evaluate(() => document.activeElement.id || document.activeElement.tagName), visUserInvalid: await page.evaluate(() => document.getElementById("vis").matches(":user-invalid")), console: msgs.splice(0) });
  out("reset restores hidden defaultValue", await page.evaluate(() => { document.getElementById("f").reset(); return document.getElementById("hid").value; }));
  await browser.close();
}

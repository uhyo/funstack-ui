// :user-invalid after a submit attempt whose invalid event was canceled (spec: user validity is set
// true for every submittable element before validation). Run: node user-invalid-canceled.mjs
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const PAGE = `<form onsubmit="event.preventDefault()"><input id="other"><input id="q" required><input id="r" required><button id="b">go</button></form>
<script>document.getElementById("q").addEventListener("invalid", e => e.preventDefault());</script>`;
for (const name of ["chromium", "firefox"]) {
  const br = await pw[name].launch(); const p = await br.newPage(); await p.setContent(PAGE);
  await p.click("#b");
  const r = await p.evaluate(() => ({ q_canceled: q.matches(":user-invalid"), r_notCanceled: r.matches(":user-invalid"), focus: document.activeElement.id }));
  await p.setContent(PAGE.replace('id="r" required', 'id="r"'));
  await p.click("#b");
  const r2 = await p.evaluate(() => ({ onlyCanceledField_userInvalid: q.matches(":user-invalid"), focus: document.activeElement.id || document.activeElement.tagName }));
  console.log(name, br.version(), JSON.stringify(r), JSON.stringify(r2)); await br.close();
}

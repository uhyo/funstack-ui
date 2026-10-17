// After the native validation bubble is shown, does the next click on a submit button submit?
// (Explains Firefox ordering artifacts in react-form.browser.test.tsx.) Run: node bubble-then-submit.mjs
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const PAGE = `<form id="f1"><input id="q" required><button id="b1">go</button></form>
<form id="f2" onsubmit="event.preventDefault(); window.__s2 = (window.__s2||0)+1"><input id="x"><button id="b2">go2</button></form>
<script>document.getElementById("f1").addEventListener("submit", e => { e.preventDefault(); window.__s1 = (window.__s1||0)+1; });</script>`;
for (const name of ["chromium", "firefox"]) {
  const br = await pw[name].launch(); const p = await br.newPage(); await p.setContent(PAGE);
  await p.click("#b1"); // shows bubble
  await p.click("#b2"); await p.waitForTimeout(100);
  const a = await p.evaluate(() => window.__s2 || 0);
  await p.click("#b2"); await p.waitForTimeout(100);
  const b = await p.evaluate(() => window.__s2 || 0);
  await p.setContent(PAGE);
  await p.click("#b1"); await p.waitForTimeout(6000);
  await p.click("#b2"); await p.waitForTimeout(100);
  const c = await p.evaluate(() => window.__s2 || 0);
  console.log(name, br.version(), JSON.stringify({ submitsAfterFirstClickRightAfterBubble: a, afterSecondClick: b, afterWaiting6s: c })); await br.close();
}

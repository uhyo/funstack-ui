// Does ::interest-button render in Chromium 156 (BCD 8.1.10 says Chrome 149; the runtime flag
// HTMLInterestForInterestButtonPseudo is "experimental" on the 156/158 branches and main)?
// Measure the width of an inline-flex wrapper around an interestfor link with and without the rule.
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const b = await pw.chromium.launch();
for (const rule of ["", "a::interest-button { content: 'i'; display: inline-block; width: 40px; }"]) {
  const p = await b.newPage();
  await p.setContent(`<style>${rule} #w{display:inline-flex}</style><span id="w"><a id="inv" href="#u" interestfor="card">@user</a></span><div id="card" popover="hint">card</div>`);
  console.log(b.version(), JSON.stringify(rule || "(no rule)"), "wrapper width", await p.evaluate(() => Math.round(w.getBoundingClientRect().width)), "supports", await p.evaluate(() => CSS.supports("selector(::interest-button)")));
  await p.close();
}
await b.close();

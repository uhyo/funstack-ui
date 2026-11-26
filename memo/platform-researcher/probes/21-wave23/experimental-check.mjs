// Are Chromium "experimental" runtime features on in the Playwright build? If CSS that only an
// experimental flag enables parses, the multi-select drop-down seen in select-multiple.mjs is a
// flag artefact, not shipped behaviour. Also prints the launch args Playwright uses.
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
for (const opts of [{}, { channel: "chrome" }, { args: ["--disable-blink-features=CustomizableSelectMultiplePopup"] }]) {
  let b;
  try {
    b = await pw.chromium.launch(opts);
  } catch (e) {
    console.log(JSON.stringify(opts), "launch failed:", e.message.split("\n")[0]);
    continue;
  }
  const p = await b.newPage();
  await p.setContent(`<style>select,::picker(select){appearance:base-select}</style><select id="s" multiple size="1"><option>a</option><option>b</option></select>`);
  const r = await p.evaluate(() => ({
    appearanceBase: CSS.supports("appearance", "base"),
    interestButton: CSS.supports("selector(::interest-button)"),
    multiSelectHeight: Math.round(s.getBoundingClientRect().height),
  }));
  await p.click("#s");
  r.openAfterClick = await p.evaluate(() => s.matches(":open"));
  console.log(JSON.stringify(opts), b.version(), JSON.stringify(r));
  await b.close();
}

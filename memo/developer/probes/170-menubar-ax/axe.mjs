// Any engine (ENGINE=chromium|firefox|webkit): axe in the engine, and Playwright's own aria
// snapshot (computed by Playwright's injected script, not the engine's tree). For WebKit this is
// all that is reachable from Playwright 1.64 on Linux.
import { pw, html, axeSource, openFile, runAxe } from "./common.mjs";
const engine = process.env.ENGINE ?? "webkit";
const b = await pw[engine].launch();
const page = await b.newPage();
await page.setContent(html);
console.log(engine, b.version());
console.log("--- closed (Playwright aria snapshot)\n" + (await page.locator("body").ariaSnapshot()));
await page.addScriptTag({ content: axeSource });
console.log("--- axe (closed)\n" + JSON.stringify(await page.evaluate(runAxe), null, 1));
await page.evaluate(openFile);
await page.waitForTimeout(300);
console.log(
  "--- File open (Playwright aria snapshot)\n" + (await page.locator("body").ariaSnapshot()),
);
console.log(
  "file :popover-open",
  await page.evaluate(`document.getElementById("file").matches(":popover-open")`),
);
console.log("--- axe (File open)\n" + JSON.stringify(await page.evaluate(runAxe), null, 1));
await b.close();

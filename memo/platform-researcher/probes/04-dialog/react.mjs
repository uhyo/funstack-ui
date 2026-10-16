// React 19.3.1 + <dialog>: event wiring after hydration vs client render, form method=dialog with a
// function action, autofocus, pre-hydration open via command="show-modal".
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const { ssr } = require(new URL("./react/ssr.bundle.cjs", import.meta.url).pathname);
const bundle = readFileSync(new URL("./react/client.bundle.js", import.meta.url), "utf8");
const page_ = (variant, withSsr) => `<!doctype html><html><body><div id="root">${withSsr ? ssr(variant) : ""}</div><script>${bundle}</script></body></html>`;
const st = (page) => page.evaluate(() => ({ log: getLog().slice(), errors: __errors.slice(), open: document.getElementById("d").open, modal: document.getElementById("d").matches(":modal"), active: document.activeElement?.id || document.activeElement?.tagName }));

const scenarios = {
  async eventsHydrated(page) {
    await page.setContent(page_("default", true)); await page.evaluate(() => mount("hydrate", "default")); await page.waitForTimeout(100);
    await page.click("#open"); await page.waitForTimeout(50); await page.click("#rc"); await page.waitForTimeout(50);
    return st(page);
  },
  async eventsClientRendered(page) {
    await page.setContent(page_("default", false)); await page.evaluate(() => mount("client", "default")); await page.waitForTimeout(100);
    await page.click("#open"); await page.waitForTimeout(50); await page.click("#rc"); await page.waitForTimeout(50);
    return st(page);
  },
  async openedBeforeHydration(page) {
    await page.setContent(page_("default", true).replace(/<script>[\s\S]*<\/script>/, `<script>window.__deferred=${JSON.stringify(bundle)}</script>`));
    await page.click("#open"); await page.waitForTimeout(50);
    const before = await page.evaluate(() => ({ modal: document.getElementById("d").matches(":modal"), active: document.activeElement?.id }));
    await page.evaluate(() => { (0, eval)(window.__deferred); mount("hydrate", "default"); }); await page.waitForTimeout(200);
    const after = await st(page);
    await page.keyboard.press("Escape"); await page.waitForTimeout(50);
    return { before, after, afterEscape: await st(page) };
  },
  async formActionInsideDialog(page) {
    await page.setContent(page_("formAction", false)); await page.evaluate(() => mount("client", "formAction")); await page.waitForTimeout(100);
    await page.click("#open"); await page.click("#ok"); await page.waitForTimeout(200);
    return st(page);
  },
  async lowercaseAutofocusClient(page) {
    await page.setContent(page_("autofocus", false)); await page.evaluate(() => mount("client", "autofocus")); await page.waitForTimeout(100);
    const attr = await page.evaluate(() => document.getElementById("af").getAttribute("autofocus"));
    await page.click("#open"); await page.waitForTimeout(50);
    return { attr, ...(await st(page)) };
  },
  async reactAutoFocusClient(page) {
    await page.setContent(page_("autoFocusReact", false)); await page.evaluate(() => mount("client", "autoFocusReact")); await page.waitForTimeout(100);
    const attr = await page.evaluate(() => document.getElementById("af").getAttribute("autofocus"));
    const activeAtMount = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
    await page.click("#open"); await page.waitForTimeout(50);
    return { attr, activeAtMount, ...(await st(page)) };
  },
  async reactAutoFocusHydrated(page) {
    await page.setContent(page_("autoFocusReact", true)); await page.evaluate(() => mount("hydrate", "autoFocusReact")); await page.waitForTimeout(100);
    const attr = await page.evaluate(() => document.getElementById("af").getAttribute("autofocus"));
    await page.click("#open"); await page.waitForTimeout(50);
    return { attr, ...(await st(page)) };
  },
};
const only = process.argv[2];
for (const name of ["chromium", "firefox"]) {
  const b = await pw[name].launch();
  console.log(`\n##### ${name} ${b.version()}`);
  for (const [k, fn] of Object.entries(scenarios)) {
    if (only && k !== only) continue;
    const page = await b.newPage();
    try { console.log(k, JSON.stringify(await fn(page))); } catch (e) { console.log(k, "ERROR", String(e).slice(0, 300)); }
    await page.close();
  }
  await b.close();
}

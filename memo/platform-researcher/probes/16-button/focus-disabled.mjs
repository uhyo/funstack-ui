// Button research (#79), 2026-10-18. Run: node focus-disabled.mjs
// 1. A focused <button> becomes `disabled`: where is focus afterwards, and where does Tab go?
// 2. The same with `aria-disabled="true"`.
// 3. Implicit submission (Enter in a text field) while the form's default button is disabled.
// 4. Chromium AX: does `aria-busy` on a button surface as a property; what are name/role?
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");

const html = `
<button id="before">before</button>
<button id="b">Save</button>
<button id="after">after</button>
<form id="f"><input id="t" aria-label="t"><button id="s">Submit</button></form>
<button id="busy" aria-busy="true">Busy</button>
<button id="ad" aria-disabled="true">AriaDisabled</button>`;

for (const name of ["chromium", "firefox", "webkit"]) {
  let browser;
  try {
    browser = await pw[name].launch();
  } catch (e) {
    console.log(name, "cannot launch:", String(e.message).split("\n")[0]);
    continue;
  }
  const page = await browser.newPage();
  await page.setContent(html);
  const out = { version: browser.version() };

  // 1. native disabled while focused
  await page.focus("#b");
  out.disabled = await page.evaluate(async () => {
    const b = document.getElementById("b");
    const log = [];
    let blurred = false;
    b.addEventListener("blur", () => (blurred = true));
    b.disabled = true;
    log.push(["sync", document.activeElement.id || document.activeElement.tagName, ":focus", b.matches(":focus")]);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    log.push(["2rAF", document.activeElement.id || document.activeElement.tagName, ":focus", b.matches(":focus"), "blur", blurred]);
    return log;
  });
  await page.keyboard.press("Tab");
  out.disabledThenTab = await page.evaluate(() => document.activeElement.id || document.activeElement.tagName);
  await page.evaluate(() => (document.getElementById("b").disabled = false));

  // 1b. Does Enter / Space on the disabled-but-still-active element do anything?
  await page.focus("#b");
  out.keyAfterDisable = await page.evaluate(() => {
    const b = document.getElementById("b");
    window.__clicks = 0;
    b.addEventListener("click", () => window.__clicks++);
    b.disabled = true;
    return null;
  });
  await page.keyboard.press("Enter");
  await page.keyboard.press(" ");
  out.keyAfterDisable = await page.evaluate(() => window.__clicks);
  await page.evaluate(() => (document.getElementById("b").disabled = false));

  // 2. aria-disabled while focused
  await page.focus("#b");
  out.ariaDisabled = await page.evaluate(async () => {
    const b = document.getElementById("b");
    b.setAttribute("aria-disabled", "true");
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return document.activeElement.id;
  });

  // 3. implicit submission with the default button disabled / type flipped to button
  out.implicit = {};
  for (const mode of ["enabled", "disabled", "type=button"]) {
    out.implicit[mode] = await page.evaluate(async (mode) => {
      const f = document.getElementById("f");
      const s = document.getElementById("s");
      s.disabled = mode === "disabled";
      s.type = mode === "type=button" ? "button" : "submit";
      window.__submits = 0;
      f.onsubmit = (e) => { e.preventDefault(); window.__submits++; };
      return null;
    }, mode);
    await page.focus("#t");
    await page.keyboard.press("Enter");
    out.implicit[mode] = await page.evaluate(() => window.__submits);
  }

  // 4. Chromium AX tree
  if (name === "chromium") {
    const cdp = await page.context().newCDPSession(page);
    const { nodes } = await cdp.send("Accessibility.getFullAXTree");
    out.ax = nodes
      .filter((n) => n.role?.value === "button")
      .map((n) => [n.name?.value, (n.properties || []).map((p) => `${p.name}=${JSON.stringify(p.value.value)}`).join(" ")]);
  }
  console.log(name, JSON.stringify(out, null, 1));
  await browser.close();
}

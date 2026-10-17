// <dialog popover> vs <div popover role=dialog> as a Popover primitive: initial focus, Escape, focus return.
// Run: node dialog-popover.mjs (Chromium + Firefox)
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const HTML = `<style>[popover]{margin:0;position:fixed;position-area:block-end}</style>
<button id="t1" commandfor="d1" command="toggle-popover">dialog popover</button>
<button id="t2" commandfor="d2" command="toggle-popover">div popover</button>
<button id="t3" commandfor="d3" command="toggle-popover">dialog popover, tabindex=-1 first</button>
<dialog id="d1" popover><p>text</p><button id="d1b">inside</button></dialog>
<div id="d2" popover role="dialog"><p>text</p><button id="d2b">inside</button></div>
<dialog id="d3" popover><h2 tabindex="-1" id="d3h">Heading</h2><button id="d3b">inside</button></dialog>
<dialog id="d4" popover><p>no focusable</p></dialog>`;
for (const name of ["chromium", "firefox"]) {
  const b = await pw[name].launch(); const page = await b.newPage(); page.setDefaultTimeout(3000);
  await page.setContent(HTML);
  const af = () => page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
  const r = {};
  for (const [t, d] of [["t1", "d1"], ["t2", "d2"], ["t3", "d3"]]) {
    await page.focus("#" + t); await page.keyboard.press("Enter"); await page.waitForTimeout(50);
    r[`${d}:focusAfterOpen`] = await af();
    r[`${d}:open/modal`] = await page.evaluate((d) => { const e = document.getElementById(d); return `${e.matches(":popover-open")}/${e.matches(":modal")}/open-attr=${e.hasAttribute("open")}`; }, d);
    await page.keyboard.press("Escape"); await page.waitForTimeout(50);
    r[`${d}:afterEscape`] = await af() + " open=" + await page.evaluate((d) => document.getElementById(d).matches(":popover-open"), d);
  }
  await page.evaluate(() => document.getElementById("d4").showPopover()); r["d4:focusNoFocusable"] = await af();
  console.log(name, b.version(), JSON.stringify(r, null, 1));
  if (name === "chromium") {
    await page.evaluate(() => document.getElementById("d4").hidePopover());
    await page.click("#t1");
    const cdp = await page.context().newCDPSession(page);
    const { nodes } = await cdp.send("Accessibility.getFullAXTree");
    console.log(nodes.filter((n) => !n.ignored && ["dialog", "button", "group"].includes(n.role?.value)).map((n) => `  ${n.role.value} "${n.name?.value}" ${(n.properties ?? []).filter((p) => ["modal", "expanded", "details", "hasPopup"].includes(p.name)).map((p) => `${p.name}=${JSON.stringify(p.value.value)}`).join(" ")}`).join("\n"));
  }
  await b.close();
}

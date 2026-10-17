// Focus return when Escape closes a submenu (auto popover nested via invoker), and Tab-out behaviour.
// Run: node submenu-focus.mjs (Chromium + Firefox)
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const HTML = `<style>[popover]{margin:0;position:fixed;position-area:block-end span-inline-end}.sub{position-area:span-block-end inline-end}[popover]:popover-open{display:flex;flex-direction:column}</style>
<button id="t" commandfor="m" command="toggle-popover">Menu</button><button id="after">after</button>
<div id="m" popover role="menu"><button id="i1" role="menuitem">Item</button><button id="si" role="menuitem" commandfor="s" command="toggle-popover">More</button></div>
<div id="s" popover role="menu" class="sub"><button id="s1" role="menuitem">Sub 1</button><button id="s2" role="menuitem">Sub 2</button></div>`;
for (const name of ["chromium", "firefox"]) {
  const b = await pw[name].launch(); const page = await b.newPage(); page.setDefaultTimeout(3000);
  await page.setContent(HTML);
  const st = () => page.evaluate(() => (["m", "s"].filter((id) => document.getElementById(id).matches(":popover-open")).join(",") || "(none)") + " focus=" + document.activeElement?.id);
  const r = {};
  await page.focus("#t"); await page.keyboard.press("Enter"); await page.focus("#si"); await page.keyboard.press("Enter"); await page.waitForTimeout(50);
  r.subOpenFocus = await st();
  await page.focus("#s2"); await page.keyboard.press("Escape"); await page.waitForTimeout(50); r.escInSub = await st();
  await page.keyboard.press("Escape"); await page.waitForTimeout(50); r.escInMenu = await st();
  await page.focus("#t"); await page.keyboard.press("Enter"); await page.focus("#si"); await page.keyboard.press("Enter"); await page.focus("#s2");
  await page.keyboard.press("Tab"); await page.waitForTimeout(50); r.tabFromLastSubItem = await st();
  await page.evaluate(() => document.getElementById("s").hidePopover({})); await page.waitForTimeout(50); r.hideSubFromScript = await st();
  console.log(name, b.version(), JSON.stringify(r));
  await b.close();
}

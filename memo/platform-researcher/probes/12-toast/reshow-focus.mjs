// Does hide+show of a manual popover (to raise it in the top layer) lose focus inside it
// or close an open auto popover? Run: node reshow-focus.mjs
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const PAGE = `<div id="menu" popover="auto"><button id="mi">mi</button></div>
<section id="region" popover="manual"><button id="t">toast btn</button></section>`;
for (const name of ["chromium", "firefox"]) {
  const b = await pw[name].launch(); const p = await b.newPage(); await p.setContent(PAGE);
  const r = await p.evaluate(() => {
    const reg = document.getElementById("region"), menu = document.getElementById("menu");
    reg.showPopover(); document.getElementById("t").focus();
    menu.showPopover();
    const menuOpenAfterShow = menu.matches(":popover-open");
    const activeAfterMenu = document.activeElement.id;
    document.getElementById("t").focus();
    const menuOpenAfterFocusToast = menu.matches(":popover-open");
    reg.hidePopover(); reg.showPopover();
    return { menuOpenAfterShow, activeAfterMenu, menuOpenAfterFocusToast, activeAfterReshow: document.activeElement.id || document.activeElement.tagName, menuOpenAfterReshow: menu.matches(":popover-open") };
  });
  console.log(name, b.version(), JSON.stringify(r)); await b.close();
}

// Context menu research (#45), 2026-10-22. Run: node pointerup-dismiss.mjs
// A popover="auto" shown from a `contextmenu` listener (Linux/macOS: fires between pointerdown
// and pointerup). When the pointerup lands outside the popover, does light dismiss close it?
// Variants: popover far away from the pointer; preceded by a left click elsewhere (resets
// state); pointer moved between down and up.
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const html = `<!doctype html><style>body{margin:0}#region{position:absolute;left:100px;top:100px;width:300px;height:200px;background:#eee}
#menu{margin:0;position:fixed;inset:auto;left:500px;top:400px;width:120px;height:80px}</style>
<div id="region"></div><div id="menu" popover="auto"><button>Item</button></div><script>
window.log=[];const menu=document.getElementById('menu');
menu.addEventListener('toggle',e=>log.push('toggle '+e.newState));
for(const t of ['pointerdown','pointerup','contextmenu']) document.addEventListener(t,e=>log.push(t+' '+(e.target.id||e.target.tagName)+' btn='+e.button),true);
document.getElementById('region').addEventListener('contextmenu',e=>{e.preventDefault();menu.showPopover();log.push('shown');});
</script>`;
for (const name of ["chromium", "firefox"]) {
  const browser = await pw[name].launch();
  const page = await browser.newPage();
  await page.setContent(html);
  const out = { version: browser.version() };
  const take = async () => { await page.waitForTimeout(100); return page.evaluate(() => { const l = log; log = []; return [l, menu.matches(":popover-open")]; }); };
  await page.mouse.click(250, 250, { button: "right" });
  out.farAway = await take();
  await page.evaluate(() => menu.matches(":popover-open") && menu.hidePopover()); await take();
  await page.mouse.click(250, 250, { button: "right" });
  out.farAway_again = await take();
  await page.evaluate(() => menu.matches(":popover-open") && menu.hidePopover()); await take();
  await page.mouse.move(250, 250);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(260, 270);
  await page.mouse.up({ button: "right" });
  out.moved = await take();
  console.log(JSON.stringify(out));
  await browser.close();
}

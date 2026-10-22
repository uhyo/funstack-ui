// Context menu research (#45), 2026-10-22. Run: node events2.mjs
// E. pointerId / pointerType / button of keyboard vs mouse contextmenu (Chromium).
// F. Chromium touch long-press via Input.synthesizeTapGesture (duration 1000 ms).
// G. Firefox/Chromium: a popover shown from contextmenu (fires on mousedown on Linux) that does
//    NOT cover the pointer at pointerup (flipped up-left): is it light-dismissed by the pointerup?
// H. Left-click outside / right-click outside / middle-click outside while open.
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");

const html = `<!doctype html>
<style>body{margin:0} #region{position:absolute;left:100px;top:100px;width:300px;height:200px;background:#eee}
#btn{position:absolute;left:20px;top:30px;width:100px;height:40px}
#menu{margin:0;position:fixed;inset:auto;width:120px;height:80px}</style>
<div id="region"><button id="btn">in region</button></div>
<div id="menu" popover="auto"><button id="item">Item</button></div>
<script>
window.log=[];
const menu=document.getElementById('menu');
menu.addEventListener('toggle', e=>log.push('toggle '+e.newState));
document.addEventListener('contextmenu', e=>log.push(['contextmenu', e.target.id||e.target.tagName, 'button='+e.button, 'pointerId='+e.pointerId, 'pt='+JSON.stringify(e.pointerType), 'xy='+e.clientX+','+e.clientY, 'ctrl='+e.ctrlKey].join(' ')), true);
window.mode='below-right';
document.getElementById('region').addEventListener('contextmenu', e=>{
  e.preventDefault();
  if(menu.matches(':popover-open')) menu.hidePopover();
  // 'up-left': the menu's bottom-right corner sits at the pointer (what a flip produces)
  if(window.mode==='up-left'){ menu.style.left=(e.clientX-120)+'px'; menu.style.top=(e.clientY-80)+'px'; }
  else { menu.style.left=e.clientX+'px'; menu.style.top=e.clientY+'px'; }
  menu.showPopover();
});
document.addEventListener('contextmenu', e=>e.preventDefault());
</script>`;

for (const name of ["chromium", "firefox"]) {
  const browser = await pw[name].launch();
  const out = { version: browser.version() };
  const page = await browser.newPage();
  await page.setContent(html);
  const take = () => page.evaluate(() => { const l = window.log; window.log = []; return l; });
  const isOpen = () => page.evaluate(() => menu.matches(":popover-open"));
  await page.mouse.click(250, 250, { button: "right" });
  out.E_mouse = await take();
  await page.evaluate(() => menu.hidePopover()); await take();
  await page.focus("#btn");
  await page.keyboard.press("ContextMenu");
  out.E_key = await take();
  await page.evaluate(() => menu.hidePopover()); await take();

  await page.evaluate(() => (window.mode = "up-left"));
  await page.mouse.click(300, 250, { button: "right" });
  await page.waitForTimeout(50);
  out.G_upLeft = { log: await take(), open: await isOpen() };
  await page.evaluate(() => (window.mode = "below-right"));
  await page.evaluate(() => menu.matches(":popover-open") && menu.hidePopover()); await take();

  for (const [label, button] of [["left", "left"], ["right", "right"], ["middle", "middle"]]) {
    await page.mouse.click(250, 250, { button: "right" });
    await page.waitForTimeout(30);
    await take();
    await page.mouse.click(600, 500, { button });
    await page.waitForTimeout(50);
    out["H_" + label + "ClickOutside_open"] = await isOpen();
    await page.evaluate(() => menu.matches(":popover-open") && menu.hidePopover()); await take();
  }

  if (name === "chromium") {
    const ctx = await browser.newContext({ hasTouch: true, isMobile: true });
    const tp = await ctx.newPage();
    await tp.setContent(html);
    await tp.evaluate(() => { for (const t of ["pointerdown","pointerup","pointercancel","touchstart","touchend","touchcancel","click","mousedown","selectstart"]) document.addEventListener(t, e => log.push(t + " pt=" + (e.pointerType ?? "-")), true); });
    const cdp = await ctx.newCDPSession(tp);
    await cdp.send("Input.synthesizeTapGesture", { x: 250, y: 250, duration: 1000, tapCount: 1, gestureSourceType: "touch" });
    await tp.waitForTimeout(200);
    out.F_longPress = { log: await tp.evaluate(() => window.log), open: await tp.evaluate(() => menu.matches(":popover-open")) };
    await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
}

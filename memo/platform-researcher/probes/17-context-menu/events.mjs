// Context menu research (#45), 2026-10-22. Run: node events.mjs
// A. Event sequence and coordinates for a mouse right-click.
// B. Keyboard ContextMenu key and Shift+F10: does `contextmenu` fire, on what target, where?
// C. Touch long-press (Chromium touch emulation via CDP).
// D. A popover="auto" shown from the contextmenu handler: does the following pointerup / mouseup
//    light-dismiss it? Right-click outside / inside while open.
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");

const html = `<!doctype html>
<style>body{margin:0} #region{position:absolute;left:100px;top:100px;width:300px;height:200px;background:#eee}
#btn{position:absolute;left:20px;top:30px;width:100px;height:40px}
#other{position:absolute;left:500px;top:100px;width:200px;height:200px;background:#ddd}
#menu{margin:0;position:fixed;inset:auto;left:0;top:0;width:120px;height:80px}</style>
<div id="region"><button id="btn">in region</button><span id="txt" style="position:absolute;left:20px;top:120px">some text</span></div>
<div id="other" tabindex="-1">other</div>
<div id="menu" popover="auto"><button id="item">Item</button></div>
<script>
window.log=[];
const fmt=e=>[e.type, e.target.id||e.target.tagName, 'btn='+e.button, 'buttons='+e.buttons, 'pt='+(e.pointerType??'-'), 'xy='+e.clientX+','+e.clientY, 'detail='+e.detail, 'ctor='+e.constructor.name, 'trusted='+e.isTrusted].join(' ');
for (const t of ['pointerdown','mousedown','pointerup','mouseup','click','auxclick','contextmenu','keydown','keyup','pointercancel','touchstart','touchend','focusin'])
  document.addEventListener(t, e=>log.push(t.startsWith('key')?[t,e.key,e.shiftKey,(e.target.id||e.target.tagName)].join(' '):t==='focusin'?'focusin '+(e.target.id||e.target.tagName):fmt(e)), true);
const menu=document.getElementById('menu');
menu.addEventListener('toggle', e=>log.push('toggle '+e.newState));
window.openOnCtx=false;
document.getElementById('region').addEventListener('contextmenu', e=>{
  if(!window.openOnCtx) return;
  e.preventDefault();
  if(menu.matches(':popover-open')) menu.hidePopover();
  menu.style.left=e.clientX+'px'; menu.style.top=e.clientY+'px';
  menu.showPopover({source: document.getElementById('region')});
  log.push('shown at '+e.clientX+','+e.clientY);
});
document.addEventListener('contextmenu', e=>{ if(window.preventAll) e.preventDefault(); });
</script>`;

for (const name of ["chromium", "firefox"]) {
  const browser = await pw[name].launch();
  const out = { version: browser.version() };
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.setContent(html);
  await page.evaluate(() => (window.preventAll = true));
  const take = () => page.evaluate(() => { const l = window.log; window.log = []; return l; });

  // A
  await page.mouse.click(250, 250, { button: "right" });
  out.A_rightClickRegion = await take();
  // B
  await page.focus("#btn");
  await take();
  await page.keyboard.press("ContextMenu");
  out.B_contextMenuKey_onButton = await take();
  await page.keyboard.press("Shift+F10");
  out.B_shiftF10_onButton = await take();
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press("ContextMenu");
  out.B_contextMenuKey_noFocus = await take();
  // selection-based keyboard
  await page.evaluate(() => { const r = document.createRange(); r.selectNodeContents(document.getElementById("txt")); getSelection().removeAllRanges(); getSelection().addRange(r); });
  await page.keyboard.press("ContextMenu");
  out.B_contextMenuKey_withSelection = await take();
  await page.evaluate(() => getSelection().removeAllRanges());

  // D: popover shown from contextmenu
  await page.evaluate(() => (window.openOnCtx = true));
  await page.mouse.click(250, 250, { button: "right" });
  await page.waitForTimeout(50);
  out.D1_openedFromRightClick = { log: await take(), open: await page.evaluate(() => menu.matches(":popover-open")) };
  // manual down/up split to see whether pointerup after show dismisses
  await page.evaluate(() => menu.hidePopover());
  await take();
  await page.mouse.move(260, 260);
  await page.mouse.down({ button: "right" });
  const afterDown = await page.evaluate(() => menu.matches(":popover-open"));
  await page.mouse.up({ button: "right" });
  await page.waitForTimeout(50);
  out.D2_split = { log: await take(), openAfterDown: afterDown, openAfterUp: await page.evaluate(() => menu.matches(":popover-open")) };
  // right-click inside the menu while open
  const r = await page.evaluate(() => { const b = menu.getBoundingClientRect(); return [b.x + 60, b.y + 70]; });
  await page.mouse.click(r[0], r[1], { button: "right" });
  await page.waitForTimeout(50);
  out.D3_rightClickInsideMenu = { log: await take(), open: await page.evaluate(() => menu.matches(":popover-open")) };
  // right-click in another place of the region while open: reposition?
  await page.mouse.click(150, 280, { button: "right" });
  await page.waitForTimeout(50);
  out.D4_rightClickElsewhereInRegion = { log: await take(), open: await page.evaluate(() => menu.matches(":popover-open")), rect: await page.evaluate(() => { const b = menu.getBoundingClientRect(); return [b.x, b.y]; }) };
  // right-click outside the region (on #other) while open
  await page.mouse.click(600, 200, { button: "right" });
  await page.waitForTimeout(50);
  out.D5_rightClickOutsideRegion = { log: await take(), open: await page.evaluate(() => menu.matches(":popover-open")) };
  // keyboard open then escape: focus return
  await page.focus("#btn");
  await page.keyboard.press("Shift+F10");
  await page.waitForTimeout(50);
  out.D6_kbdOpen = { log: await take(), open: await page.evaluate(() => menu.matches(":popover-open")), active: await page.evaluate(() => document.activeElement.id) };
  await page.focus("#item");
  await page.keyboard.press("Escape");
  out.D6_afterEscape = { open: await page.evaluate(() => menu.matches(":popover-open")), active: await page.evaluate(() => document.activeElement.id || document.activeElement.tagName) };
  // right-click on non-focusable region area: where does focus go? escape returns where?
  await page.focus("#other");
  await page.mouse.click(250, 250, { button: "right" });
  await page.waitForTimeout(50);
  out.D7_focusAfterRightClickRegion = await page.evaluate(() => document.activeElement.id || document.activeElement.tagName);
  await page.focus("#item");
  await page.keyboard.press("Escape");
  out.D7_focusAfterEscape = await page.evaluate(() => document.activeElement.id || document.activeElement.tagName);
  await take();
  await ctx.close();

  // C: touch long press
  if (name === "chromium") {
    const tctx = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 800, height: 600 } });
    const tp = await tctx.newPage();
    await tp.setContent(html);
    await tp.evaluate(() => (window.preventAll = true));
    const cdp = await tctx.newCDPSession(tp);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 250, y: 250 }] });
    await tp.waitForTimeout(1200);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await tp.waitForTimeout(100);
    out.C_touchLongPress = await tp.evaluate(() => window.log);
    await tctx.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
}

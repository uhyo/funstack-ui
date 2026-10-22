// Wave 11 research (#88), 2026-10-22. Run: node touch-drag.mjs
// Touch long-press, then drag onto a menu item and lift (Chromium touch emulation via CDP; real
// Android / iOS not available). The page scrolls; the region has the default touch-action. The
// menu opens 500 ms after pointerdown (library timer) with setPointerCapture on the popup, as
// Menu.ContextTrigger does, and the `contextmenu` is prevented. Variant "block": a non-passive
// document touchmove listener calls preventDefault() while the menu is open.
// Does the browser pan (pointercancel, scroll) or keep delivering pointermove / pointerup?
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");

const html = (block) => `<!doctype html><style>body{margin:0;height:3000px}
#region{position:absolute;left:50px;top:100px;width:300px;height:300px;background:#eee;-webkit-touch-callout:none;user-select:none}
#menu{margin:0;padding:0;position:fixed;inset:auto;width:150px} #menu div{height:40px}</style>
<div id="region"></div>
<div id="menu" popover="auto"><div id="i1">One</div><div id="i2">Two</div></div>
<script>
window.log=[];const menu=document.getElementById('menu');const id=n=>n&&(n.id||n.tagName);
let last='';
for (const t of ['pointerdown','pointermove','pointerup','pointercancel','contextmenu','click','touchend','lostpointercapture'])
  document.addEventListener(t,e=>{const s=t+' '+id(e.target)+(e.clientX!==undefined?' from='+id(document.elementFromPoint(e.clientX,e.clientY)):'')+(t==='contextmenu'?' ':'');
    if(t==='pointermove'&&s===last) return; last=s; log.push(s+' t='+Math.round(e.timeStamp));},true);
document.addEventListener('scroll',()=>log.push('scroll y='+scrollY),true);
document.addEventListener('contextmenu',e=>e.preventDefault());
menu.addEventListener('toggle',e=>log.push('toggle '+e.newState));
document.getElementById('region').addEventListener('pointerdown',e=>{
  const {pointerId,clientX,clientY}=e;
  setTimeout(()=>{ try{menu.setPointerCapture(pointerId);log.push('captured')}catch(x){log.push('capture failed '+x.name)}
    menu.style.left=clientX+'px';menu.style.top=(clientY+10)+'px';menu.showPopover();},500);
});
${block ? "document.addEventListener('touchmove',e=>{if(menu.matches(':popover-open')){e.preventDefault()}},{passive:false});" : ""}
</script>`;

const browser = await pw.chromium.launch();
for (const block of [false, true]) {
  const ctx = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 400, height: 600 } });
  const p = await ctx.newPage();
  await p.setContent(html(block));
  const cdp = await ctx.newCDPSession(p);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 150, y: 200 }] });
  await p.waitForTimeout(800);
  for (let i = 1; i <= 10; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 150 + i * 2, y: 200 + i * 6 }] });
    await p.waitForTimeout(30);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await p.waitForTimeout(300);
  console.log(`== Chromium ${browser.version()} touch, block=${block}`);
  for (const l of await p.evaluate(() => log)) console.log("  " + l);
  console.log("  open after lift: " + (await p.evaluate(() => menu.matches(":popover-open"))) + ", scrollY=" + (await p.evaluate(() => scrollY)));
  await ctx.close();
}
await browser.close();

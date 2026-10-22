// Wave 11 research (#88), 2026-10-22. Run: node drag-release.mjs
// Press-drag-release with the right button: the popup is opened in `contextmenu` (fired at
// pointerdown on Linux in Chromium and Firefox) with `setPointerCapture` on the still-hidden popup,
// as Menu.ContextTrigger does. While the button is held and the pointer moves onto an item:
// which element gets pointermove / pointerover / pointerup / mouseup / click / auxclick, does the
// item match :hover, and what does elementFromPoint return? Variant "nocapture" for comparison.
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");

const html = (capture) => `<!doctype html>
<style>body{margin:0} #region{position:absolute;left:100px;top:100px;width:300px;height:200px;background:#eee}
#menu{margin:0;padding:4px;position:fixed;inset:auto;width:120px} #menu div{height:30px}
#menu div:hover{background:yellow}</style>
<div id="region"></div>
<div id="menu" popover="auto"><div id="i1" role="menuitem">One</div><div id="i2" role="menuitem">Two</div></div>
<script>
window.log=[];const menu=document.getElementById('menu');
const id=n=>n&&(n.id||n.tagName);
for (const t of ['pointermove','pointerover','pointerup','mouseup','click','auxclick','gotpointercapture','lostpointercapture','pointercancel'])
  document.addEventListener(t,e=>{ if(t==='pointermove'&&window.quiet) return;
    log.push(t+' target='+id(e.target)+' btn='+e.button+' buttons='+e.buttons+(e.clientX!==undefined?' fromPoint='+id(document.elementFromPoint(e.clientX,e.clientY)):'')+' i2hover='+document.getElementById('i2').matches(':hover'));},true);
menu.addEventListener('toggle',e=>log.push('toggle '+e.newState));
document.getElementById('region').addEventListener('contextmenu',e=>{
  e.preventDefault(); log.push('contextmenu buttons='+e.buttons+' pointerId='+e.pointerId);
  if(${capture} && e.buttons) { try{menu.setPointerCapture(e.pointerId);log.push('captured')}catch(x){log.push('capture failed '+x.name)} }
  menu.style.left=e.clientX+'px';menu.style.top=e.clientY+'px';menu.showPopover();
});
</script>`;

for (const type of ["chromium", "firefox"]) {
  const browser = await pw[type].launch();
  for (const capture of [true, false]) {
    const p = await browser.newPage();
    await p.setContent(html(capture));
    await p.mouse.move(150, 150);
    await p.mouse.down({ button: "right" });
    await p.mouse.move(170, 175, { steps: 3 }); // onto i1
    await p.mouse.move(175, 205, { steps: 3 }); // onto i2 (menu top 150 + 4 padding + 30)
    await p.evaluate(() => log.push("-- before release: i2 :hover=" + document.getElementById("i2").matches(":hover")));
    await p.mouse.up({ button: "right" });
    await p.waitForTimeout(100);
    const open = await p.evaluate(() => document.getElementById("menu").matches(":popover-open"));
    console.log(`== ${type} ${browser.version()} capture=${capture}`);
    for (const l of await p.evaluate(() => log)) console.log("  " + l);
    console.log("  open after release: " + open);
    await p.close();
  }
  await browser.close();
}

// Context menu research (#45), 2026-10-22. Run: node pointerup-workarounds.mjs
// whatwg/html#10905 workarounds for a popover shown from `contextmenu` while the right button is
// still down (Linux/macOS), pointer far from the popover:
//  capture-after-show: showPopover(); popover.setPointerCapture(e.pointerId)   (nuxodin)
//  capture-before-show: popover.setPointerCapture(e.pointerId); showPopover()
//  defer: wait for pointerup/pointercancel on window, then showPopover()
//  defer-microtask: queueMicrotask(show) (to see whether "later in the same task" helps)
// Then: does a later left click outside still light-dismiss, and does a click on an item work?
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const html = `<!doctype html><style>body{margin:0}#region{position:absolute;left:100px;top:100px;width:300px;height:200px;background:#eee}
#menu{margin:0;position:fixed;inset:auto;left:500px;top:400px;width:120px;height:80px}</style>
<div id="region"></div><div id="menu" popover="auto"><button id="item" style="width:100%;height:100%">Item</button></div><script>
window.log=[];const menu=document.getElementById('menu');
menu.addEventListener('toggle',e=>log.push('toggle '+e.newState));
document.getElementById('item').addEventListener('click',()=>log.push('item click'));
for(const t of ['pointerup','gotpointercapture','lostpointercapture']) document.addEventListener(t,e=>log.push(t+' '+(e.target.id||e.target.tagName)),true);
window.mode='none';
document.getElementById('region').addEventListener('contextmenu',e=>{
  e.preventDefault();
  log.push('contextmenu buttons='+e.buttons);
  const m=window.mode;
  if(m==='capture-after-show'){menu.showPopover(); if(e.buttons) menu.setPointerCapture(e.pointerId);}
  else if(m==='capture-before-show'){ if(e.buttons) { try{menu.setPointerCapture(e.pointerId);}catch(err){log.push('capture threw '+err.name);} } menu.showPopover();}
  else if(m==='defer'){ if(!e.buttons){menu.showPopover();return;} const ac=new AbortController(); const go=()=>{ac.abort();menu.showPopover();log.push('shown after up');}; addEventListener('pointerup',go,{capture:true,signal:ac.signal}); addEventListener('pointercancel',go,{capture:true,signal:ac.signal}); }
  else if(m==='defer-microtask'){ queueMicrotask(()=>menu.showPopover()); }
  else if(m==='defer-task'){ setTimeout(()=>menu.showPopover()); }
  else menu.showPopover();
});
</script>`;
for (const name of ["chromium", "firefox"]) {
  const browser = await pw[name].launch();
  const page = await browser.newPage();
  await page.setContent(html);
  const out = { version: browser.version() };
  const take = async () => { await page.waitForTimeout(100); return page.evaluate(() => { const l = log; log = []; return [l.join(" | "), menu.matches(":popover-open")]; }); };
  for (const mode of ["none", "capture-after-show", "capture-before-show", "defer", "defer-microtask", "defer-task"]) {
    await page.evaluate((m) => { window.mode = m; menu.matches(":popover-open") && menu.hidePopover(); log = []; }, mode);
    await page.mouse.click(250, 250, { button: "right" });
    const r = { rightClick: await take() };
    if (r.rightClick[1]) {
      await page.mouse.click(560, 440);
      r.clickItem = await take();
      await page.evaluate(() => menu.showPopover()); await take();
      await page.mouse.click(50, 50);
      r.leftClickOutside = await take();
    }
    out[mode] = r;
  }
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
}

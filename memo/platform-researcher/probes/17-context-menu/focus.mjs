// Context menu research (#45), 2026-10-22. Run: node focus.mjs
// Where does focus go when a context menu (popover="auto", first item focused on open, pointer
// captured while the right button is down) closes by Escape or by hidePopover() (item activation)?
//  R0: right-click on a non-focusable region (focus was on #before)
//  R1: right-click on a focusable region (tabindex=0)
//  R2: right-click on a focusable button inside the region
//  K : keyboard (Shift+F10) on the button inside the region (Chromium only; Playwright cannot
//      make Firefox fire a keyboard contextmenu)
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const html = `<!doctype html><style>body{margin:0}.r{position:absolute;width:200px;height:100px;background:#eee}
#menu{margin:0;inset:auto;position:fixed;left:600px;top:400px}</style>
<button id="before">before</button>
<div class="r" id="r0" style="left:50px;top:100px">plain region</div>
<div class="r" id="r1" tabindex="0" style="left:300px;top:100px">focusable region</div>
<div class="r" id="r2" style="left:50px;top:250px"><button id="b2">row button</button></div>
<div id="menu" popover="auto"><button id="i1">One</button><button id="i2">Two</button></div><script>
const menu=document.getElementById('menu');
for (const id of ['r0','r1','r2']) document.getElementById(id).addEventListener('contextmenu',e=>{
  e.preventDefault();
  if (e.buttons) menu.setPointerCapture(e.pointerId);
  menu.showPopover({source:e.currentTarget});
  document.getElementById('i1').focus();
});
</script>`;
for (const name of ["chromium", "firefox"]) {
  const browser = await pw[name].launch();
  const page = await browser.newPage();
  await page.setContent(html);
  const active = () => page.evaluate(() => document.activeElement.id || document.activeElement.tagName);
  const isOpen = () => page.evaluate(() => menu.matches(":popover-open"));
  const out = { version: browser.version() };
  for (const [label, sel] of [["R0", "#r0"], ["R1", "#r1"], ["R2", "#b2"]]) {
    for (const close of ["Escape", "hidePopover"]) {
      await page.focus("#before");
      await page.click(sel, { button: "right" });
      await page.waitForTimeout(50);
      const r = { openFocus: await active(), open: await isOpen() };
      if (close === "Escape") await page.keyboard.press("Escape");
      else await page.evaluate(() => menu.hidePopover());
      await page.waitForTimeout(50);
      r.afterClose = await active();
      out[`${label}_${close}`] = r;
    }
  }
  if (name === "chromium") {
    await page.focus("#b2");
    await page.keyboard.press("Shift+F10");
    await page.waitForTimeout(50);
    const r = { openFocus: await active(), open: await isOpen() };
    await page.keyboard.press("Escape");
    r.afterClose = await active();
    out.K_Escape = r;
  }
  console.log(JSON.stringify(out));
  await browser.close();
}

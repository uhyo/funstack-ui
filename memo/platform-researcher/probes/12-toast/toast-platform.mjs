// Toast platform probes (2026-10-17, wave 5). Run: node toast-platform.mjs
// Engines: Chromium 156, Firefox 157 (Playwright). WebKit cannot launch locally.
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");

const PAGE = `<!doctype html><html lang="en"><body>
<style>
  body { margin: 0; font: 16px sans-serif; height: 1500px; }
  #region { position: fixed; inset: auto 16px 16px auto; margin: 0; padding: 8px; border: 1px solid; width: 300px; }
  #region:not(:has(li)) { pointer-events: none; }
  #menu { position: fixed; top: 10px; left: 10px; margin: 0; }
  dialog { top: 0; left: 0; margin: 0; width: 600px; height: 600px; }
</style>
<button id="opener">opener</button>
<input id="field" value="typing">
<div id="menu" popover="auto"><button id="menuitem">menu item</button></div>
<section id="region" popover="manual" role="region" aria-label="Notifications" tabindex="-1">
  <ol id="list"></ol>
</section>
<dialog id="dlg"><button id="dlgbtn">in dialog</button><section id="inner" popover="manual" aria-label="Notifications (dialog)"><button id="innerbtn">inner toast btn</button></section></dialog>
<script>
  window.__log = [];
  for (const t of ["toggle","beforetoggle"]) for (const id of ["menu","region","dlg"]) document.getElementById(id).addEventListener(t, e => __log.push(id+":"+t+":"+e.newState));
  window.addToast = (text) => {
    const li = document.createElement("li");
    li.innerHTML = '<span>'+text+'</span> <button class="close">close</button>';
    document.getElementById("list").append(li);
  };
</script>
</body></html>`;

const ae = () => { const a = document.activeElement; return a ? (a.id ? "#" + a.id : a.tagName) : null; };

for (const name of ["chromium", "firefox"]) {
  const browser = await pw[name].launch();
  const page = await browser.newPage();
  await page.setContent(PAGE);
  console.log(`\n######## ${name} ${browser.version()}`);
  const out = (k, v) => console.log(k.padEnd(52), JSON.stringify(v));

  // 1. showPopover on a manual popover does not move focus, does not close an open auto popover
  await page.focus("#field");
  await page.evaluate(() => document.getElementById("menu").showPopover());
  await page.focus("#menuitem");
  await page.evaluate(() => { addToast("Saved"); document.getElementById("region").showPopover(); });
  out("1 menu still open after manual show", await page.evaluate(() => document.getElementById("menu").matches(":popover-open")));
  out("1 focus after manual show", await page.evaluate(ae));
  out("1 events", await page.evaluate(() => __log.splice(0)));

  // 2. Escape with focus inside the auto menu closes menu, not manual region
  await page.keyboard.press("Escape");
  out("2 after Escape: menu / region open", await page.evaluate(() => [document.getElementById("menu").matches(":popover-open"), document.getElementById("region").matches(":popover-open")]));
  // Escape with focus inside the region
  await page.focus("#list .close");
  await page.keyboard.press("Escape");
  out("2 Escape inside manual region: region open", await page.evaluate(() => document.getElementById("region").matches(":popover-open")));

  // 3. clicking inside the manual region while an auto popover is open: does the auto popover light-dismiss?
  await page.evaluate(() => document.getElementById("menu").showPopover());
  await page.click("#list .close");
  out("3 click in region: menu open?", await page.evaluate(() => document.getElementById("menu").matches(":popover-open")));
  out("3 focus after click in region", await page.evaluate(ae));

  if (name === "chromium") {
    const cdp0 = await page.context().newCDPSession(page);
    await cdp0.send("Accessibility.enable");
    const { nodes } = await cdp0.send("Accessibility.getFullAXTree");
    out("4a AX (chromium) toast nodes before modal", nodes.filter(n => ["Saved", "close", "Notifications"].includes(n.name?.value)).map(n => ({ role: n.role?.value, name: n.name?.value, ignored: n.ignored })));
  }
  // 4. Modal dialog opened after region: z-order and inertness
  await page.evaluate(() => document.getElementById("dlg").showModal());
  const hit = () => page.evaluate(() => { const b = document.querySelector("#list .close").getBoundingClientRect(); const el = document.elementFromPoint(b.x + 5, b.y + 5); return el ? (el.id || el.className || el.tagName) : null; });
  out("4 region still open after showModal", await page.evaluate(() => document.getElementById("region").matches(":popover-open")));
  out("4 hit test on toast button (dialog above)", await hit());
  // re-show region to move it above the dialog in the top layer
  await page.evaluate(() => { const r = document.getElementById("region"); r.hidePopover(); r.showPopover(); });
  out("4 hit test after re-show (region above dialog)", await hit());
  out("4 focus() on toast button works?", await page.evaluate(() => { const b = document.querySelector("#list .close"); b.focus(); return document.activeElement === b; }));
  let clicked = false;
  await page.exposeFunction("__clicked", () => { clicked = true; });
  await page.evaluate(() => document.querySelector("#list .close").addEventListener("click", () => __clicked()));
  try { await page.click("#list .close", { timeout: 1500 }); } catch (e) { out("4 playwright click error", e.message.split("\n")[0]); }
  await page.mouse.click(...(await page.evaluate(() => { const b = document.querySelector("#list .close").getBoundingClientRect(); return [b.x + 5, b.y + 5]; })));
  await page.waitForTimeout(100);
  out("4 click handler ran on re-shown region over modal", clicked);
  out("4 dialog still open", await page.evaluate(() => document.getElementById("dlg").open));
  if (name === "chromium") {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Accessibility.enable");
    const { nodes } = await cdp.send("Accessibility.getFullAXTree");
    const pick = nodes.filter(n => ["Saved", "close", "Notifications", "inner toast btn", "Notifications (dialog)"].includes(n.name?.value) || n.role?.value === "region");
    out("4 AX (chromium) toast nodes while modal open", pick.map(n => ({ role: n.role?.value, name: n.name?.value, ignored: n.ignored, reasons: (n.ignoredReasons || []).map(r => r.name) })));
  }
  // 5. A manual popover inside the dialog subtree
  await page.evaluate(() => document.getElementById("inner").showPopover());
  out("5 inner popover (in dialog) focusable", await page.evaluate(() => { const b = document.getElementById("innerbtn"); b.focus(); return document.activeElement === b; }));
  out("5 inner hit", await page.evaluate(() => { const b = document.getElementById("innerbtn").getBoundingClientRect(); const el = document.elementFromPoint(b.x + 3, b.y + 3); return el?.id; }));
  await page.evaluate(() => document.getElementById("dlg").close());
  out("5 inner popover after dialog close: open / visible / rect height", await page.evaluate(() => { const i = document.getElementById("inner"); return [i.matches(":popover-open"), i.checkVisibility(), i.getBoundingClientRect().height]; }));

  // 6. Top-layer order: two manual popovers, order = most recently shown on top
  out("6 :modal / ariaNotify / interestfor support", await page.evaluate(() => ({
    ariaNotify: typeof Element.prototype.ariaNotify, docAriaNotify: typeof Document.prototype.ariaNotify,
    interestFor: "interestForElement" in HTMLButtonElement.prototype,
    hint: (() => { const d = document.createElement("div"); d.popover = "hint"; return d.popover; })(),
    scrollsnapchange: "onscrollsnapchange" in window, scrollend: "onscrollend" in window,
    elementVT: typeof Element.prototype.startViewTransition,
  })));
  await browser.close();
}

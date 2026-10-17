import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
for (const [n, o] of [["chromium", {}], ["firefox", { firefoxUserPrefs: { "dom.select.customizable_select.enabled": true, "layout.css.appearance-base.enabled": true } }]]) {
  const b = await pw[n].launch(o); const p = await b.newPage();
  await p.setContent(`<style>.c,.c::picker(select){appearance:base-select}</style><button id=x onclick="try{document.getElementById('s').showPicker();window.r='ok'}catch(e){window.r=e.name}">x</button>
  <select id=s class=c><option>A</option><option>B</option></select>`);
  await p.evaluate(() => { window.ev = []; const s = document.getElementById("s"); for (const t of ["beforetoggle", "toggle", "command"]) s.addEventListener(t, (e) => ev.push(t + ":" + (e.newState || ""))); document.addEventListener("toggle", (e) => ev.push("doc-toggle:" + e.target.tagName), true); });
  await p.click("#s"); await p.waitForTimeout(100);
  const a = await p.evaluate(() => ({ open: document.getElementById("s").matches(":open"), ev: ev.splice(0) }));
  await p.keyboard.press("Escape"); await p.waitForTimeout(100);
  const b2 = await p.evaluate(() => ({ open: document.getElementById("s").matches(":open"), ev: ev.splice(0) }));
  await p.click("#x"); await p.waitForTimeout(100);
  const c = await p.evaluate(() => ({ r: window.r, open: document.getElementById("s").matches(":open"), ev: ev.splice(0) }));
  const d = await p.evaluate(() => { const s = document.getElementById("s"); s.blur(); return { afterBlur: s.matches(":open"), hasHidePicker: "hidePicker" in s }; });
  console.log(n, JSON.stringify({ click: a, escape: b2, showPickerFromButton: c, d }));
  await b.close();
}

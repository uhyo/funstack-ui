// Wave 11 research (#88), 2026-10-22. Run: node wheel-over-popup.mjs
// A wheel over an open, non-overflowing popover="auto" menu: does the page underneath scroll?
// Variants: plain; overflow:auto + overscroll-behavior:contain (still not overflowing); a
// non-passive wheel listener on the popup that calls preventDefault().
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");

const html = (v) => `<!doctype html><style>body{margin:0;height:3000px}
#menu{margin:0;position:fixed;inset:auto;left:100px;top:100px;width:120px;height:80px;
${v === "contain" ? "overflow:auto;overscroll-behavior:contain;" : ""}}</style>
<div id="menu" popover="auto">menu</div>
<script>const m=document.getElementById('menu');m.showPopover();
${v === "listener" ? "m.addEventListener('wheel',e=>e.preventDefault(),{passive:false});" : ""}
window.scrolls=0;document.addEventListener('scroll',()=>scrolls++,true);</script>`;

for (const type of ["chromium", "firefox"]) {
  const browser = await pw[type].launch();
  for (const v of ["plain", "contain", "listener"]) {
    const p = await browser.newPage();
    await p.setContent(html(v));
    await p.mouse.move(150, 130);
    await p.mouse.wheel(0, 300);
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => [scrollY, scrolls, document.getElementById("menu").matches(":popover-open")]);
    console.log(`${type} ${browser.version()} ${v.padEnd(8)} page scrollY=${r[0]} scrollEvents=${r[1]} menuOpen=${r[2]}`);
    await p.close();
  }
  await browser.close();
}

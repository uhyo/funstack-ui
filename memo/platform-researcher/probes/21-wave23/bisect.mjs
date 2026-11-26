// Bisect why the first hovercard.mjs run saw no interest on focus: remove one piece of its page at a
// time and check whether keyboard focus on the invoker opens the card within 600 ms.
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const parts = {
  style: `<style>body{margin:0;font:16px sans-serif} #inv{position:absolute;top:100px;left:100px}
#card{margin:0;position:fixed;top:140px;left:100px;width:240px;padding:8px;border:1px solid}
#menu{margin:0;position:fixed;top:10px;left:400px} #after{position:absolute;top:400px;left:100px}</style>`,
  menu: `<button id="menuBtn" popovertarget="menu" style="position:absolute;top:10px;left:10px">menu</button><div id="menu" popover="auto">menu</div>`,
  inv: `<a id="inv" href="#u" interestfor="card">@user</a>`,
  card: `<div id="card" popover="hint"><a id="cardLink" href="#p">Profile</a> <button id="follow">Follow</button><select id="sel"><option>a</option><option>b</option></select></div>`,
  after: `<a id="after" href="#x">after</a>`,
  script: `<script>window.log=[];const card=document.getElementById('card');card.addEventListener('toggle',e=>log.push('card:'+e.newState));</script>`,
};
const b = await pw.chromium.launch();
for (const drop of [null, "style", "menu", "after", "script"]) {
  const html = "<!doctype html>" + Object.entries(parts).filter(([k]) => k !== drop).map(([, v]) => v).join("\n") + (drop === "menu" ? '<button id="menuBtn">x</button>' : "");
  const p = await b.newPage();
  await p.setContent(html);
  await p.evaluate(() => { window.log ??= []; document.getElementById("card").addEventListener("toggle", (e) => log.push("t:" + e.newState)); });
  if (drop === "menu") await p.evaluate(() => document.body.prepend(document.getElementById("menuBtn")));
  await p.focus("#menuBtn");
  await p.keyboard.press("Tab");
  await wait(600);
  console.log("drop", drop, await p.evaluate(() => [document.activeElement.id, document.getElementById("card").matches(":popover-open"), ...log.splice(0)]));
  await p.close();
}
await b.close();

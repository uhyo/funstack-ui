// Wave 23 (#166), 2026-11-26. Run: node nested.mjs
// A hover card (hint | manual | auto, opened with showPopover({source})) that contains a menu button
// (popovertarget -> popover=auto inside the card). Does opening the nested menu keep the card open?
// Does opening the card close an unrelated open auto popover? Escape with focus inside the card?
// Chromium and Firefox (Playwright builds).
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const html = (type) => `<!doctype html><style>[popover]{margin:0} #card{position:fixed;top:100px;left:10px} #inner{position:fixed;top:200px;left:10px} #other{position:fixed;top:10px;left:300px}</style>
<button id="otherBtn" popovertarget="other">other</button><div id="other" popover="auto">other menu</div>
<a id="inv" href="#u">@user</a>
<div id="card" popover="${type}"><button id="menuBtn" popovertarget="inner">More</button><div id="inner" popover="auto"><button id="item">Block</button></div></div>
<script>window.log=[];for(const id of ['card','inner','other'])document.getElementById(id).addEventListener('toggle',e=>log.push(id+':'+e.newState));</script>`;
for (const [name, type] of [["chromium", pw.chromium], ["firefox", pw.firefox]]) {
  const b = await type.launch();
  console.log(`\n### ${name} ${b.version()}`);
  for (const t of ["hint", "manual", "auto"]) {
    const p = await b.newPage();
    await p.setContent(html(t));
    const st = () => p.evaluate(() => ({ card: card.matches(":popover-open"), inner: inner.matches(":popover-open"), other: other.matches(":popover-open"), focus: document.activeElement.id || document.activeElement.tagName, log: log.splice(0) }));
    await p.click("#otherBtn");
    await wait(50);
    await p.evaluate(() => { try { card.showPopover({ source: inv }); } catch (e) { log.push("throw:" + e.name); } });
    await wait(50);
    console.log(t, "open card while other auto open:", JSON.stringify(await st()));
    await p.evaluate(() => { if (!card.matches(":popover-open")) card.showPopover({ source: inv }); });
    await p.click("#menuBtn");
    await wait(50);
    console.log(t, "click menu button inside card:", JSON.stringify(await st()));
    await p.focus("#item");
    await p.keyboard.press("Escape");
    await wait(50);
    console.log(t, "Escape in nested menu:", JSON.stringify(await st()));
    await p.focus("#menuBtn");
    await p.keyboard.press("Escape");
    await wait(50);
    console.log(t, "Escape with focus in card:", JSON.stringify(await st()));
    await p.close();
  }
  await b.close();
}

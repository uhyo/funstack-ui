// How long after keyboard focus / hover does Chromium show an interestfor target (default delays)?
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await pw.chromium.launch();
console.log("Chromium", b.version());
for (const content of ["plain text", '<a href="#p">Profile</a> <button>Follow</button>']) {
  const p = await b.newPage();
  await p.setContent(`<!doctype html><style>body{margin:0} #inv{position:absolute;top:100px;left:100px;width:80px;height:30px;display:block}</style>
  <button id="first">first</button><a id="inv" href="#u" interestfor="card">inv</a>
  <div id="card" popover="hint">${content}</div>
  <script>window.log=[];card.addEventListener('toggle',e=>log.push([e.newState,Math.round(performance.now()-window.t0)]));</script>`);
  await p.focus("#first");
  await p.evaluate(() => (window.t0 = performance.now()));
  await p.keyboard.press("Tab");
  await wait(1500);
  console.log(JSON.stringify(content), "focus", await p.evaluate(() => log.splice(0)));
  await p.focus("#first");
  await wait(800);
  await p.evaluate(() => log.splice(0));
  await p.mouse.move(5, 300);
  await p.evaluate(() => (window.t0 = performance.now()));
  await p.mouse.move(130, 115);
  await wait(1500);
  console.log(JSON.stringify(content), "hover", await p.evaluate(() => log.splice(0)));
  await p.close();
}
await b.close();

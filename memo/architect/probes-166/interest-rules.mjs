// #166 HoverCard design probe, 2026-11-26. Run from the repository root:
//   node memo/architect/probes-166/interest-rules.mjs
// Chromium `interestfor` with a rich target. Questions the research left open:
//  A. hover open, click a button inside the card (focus inside), pointer leaves both: closes?
//     Then Escape with focus inside a hover-opened card: where is focus, does it re-open?
//  B. keyboard open, Tab into the card, Escape: where is focus, does the card re-open?
//  B2. Escape on the link, then a script blur + focus() of the link: is interest granted again?
//  C. keyboard open (focus on link), pointer enters and leaves the card: closes?
//  E. a click on the invoker while the card is open.
// Each for popover=hint and manual, and for the library-mode shape ("intercept"): the interest
// show is cancelled at beforetoggle and the card is re-shown with showPopover({ source }) a task
// later, as usePopoverPopup does through the Root.
import { createRequire } from "node:module";
import { join } from "node:path";
const require = createRequire(join(process.cwd(), "packages/ui/package.json"));
const pw = require("playwright");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const html = (type, intercept) => `<!doctype html><style>
body{margin:0;font:16px sans-serif} #before{position:absolute;top:60px;left:100px}
#inv{position:absolute;top:100px;left:100px;interest-delay:100ms 100ms}
#card{margin:0;position:fixed;inset:auto;top:124px;left:100px;width:240px;padding:8px;border:1px solid}
#after{position:absolute;top:400px;left:100px}
</style>
<a id="before" href="#b">before</a>
<a id="inv" href="#u" interestfor="card">@user</a><div id="card" popover="${type}"><a id="cardLink" href="#p">Profile</a> <button id="follow">Follow</button></div>
<a id="after" href="#x">after</a>
<script>
window.log=[];
const card=document.getElementById('card'), inv=document.getElementById('inv');
let own=false;
card.addEventListener('beforetoggle',e=>{
  log.push('before:'+e.newState+(e.source?'(src)':''));
  if(${intercept} && e.newState==='open' && !own){ e.preventDefault(); setTimeout(()=>{own=true; card.showPopover({source:inv}); own=false;},0); }
});
card.addEventListener('toggle',e=>log.push('toggle:'+e.newState));
card.addEventListener('interest',e=>log.push('interest'));
card.addEventListener('loseinterest',e=>log.push('loseinterest'));
inv.addEventListener('focus',()=>log.push('inv-focus'));
</script>`;

const b = await pw.chromium.launch();
console.log("Chromium", b.version());
for (const [type, intercept] of [
  ["hint", false],
  ["manual", false],
  ["hint", true],
  ["manual", true],
]) {
  console.log(`\n== popover=${type} intercept=${intercept}`);
  const fresh = async () => {
    const p = await b.newPage();
    await p.setContent(html(type, intercept));
    return p;
  };
  const state = async (p) =>
    JSON.stringify(
      await p.evaluate(() => ({
        open: card.matches(":popover-open"),
        src: inv.matches(":interest-source"),
        focus: document.activeElement?.id || document.activeElement?.tagName,
        log: log.splice(0),
      })),
    );
  let p = await fresh();
  // A
  await p.mouse.move(110, 108);
  await wait(400);
  console.log("A hover:", await state(p));
  await p.mouse.move(150, 136, { steps: 4 });
  await p.click("#follow");
  await wait(300);
  console.log("A click Follow:", await state(p));
  await p.mouse.move(600, 500, { steps: 4 });
  await wait(500);
  console.log("A pointer left, focus inside:", await state(p));
  await p.keyboard.press("Escape");
  await wait(300);
  console.log("A Escape (focus inside, hover-opened):", await state(p));
  await wait(600);
  console.log("A +600ms:", await state(p));
  await p.close();
  // B
  p = await fresh();
  await p.focus("#before");
  await p.keyboard.press("Tab");
  await wait(400);
  console.log("B Tab to link:", await state(p));
  await p.keyboard.press("Tab");
  await wait(300);
  console.log("B Tab into card:", await state(p));
  await p.keyboard.press("Escape");
  await wait(300);
  console.log("B Escape inside:", await state(p));
  await wait(600);
  console.log("B +600ms (re-open?):", await state(p));
  await p.close();
  // B2
  p = await fresh();
  await p.focus("#before");
  await p.keyboard.press("Tab");
  await wait(400);
  await p.keyboard.press("Escape");
  await wait(400);
  console.log("B2 Escape on link:", await state(p));
  await p.evaluate(() => {
    document.getElementById("after").focus();
    inv.focus();
  });
  await wait(500);
  console.log("B2 script refocus:", await state(p));
  await p.close();
  // C
  p = await fresh();
  await p.focus("#before");
  await p.keyboard.press("Tab");
  await wait(400);
  await p.mouse.move(150, 136, { steps: 4 });
  await wait(200);
  await p.mouse.move(600, 500, { steps: 4 });
  await wait(500);
  console.log("C keyboard open, pointer in+out of card:", await state(p));
  await p.close();
  // E
  p = await fresh();
  await p.mouse.move(110, 108);
  await wait(400);
  await p.mouse.down();
  await p.mouse.up();
  await wait(300);
  console.log("E click on invoker while open:", await state(p));
  await p.mouse.move(600, 500, { steps: 4 });
  await wait(500);
  console.log("E then leave:", await state(p));
  await p.close();
}
await b.close();

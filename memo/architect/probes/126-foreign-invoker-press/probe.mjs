// #126 probe: a foreign invoker (popovertarget / commandfor) of a shown popover pressed with a
// real mouse while a focusout listener closes the popover on focus leaving. Plain DOM.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const here = new URL(".", import.meta.url).pathname;
const html = readFileSync(here + "page.html", "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const engines = (process.argv[2] ?? "chromium,firefox,webkit").split(",");

async function probe(engine) {
  const b = await pw[engine].launch();
  const page = await b.newPage({ viewport: { width: 1000, height: 800 } });
  page.on("pageerror", (e) => console.log(engine, "pageerror", e.message));
  await page.setContent(html);
  const out = (k, v) => console.log(`${engine}\t${k}\t${JSON.stringify(v)}`);
  out("version", b.version());
  out("features", await page.evaluate(() => window.features()));
  const center = async (id) => { const r = await page.evaluate((id) => window.rect(id), id); return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 }; };
  const setup = (mode, holder) => page.evaluate(([m, h]) => window.setup(m, h), [mode, holder]);
  const state = () => page.evaluate(() => window.state());
  const press = async (id) => { const c = await center(id); await page.mouse.move(c.x, c.y); await page.mouse.down(); await sleep(60); await page.mouse.up(); await sleep(80); };
  const dragOff = async (id) => { const c = await center(id); await page.mouse.move(c.x, c.y); await page.mouse.down(); await sleep(30); const f = await center("far"); await page.mouse.move(f.x, f.y, { steps: 5 }); await page.mouse.up(); await sleep(80); };
  const brief = (s) => ({ open: s.open, active: s.active, log: s.log.map((e) => e.t === "focusout" ? `focusout(${e.related}, active=${e.active}, invoker=${e.invoker})` : e.t === "beforetoggle" || e.t === "toggle" ? `${e.t}(${e.newState}, src=${e.source})` : e.t === "click" ? `click(${e.target}, open=${e.open})` : e.t === "mousedown" ? `mousedown(${e.target})` : e.t === "focusin" ? `focusin(${e.target})` : e.t === "command" ? `command(${e.command})` : e.t === "pointerup" ? `pointerup(open=${e.open})` : e.t) });

  for (const holder of ["item", "input"]) {
    for (const mode of ["baseline", "ignore", "guard"]) {
      for (const btn of ["pt-btn", "cf-btn", "cfh-btn", "plain-btn"]) {
        await setup(mode, holder); await press(btn);
        out(`press.${holder}.${mode}.${btn}`, brief(await state()));
      }
      await setup(mode, holder); await dragOff("pt-btn");
      out(`dragoff.${holder}.${mode}.pt-btn`, brief(await state()));
    }
  }
  // Tab from the last item: the popover follows its source (#trigger) in focus order, so Tab
  // lands on #pt-btn, the element after the Trigger. Does each mode still close?
  for (const mode of ["baseline", "ignore", "guard"]) {
    await setup(mode, "item");
    await page.evaluate(() => document.getElementById("item2").focus());
    await page.keyboard.press("Tab"); await sleep(80);
    out(`tab.item.${mode}`, brief(await state()));
  }
  // Second press after a drag-off under "ignore": focus is on the foreign button; does a Tab
  // from there close anything (no focusout listener left)?
  await setup("ignore", "item"); await dragOff("pt-btn");
  await state();
  await page.keyboard.press("Tab"); await sleep(80);
  out("dragoff-then-tab.item.ignore", brief(await state()));
  await b.close();
}
for (const e of engines) { try { await probe(e); } catch (err) { console.log(e, "failed:", err.message.split("\n")[0]); } }

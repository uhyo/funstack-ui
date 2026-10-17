// Combobox platform probes (2026-10-17): <input role=combobox> + popover listbox opened with
// showPopover({ source: input }). Run: node combobox-platform.mjs  (Chromium 156, Firefox 157)
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");

const page_ = (mode = "auto", wrap = (x) => x) => `<style>
  body { margin: 0; padding: 20px; font: 16px sans-serif; }
  #lb { margin: 0; padding: 0; position-area: block-end span-inline-end; position-try-fallbacks: flip-block;
        min-width: anchor-size(width); border: 1px solid; }
  [role=option] { padding: 2px 6px; } [aria-selected=true] { background: #ddf; }
</style>
<button id="before">before</button>
${wrap(`<label for="cb">Fruit</label>
<input id="cb" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="lb" autocomplete="off" style="width: 300px">
<div id="lb" role="listbox" popover="${mode}" aria-label="Fruits">
  <div role="option" id="o1">Apple</div><div role="option" id="o2">Banana</div><div role="option" id="o3">Cherry</div>
  <button id="inpopbtn" tabindex="-1">Create “…”</button>
</div>
<button id="after">after</button>`)}`;

async function setup(page, html) {
  await page.setContent(html);
  await page.evaluate(() => {
    window.__log = [];
    const cb = document.getElementById("cb"), lb = document.getElementById("lb");
    lb.addEventListener("toggle", (e) => window.__log.push(`toggle:${e.newState}`));
    cb.addEventListener("blur", () => window.__log.push("input-blur"));
    cb.addEventListener("input", () => { if (!lb.matches(":popover-open")) lb.showPopover({ source: cb }); });
    cb.addEventListener("click", () => { window.__log.push("input-click"); if (!lb.matches(":popover-open")) lb.showPopover({ source: cb }); });
    for (const o of lb.querySelectorAll("[role=option]")) o.addEventListener("click", () => { window.__log.push(`pick:${o.textContent}`); cb.value = o.textContent; lb.hidePopover(); });
  });
}
const st = (page) => page.evaluate(() => ({
  open: document.getElementById("lb").matches(":popover-open"),
  active: document.activeElement?.id || document.activeElement?.tagName,
  value: document.getElementById("cb").value,
  log: window.__log.splice(0).join(","),
}));

const probes = {
  async typingAndGeometry(page) {
    await setup(page, page_());
    const out = [];
    await page.click("#cb"); out.push(["click input (opens)", await st(page)]);
    await page.keyboard.type("ba"); out.push(["type", await st(page)]);
    out.push(["geometry", await page.evaluate(() => { const i = document.getElementById("cb").getBoundingClientRect(), l = document.getElementById("lb").getBoundingClientRect(); return { inputBottom: i.bottom, lbTop: l.top, inputLeft: i.left, lbLeft: l.left, inputW: i.width, lbW: l.width }; })]);
    return out;
  },
  async clickInputWhileOpen(page) {
    await setup(page, page_());
    await page.click("#cb");
    const out = [["opened", await st(page)]];
    await page.click("#cb", { position: { x: 50, y: 5 } }); out.push(["click input again", await st(page)]);
    return out;
  },
  async clickOption(page) {
    await setup(page, page_());
    await page.click("#cb");
    await page.click("#o2"); const a = await st(page);
    await page.click("#cb");
    await page.evaluate(() => document.getElementById("o3").addEventListener("pointerdown", (e) => e.preventDefault()));
    await page.click("#o3"); const b = await st(page);
    return [["click option (no preventDefault)", a], ["click option, pointerdown preventDefault", b]];
  },
  async escape(page) {
    await setup(page, page_());
    await page.click("#cb");
    await page.keyboard.press("Escape"); const a = await st(page);
    await page.click("#cb");
    await page.evaluate(() => document.getElementById("cb").addEventListener("keydown", (e) => { if (e.key === "Escape") e.preventDefault(); }));
    await page.keyboard.press("Escape"); const b = await st(page);
    return [["Escape", a], ["Escape with keydown preventDefault", b]];
  },
  async tab(page) {
    await setup(page, page_());
    await page.click("#cb");
    await page.keyboard.press("Tab"); const a = await st(page);
    await page.keyboard.press("Tab"); const b = await st(page);
    return [["Tab from input while open", a], ["Tab again", b]];
  },
  async manualMode(page) {
    await setup(page, page_("manual"));
    await page.click("#cb");
    await page.click("#before"); const a = await st(page);
    return [["manual: click elsewhere", a]];
  },
  async insideModalDialogAndPopover(page) {
    const out = [];
    await setup(page, page_("auto", (x) => `<dialog id="d">${x}</dialog>`));
    await page.evaluate(() => document.getElementById("d").showModal());
    await page.click("#cb"); await page.click("#o1");
    out.push(["in modal dialog: pick", await st(page), await page.evaluate(() => document.getElementById("d").open)]);
    await page.click("#cb"); await page.keyboard.press("Escape");
    out.push(["in modal dialog: Escape", await st(page), await page.evaluate(() => document.getElementById("d").open)]);
    await setup(page, page_("auto", (x) => `<button id="pt" commandfor="pp" command="toggle-popover">p</button><div id="pp" popover>${x}</div>`));
    await page.click("#pt"); await page.click("#cb");
    out.push(["in auto popover: open combobox", await st(page), await page.evaluate(() => document.getElementById("pp").matches(":popover-open"))]);
    await page.keyboard.press("Escape");
    out.push(["in auto popover: Escape", await st(page), await page.evaluate(() => document.getElementById("pp").matches(":popover-open"))]);
    return out;
  },
};

for (const name of ["chromium", "firefox"]) {
  const browser = await pw[name].launch();
  console.log(`\n######## ${name} ${browser.version()}`);
  for (const [pname, fn] of Object.entries(probes)) {
    const page = await browser.newPage();
    try { const r = await fn(page); console.log(`\n== ${pname}`); for (const row of r) console.log("  " + JSON.stringify(row)); }
    catch (e) { console.log(`\n== ${pname} ERROR ${e.message.split("\n")[0]}`); }
    await page.close();
  }
  if (name === "chromium") {
    const page = await browser.newPage();
    const cdp = await page.context().newCDPSession(page); await cdp.send("Accessibility.enable");
    await setup(page, page_());
    await page.click("#cb");
    await page.evaluate(() => { const cb = document.getElementById("cb"); cb.setAttribute("aria-expanded", "true"); cb.setAttribute("aria-activedescendant", "o2"); document.getElementById("o2").setAttribute("aria-selected", "true"); });
    const { nodes } = await cdp.send("Accessibility.getFullAXTree");
    console.log("\n== AX (open, activedescendant=o2)");
    for (const n of nodes) if (["combobox", "listbox", "option", "button"].includes(n.role?.value))
      console.log(`  ${n.role.value} "${n.name?.value}" ${(n.properties || []).filter((p) => ["expanded", "activedescendant", "selected", "autocomplete", "controls", "hasPopup", "focused"].includes(p.name)).map((p) => `${p.name}=${JSON.stringify(p.value.value ?? p.value.relatedNodes?.map((r) => r.idref ?? r.backendDOMNodeId))}`).join(" ")}`);
    await page.close();
  }
  await browser.close();
}

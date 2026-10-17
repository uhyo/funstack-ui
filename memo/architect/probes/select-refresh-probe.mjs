// Architect probe (2026-10-17): does refreshing <selectedcontent> or re-applying selection
// disturb an open base-select picker? And how does defaultSelected mirroring interact with
// option dirtiness? Chromium (headless). Run: node select-refresh-probe.mjs
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");

const PAGE = `<style>
  body { margin: 0; padding: 20px; font: 16px sans-serif; }
  select.c, select.c::picker(select) { appearance: base-select; }
</style>
<form id="f">
<select class="c" id="s" name="fruit">
  <button type="button" id="sb"><selectedcontent id="sc"></selectedcontent></button>
  <option value="">Choose</option>
  <option value="a">A</option>
  <option value="b" selected><i>Bee</i></option>
  <option value="c">C</option>
</select>
</form>`;

const state = (page) => page.evaluate(() => {
  const s = document.getElementById("s");
  const a = document.activeElement;
  return {
    value: s.value, idx: s.selectedIndex,
    open: s.matches(":open"),
    active: a ? (a.id ? `#${a.id}` : `${a.tagName.toLowerCase()}[${a.value ?? ""}]`) : null,
    sc: document.getElementById("sc").innerHTML,
    log: window.__log.splice(0).join(","),
  };
});
async function setup(page) {
  await page.setContent(PAGE);
  await page.evaluate(() => {
    window.__log = [];
    const s = document.getElementById("s");
    for (const t of ["input", "change", "focus", "blur"]) s.addEventListener(t, () => window.__log.push(t));
  });
}
const open = async (page) => { await page.click("#s"); await page.waitForTimeout(80); };

async function run(name, launch) {
  let browser;
  try { browser = await launch(); } catch (e) { console.log(name, "cannot launch:", e.message.split("\n")[0]); return; }
  const page = await browser.newPage();
  const out = [];
  const supports = await (async () => { await page.setContent("<p>"); return page.evaluate(() => CSS.supports("appearance", "base-select")); })();
  out.push(["supports base-select", supports]);

  // 1. picker open, then select.value = select.value
  await setup(page); await open(page); out.push(["1 opened", await state(page)]);
  await page.evaluate(() => { const s = document.getElementById("s"); s.value = s.value; });
  await page.waitForTimeout(50); out.push(["1 after value=same while open", await state(page)]);
  await page.keyboard.press("Escape"); await page.waitForTimeout(50); out.push(["1 after Escape", await state(page)]);

  // 2. picker open, mutate selected option content, refresh with value=same
  await setup(page); await open(page);
  await page.evaluate(() => { document.querySelector("#s option[value=b] i").textContent = "Bumblebee"; });
  await page.waitForTimeout(30); out.push(["2 mutated while open", await state(page)]);
  await page.evaluate(() => { const s = document.getElementById("s"); s.value = s.value; });
  await page.waitForTimeout(50); out.push(["2 refreshed while open", await state(page)]);
  await page.keyboard.press("ArrowDown"); await page.waitForTimeout(30); out.push(["2 ArrowDown", await state(page)]);
  await page.keyboard.press("Escape"); await page.waitForTimeout(50); out.push(["2 Escape", await state(page)]);

  // 3. picker open with focus moved to another option, then value=same (does focus/option highlight survive?)
  await setup(page); await open(page);
  await page.keyboard.press("ArrowDown"); await page.waitForTimeout(30); out.push(["3 ArrowDown while open", await state(page)]);
  await page.evaluate(() => { const s = document.getElementById("s"); s.value = s.value; });
  await page.waitForTimeout(50); out.push(["3 after value=same", await state(page)]);
  await page.keyboard.press("Enter"); await page.waitForTimeout(50); out.push(["3 Enter", await state(page)]);

  // 4. picker open, late options appended, then option.selected = true on a new one (late-mount re-apply)
  await setup(page); await open(page);
  await page.evaluate(() => {
    const s = document.getElementById("s");
    const o = document.createElement("option"); o.value = "z"; o.textContent = "Zed"; s.append(o);
  });
  await page.waitForTimeout(30); out.push(["4 appended while open", await state(page)]);
  await page.evaluate(() => { document.querySelector("#s option[value=z]").selected = true; });
  await page.waitForTimeout(50); out.push(["4 selected=true on new option while open", await state(page)]);
  await page.keyboard.press("Escape"); await page.waitForTimeout(50); out.push(["4 Escape", await state(page)]);

  // 5. closed: option.selected = true on another option updates selectedcontent?
  await setup(page);
  await page.evaluate(() => { document.querySelector("#s option[value=c]").selected = true; });
  await page.waitForTimeout(30); out.push(["5 selected=true on c (closed)", await state(page)]);

  // 6. defaultSelected mirroring vs dirtiness (closed)
  await setup(page);
  out.push(["6 initial", await state(page)]);
  await page.evaluate(() => { document.querySelector("#s option[value=a]").defaultSelected = true; });
  out.push(["6 a.defaultSelected=true (a non-dirty, b parser-selected)", await state(page)]);
  await page.evaluate(() => { document.querySelector("#s option[value=b]").selected = true; });
  out.push(["6 b.selected=true (b now dirty)", await state(page)]);
  await page.evaluate(() => { document.querySelector("#s option[value=c]").defaultSelected = true; document.querySelector("#s option[value=a]").defaultSelected = false; });
  out.push(["6 c.defaultSelected=true, a.defaultSelected=false (b dirty)", await state(page)]);
  await page.evaluate(() => { document.querySelector("#s option[value=b]").defaultSelected = false; });
  out.push(["6 b.defaultSelected=false (b dirty, selected)", await state(page)]);
  await page.evaluate(() => document.getElementById("f").reset()); await page.waitForTimeout(30);
  out.push(["6 form.reset() -> expect c", await state(page)]);
  await page.evaluate(() => { document.querySelector("#s option[value=a]").selected = true; document.querySelector("#s option[value=a]").defaultSelected = true; });
  out.push(["6 a.selected=true then a.defaultSelected=true", await state(page)]);
  await page.evaluate(() => { document.querySelector("#s option[value=a]").defaultSelected = false; });
  out.push(["6 a.defaultSelected=false while a dirty+selected (should stay a)", await state(page)]);

  // 7. value = nonexistent, then value = ""
  await setup(page);
  await page.evaluate(() => { document.getElementById("s").value = "nope"; });
  out.push(["7 value=nope", await state(page)]);
  await page.evaluate(() => { const s = document.getElementById("s"); s.value = s.value; });
  out.push(["7 value=same ('')", await state(page)]);

  // 8. MutationObserver sees selectedcontent clone mutations? and option subtree mutations
  await setup(page);
  const mo = await page.evaluate(async () => {
    const s = document.getElementById("s"); const recs = [];
    const obs = new MutationObserver((rs) => { for (const r of rs) recs.push(`${r.type}@${r.target.nodeName}${r.target.parentElement ? "<" + r.target.parentElement.nodeName : ""}`); });
    obs.observe(s, { subtree: true, childList: true, characterData: true, attributes: true });
    s.querySelector("option[value=b] i").textContent = "Buzz";
    await new Promise((r) => setTimeout(r, 10));
    const a = recs.splice(0);
    s.value = s.value;
    await new Promise((r) => setTimeout(r, 10));
    const b = recs.splice(0);
    s.querySelector("option[value=b]").setAttribute("data-pending", "");
    await new Promise((r) => setTimeout(r, 10));
    const c = recs.splice(0);
    obs.disconnect();
    return { afterTextMutation: a, afterRefresh: b, afterOptionAttr: c, sc: document.getElementById("sc").innerHTML };
  });
  out.push(["8 observer", mo]);

  // 9. user picks via keyboard while closed in base-select: events?
  await setup(page);
  await page.focus("#s"); await page.keyboard.press("ArrowDown"); await page.waitForTimeout(50);
  out.push(["9 ArrowDown on focused closed select", await state(page)]);
  await page.keyboard.press("Escape"); await page.waitForTimeout(30);

  // 10. picker open, React-like: remove selected option and insert a replacement with same value (key change)
  await setup(page); await open(page);
  await page.evaluate(() => {
    const s = document.getElementById("s"); const old = s.querySelector("option[value=b]");
    const n = document.createElement("option"); n.value = "b"; n.innerHTML = "<i>Bee 2</i>"; old.replaceWith(n);
  });
  await page.waitForTimeout(30); out.push(["10 replaced selected option while open", await state(page)]);
  await page.evaluate(() => { document.querySelector("#s option[value=b]").selected = true; });
  await page.waitForTimeout(30); out.push(["10 re-applied selected=true", await state(page)]);
  await page.keyboard.press("Escape");

  for (const [k, v] of out) console.log(name, k, JSON.stringify(v));
  await browser.close();
}

await run("chromium", () => pw.chromium.launch());
await run("webkit", () => pw.webkit.launch());

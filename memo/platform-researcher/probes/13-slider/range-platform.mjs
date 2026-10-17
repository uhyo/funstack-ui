// Native <input type=range> probes (2026-10-17, wave 5). Run: node range-platform.mjs
// Chromium 156, Firefox 157 (Playwright). WebKit cannot launch locally.
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");

const PAGE = `<!doctype html><html lang="en"><body style="margin:0;font:16px sans-serif">
<style>
  input { display:block; margin: 20px; }
  #h { width: 200px; }
  #v { writing-mode: vertical-lr; direction: rtl; height: 200px; }
  #vltr { writing-mode: vertical-lr; height: 200px; }
  #styled { appearance: none; width: 200px; height: 8px; background: #ccc; }
  #styled::-webkit-slider-thumb { appearance: none; width: 30px; height: 30px; background: red; }
  #styled::-moz-range-thumb { width: 30px; height: 30px; background: red; border: 0; border-radius: 0; }
</style>
<form id="f">
<label for="h">Volume</label><input id="h" type="range" name="vol" min="0" max="100" step="1" value="50" aria-valuetext="50 percent">
<div dir="rtl"><input id="rtl" type="range" min="0" max="100" value="50" aria-label="rtl"></div>
<input id="v" type="range" min="0" max="100" value="50" aria-label="vertical rtl (bottom-to-top)">
<input id="vltr" type="range" min="0" max="100" value="50" aria-label="vertical ltr">
<input id="list" type="range" min="0" max="100" value="50" list="dl" aria-label="list"><datalist id="dl"><option value="0"><option value="25"><option value="50"><option value="75"><option value="100"></datalist>
<input id="styled" type="range" min="0" max="100" value="50" aria-label="styled">
<input id="big" type="range" min="0" max="1000" step="10" value="500" aria-label="big">
</form>
<script>
  window.__log = [];
  for (const el of document.querySelectorAll("input")) for (const t of ["input","change"]) el.addEventListener(t, e => __log.push(el.id+":"+t+":"+el.value));
</script></body></html>`;

for (const name of ["chromium", "firefox"]) {
  const browser = await pw[name].launch();
  const page = await browser.newPage();
  await page.setContent(PAGE);
  console.log(`\n######## ${name} ${browser.version()}`);
  const out = (k, v) => console.log(k.padEnd(46), JSON.stringify(v));
  const reset = () => page.evaluate(() => { for (const i of document.querySelectorAll("input")) i.value = i.defaultValue; __log.length = 0; });
  const keys = async (id, list) => {
    await reset(); await page.focus("#" + id);
    const r = [];
    for (const k of list) { await page.keyboard.press(k); r.push(k + "=" + await page.evaluate((id) => document.getElementById(id).value, id)); await page.evaluate((id) => document.getElementById(id).value = document.getElementById(id).defaultValue, id); }
    return r.join(" ");
  };
  const K = ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"];
  out("keys horizontal (50, step 1)", await keys("h", K));
  out("keys big (500, step 10, max 1000)", await keys("big", K));
  out("keys dir=rtl", await keys("rtl", K));
  out("keys vertical-lr + direction:rtl", await keys("v", K));
  out("keys vertical-lr (ltr)", await keys("vltr", K));
  out("keys with datalist", await keys("list", K));

  await reset(); await page.focus("#h");
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
  out("events: two ArrowRight presses", await page.evaluate(() => __log.splice(0)));

  // pointer: click on track and drag
  await reset();
  const box = await page.locator("#h").boundingBox();
  await page.mouse.click(box.x + box.width * 0.9, box.y + box.height / 2);
  out("click at 90% of track -> value", await page.evaluate(() => document.getElementById("h").value));
  out("events: click on track", await page.evaluate(() => __log.splice(0)));
  await reset();
  const thumbX = box.x + box.width * 0.5;
  await page.mouse.move(thumbX, box.y + box.height / 2); await page.mouse.down();
  for (let i = 1; i <= 4; i++) await page.mouse.move(thumbX + i * 15, box.y + box.height / 2);
  const during = await page.evaluate(() => __log.slice(0));
  await page.mouse.up();
  out("drag: events before mouseup", during);
  out("drag: events after mouseup", await page.evaluate(() => __log.splice(0).slice(-2)));
  // vertical geometry: which end is min?
  const vb = await page.locator("#v").boundingBox();
  await reset(); await page.mouse.click(vb.x + vb.width / 2, vb.y + 5);
  out("vertical rtl: click near top -> value", await page.evaluate(() => document.getElementById("v").value));
  const vb2 = await page.locator("#vltr").boundingBox();
  await page.mouse.click(vb2.x + vb2.width / 2, vb2.y + 5);
  out("vertical ltr: click near top -> value", await page.evaluate(() => document.getElementById("vltr").value));
  out("vertical box (w,h)", [Math.round(vb.width), Math.round(vb.height)]);

  // styling
  out("styled thumb width (elementFromPoint size check)", await page.evaluate(() => { const s = document.getElementById("styled"); return { h: s.getBoundingClientRect().height, appearance: getComputedStyle(s).appearance }; }));
  out("feature detection", await page.evaluate(() => {
    const sel = (s) => { try { return CSS.supports(`selector(${s})`); } catch { return "throws"; } };
    return {
      appearanceBase: CSS.supports("appearance", "base"),
      sliderThumb: sel("::slider-thumb"), sliderTrack: sel("::slider-track"), sliderFill: sel("::slider-fill"),
      webkitThumb: sel("::-webkit-slider-thumb"), mozThumb: sel("::-moz-range-thumb"),
      rangegroup: document.createElement("rangegroup").constructor.name,
      stepUpCommand: (() => { const b = document.createElement("button"); b.command = "step-up"; return b.command; })(),
      fieldSizing: CSS.supports("field-sizing", "content"),
    };
  }));
  // form participation
  out("FormData + reset", await page.evaluate(() => {
    const f = document.getElementById("f"); const h = document.getElementById("h");
    h.value = "73"; const fd = [...new FormData(f)].filter(([k]) => k === "vol");
    f.reset(); return { fd, afterReset: h.value };
  }));
  out("value sanitisation", await page.evaluate(() => {
    const h = document.getElementById("big"); const r = {};
    h.value = "1234"; r.over = h.value; h.value = "33"; r.offStep = h.value; h.value = "abc"; r.nan = h.value;
    const e = document.createElement("input"); e.type = "range"; r.defaultNoAttrs = e.value;
    e.min = "0"; e.max = "5"; e.step = "2"; r.maxNotOnStep = (e.value = "5", e.value);
    r.validity = h.validity.valid; return r;
  }));
  if (name === "chromium") {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Accessibility.enable");
    await reset();
    const { nodes } = await cdp.send("Accessibility.getFullAXTree");
    for (const n of nodes.filter(n => n.role?.value === "slider")) {
      const props = Object.fromEntries((n.properties || []).map(p => [p.name, p.value?.value]));
      out("AX slider " + n.name?.value, { value: n.value?.value, desc: n.description?.value, ...props });
    }
  }
  await browser.close();
}

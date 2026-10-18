// Native <input type=number> probes (2026-10-18, wave 6). Run: node number-platform.mjs
// Chromium 156, Firefox 157 (Playwright). WebKit cannot launch locally.
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");

const PAGE = (lang) => `<!doctype html><html lang="${lang}"><body style="font:16px sans-serif">
<form id="f">
<input id="n" type="number" name="n" value="5" min="0" max="10" step="1" aria-label="n" style="width:120px">
<input id="dec" type="number" name="dec" value="1.5" step="0.1" aria-label="dec">
<input id="mis" type="number" value="1.5" step="1" aria-label="mismatch">
<input id="empty" type="number" min="3" max="10" aria-label="empty">
<input id="emptyNoMin" type="number" aria-label="emptyNoMin">
<input id="any" type="number" step="any" value="1.25" aria-label="any">
<input id="t" type="text" inputmode="decimal" role="spinbutton" aria-valuenow="5" aria-valuemin="0" aria-valuemax="10" aria-valuetext="5 items" value="5" aria-label="text spin">
</form>
<div style="height:2000px"></div>
<script>
  window.__log = [];
  for (const el of document.querySelectorAll("input")) for (const t of ["beforeinput","input","change"]) el.addEventListener(t, e => __log.push(el.id+":"+t+(e.inputType!==undefined?"("+e.inputType+")":"")+":"+el.value));
</script></body></html>`;

for (const name of ["chromium", "firefox"]) {
  const browser = await pw[name].launch();
  for (const [lang, locale] of [["en", "en-US"], ["de", "de-DE"], ["en", "de-DE"], ["de", "en-US"]]) {
    const ctx = await browser.newContext({ locale });
    const page = await ctx.newPage();
    await page.setContent(PAGE(lang));
    console.log(`\n######## ${name} ${browser.version()} lang=${lang} locale=${locale}`);
    const out = (k, v) => console.log(k.padEnd(50), JSON.stringify(v));
    const val = (id) => page.evaluate((id) => { const e = document.getElementById(id); return { value: e.value, asNumber: e.valueAsNumber, badInput: e.validity.badInput, valid: e.validity.valid }; }, id);
    // display of a decimal value (what the user sees): select all + copy is unreliable; use screenshot-free check via typing
    const type = async (id, text) => { await page.fill("#" + id, ""); await page.focus("#" + id); await page.keyboard.type(text); return val(id); };
    for (const s of ["1,5", "1.5", "1.234,5", "1e3", "abc", "-", "１２", "٣"]) out(`type "${s}" into #dec`, await type("dec", s));
    if (lang === "en" && locale === "en-US") {
      const reset = () => page.evaluate(() => { document.getElementById("f").reset(); __log.length = 0; });
      const keys = async (id, list) => { const r = []; for (const k of list) { await reset(); await page.focus("#" + id); await page.keyboard.press(k); r.push(k + "=" + (await page.evaluate((id) => document.getElementById(id).value, id))); } return r.join(" "); };
      out("keys #n (5, 0..10, step 1)", await keys("n", ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", "Shift+ArrowUp", "ArrowRight"]));
      out("keys #dec (1.5, step .1)", await keys("dec", ["ArrowUp", "ArrowDown"]));
      out("keys #mis (1.5, step 1): snap", await keys("mis", ["ArrowUp", "ArrowDown"]));
      out("keys #empty (min 3)", await keys("empty", ["ArrowUp", "ArrowDown"]));
      out("keys #emptyNoMin", await keys("emptyNoMin", ["ArrowUp", "ArrowDown"]));
      out("keys #any (step any, 1.25)", await keys("any", ["ArrowUp", "ArrowDown"]));
      out("keys #t (text spinbutton)", await keys("t", ["ArrowUp", "ArrowDown"]));
      await reset(); await page.evaluate(() => document.getElementById("n").value = "10"); await page.focus("#n"); await page.keyboard.press("ArrowUp");
      out("ArrowUp at max 10", await val("n"));
      await reset(); await page.focus("#n"); await page.keyboard.press("ArrowUp");
      out("events: ArrowUp", await page.evaluate(() => __log.splice(0)));
      await page.keyboard.type("2");
      out("events: type '2' then blur", (await page.evaluate(() => __log.splice(0))).concat(await page.evaluate(() => { document.getElementById("n").blur(); return __log.splice(0); })));
      // wheel
      const box = await page.locator("#n").boundingBox();
      await reset(); await page.mouse.move(box.x + 30, box.y + box.height / 2);
      await page.mouse.wheel(0, -100); await page.waitForTimeout(100);
      out("wheel up over unfocused #n", { value: await page.evaluate(() => document.getElementById("n").value), scrollY: await page.evaluate(() => scrollY) });
      await reset(); await page.evaluate(() => scrollTo(0, 0)); await page.focus("#n"); await page.mouse.move(box.x + 30, box.y + box.height / 2);
      await page.mouse.wheel(0, -100); await page.waitForTimeout(100);
      out("wheel up over focused #n", { value: await page.evaluate(() => document.getElementById("n").value), log: await page.evaluate(() => __log.splice(0)) });
      await page.mouse.wheel(0, 100); await page.waitForTimeout(100);
      out("wheel down over focused #n", { value: await page.evaluate(() => document.getElementById("n").value), scrollY: await page.evaluate(() => scrollY) });
      await reset(); await page.evaluate(() => scrollTo(0, 0)); await page.focus("#n"); await page.mouse.move(box.x + 30, box.y + 200);
      await page.mouse.wheel(0, 100); await page.waitForTimeout(100);
      out("wheel elsewhere while #n focused", { value: await page.evaluate(() => document.getElementById("n").value), scrollY: await page.evaluate(() => scrollY) });
      await page.evaluate(() => scrollTo(0, 0));
      // validity
      out("validity mismatch/overflow", await page.evaluate(() => { const n = document.getElementById("n"); const r = {}; for (const v of ["10.5", "11", "-1", "abc"]) { n.value = v; r[v] = { value: n.value, step: n.validity.stepMismatch, over: n.validity.rangeOverflow, under: n.validity.rangeUnderflow, msg: n.validationMessage }; } return r; }));
      out("setSelectionRange on number", await page.evaluate(() => { try { document.getElementById("n").setSelectionRange(0, 1); return "ok"; } catch (e) { return e.name; } }));
      out("selectionStart on number", await page.evaluate(() => document.getElementById("n").selectionStart));
      out("stepUp beyond max / stepUp(3)", await page.evaluate(() => { const n = document.getElementById("n"); n.value = "9"; n.stepUp(3); const a = n.value; n.value = "1.5"; try { n.stepUp(); } catch (e) { return [a, e.name]; } return [a, n.value]; }));
      out("FormData / reset", await page.evaluate(() => { const f = document.getElementById("f"); document.getElementById("n").value = "7"; const a = new FormData(f).get("n"); f.reset(); return [a, document.getElementById("n").value]; }));
      out("spin-button pseudo", await page.evaluate(() => ({ webkitInner: CSS.supports("selector(::-webkit-inner-spin-button)"), mozAppearanceTextfield: CSS.supports("appearance: textfield") })));
      out("box width default", Math.round((await page.locator("#emptyNoMin").boundingBox()).width));
      if (name === "chromium") {
        const cdp = await ctx.newCDPSession(page); await cdp.send("Accessibility.enable");
        const { nodes } = await cdp.send("Accessibility.getFullAXTree");
        for (const n of nodes.filter((n) => n.role?.value === "spinbutton")) {
          const p = Object.fromEntries((n.properties || []).map((x) => [x.name, x.value?.value]));
          out("AX spinbutton " + n.name?.value, { value: n.value?.value, valuemin: p.valuemin, valuemax: p.valuemax, invalid: p.invalid });
        }
      }
    }
    await ctx.close();
  }
  await browser.close();
}

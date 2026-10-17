// Customizable <select> platform probes (2026-10-17). Run: node select-platform.mjs
// Engines: Chromium 156, Firefox 157 (default prefs), Firefox 157 with
// dom.select.customizable_select.enabled + layout.css.appearance-base.enabled. WebKit cannot launch locally.
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");

const SELECT = (attrs = "") => `
<select class="c" id="s" name="fruit" required ${attrs}>
  <button id="sb"><selectedcontent id="sc"></selectedcontent></button>
  <option value="">Choose a fruit</option>
  <optgroup label="Citrus">
    <legend>Citrus <em>fruits</em></legend>
    <option value="orange"><span class="icon" aria-hidden="true">O</span><span>Orange</span> <small>tangy</small></option>
    <option value="lemon">Lemon</option>
  </optgroup>
  <hr>
  <option value="apple" disabled>Apple</option>
  <option value="banana">Banana</option>
  <option value="blueberry">Blueberry</option>
  <option value="cherry" hidden>Cherry (hidden)</option>
  <option value="date">Date</option>
</select>`;
const CSS = `<style>
  body { margin: 0; padding: 20px; font: 16px sans-serif; }
  select.c, select.c::picker(select) { appearance: base-select; }
  [popover] { position: fixed; top: 200px; left: 200px; margin: 0; }
</style>`;
const PAGE = `${CSS}<form id="f"><button type="button" id="before">before</button>${SELECT()}<button type="button" id="after">after</button></form>`;

const ae = () => {
  const a = document.activeElement;
  if (!a) return "null";
  return a.id ? `#${a.id}` : `${a.tagName.toLowerCase()}${a.value !== undefined ? `[${a.value}]` : ""}`;
};

async function state(page) {
  return page.evaluate(() => {
    const s = document.getElementById("s");
    const a = document.activeElement;
    return {
      value: s.value,
      open: (() => { try { return s.matches(":open"); } catch { return "n/a"; } })(),
      active: a ? (a.id ? `#${a.id}` : `${a.tagName.toLowerCase()}[${a.value ?? ""}]`) : null,
      sc: document.getElementById("sc")?.textContent.replace(/\s+/g, " ").trim() ?? null,
      log: window.__log.splice(0).join(","),
    };
  });
}

async function setup(page, html = PAGE) {
  await page.setContent(html);
  await page.evaluate(() => {
    window.__log = [];
    const s = document.getElementById("s");
    for (const t of ["input", "change", "beforetoggle", "toggle", "focus", "blur"])
      s?.addEventListener(t, (e) => window.__log.push(`${t}${e.newState ? ":" + e.newState : ""}`));
  });
}

const probes = {
  async features(page) {
    await setup(page);
    return page.evaluate(() => {
      const s = document.getElementById("s");
      return {
        supportsBaseSelect: CSS.supports("appearance", "base-select"),
        selectedContentIface: "HTMLSelectedContentElement" in window,
        selectedContentCtor: document.getElementById("sc")?.constructor.name,
        firstChildOfSelect: s.firstElementChild?.tagName,
        buttonStillInSelect: !!s.querySelector("button"),
        spanInOption: !!s.querySelector("option span"),
        legendInOptgroup: !!s.querySelector("optgroup legend"),
        hrInSelect: !!s.querySelector("hr"),
        computedAppearance: getComputedStyle(s).appearance,
        selectedContentInitial: document.getElementById("sc")?.innerHTML,
        optionsLength: s.options.length,
        optionLabel: s.options[1].label,
        optionText: s.options[1].text,
        openPseudo: (() => { try { return s.matches(":open"); } catch (e) { return "throws"; } })(),
        showPicker: typeof s.showPicker,
        validity: { valid: s.checkValidity(), valueMissing: s.validity.valueMissing, msg: s.validationMessage },
        formData: [...new FormData(document.getElementById("f")).entries()],
        buttonType: s.querySelector("button")?.type,
      };
    });
  },

  async programmatic(page) {
    await setup(page);
    return page.evaluate(() => {
      const s = document.getElementById("s"), sc = document.getElementById("sc"), f = document.getElementById("f");
      const out = {};
      s.value = "orange"; out.afterSetValue = sc.innerHTML; out.valid = s.checkValidity();
      out.fd = new FormData(f).get("fruit");
      out.events = window.__log.splice(0).join(",") || "(none)";
      f.reset(); out.afterReset = { value: s.value, sc: sc.textContent };
      s.options[5].selected = true; out.afterOptionSelected = sc.textContent;
      return out;
    });
  },

  async keyboardClosed(page) {
    await setup(page);
    const out = [];
    await page.focus("#s");
    out.push(["focus", await state(page)]);
    for (const k of ["ArrowDown", "Escape", "b", "Escape"]) {
      await page.keyboard.press(k); await page.waitForTimeout(80);
      out.push([k, await state(page)]);
    }
    return out;
  },

  async keyboardOpenPick(page) {
    await setup(page);
    const out = [];
    await page.focus("#s");
    for (const k of ["Enter", "ArrowDown", "ArrowDown", "ArrowDown", "ArrowDown", "End", "Home", "b", "l", "Enter"]) {
      await page.keyboard.press(k); await page.waitForTimeout(80);
      out.push([k, await state(page)]);
    }
    return out;
  },

  async spaceAndTab(page) {
    await setup(page);
    const out = [];
    await page.focus("#s");
    for (const k of ["Space", "ArrowDown", "Space", "Space", "ArrowDown", "Tab"]) {
      await page.keyboard.press(k); await page.waitForTimeout(80);
      out.push([k, await state(page)]);
    }
    return out;
  },

  async mouse(page) {
    await setup(page);
    const out = [];
    await page.click("#s"); await page.waitForTimeout(80);
    out.push(["click select", await state(page)]);
    const r = await page.evaluate(() => {
      const s = document.getElementById("s"), o = s.options[4];
      const rs = s.getBoundingClientRect(), ro = o.getBoundingClientRect();
      return { select: [rs.left, rs.bottom], banana: [ro.left, ro.top, ro.width, ro.height] };
    });
    out.push(["geometry", r]);
    if (r.banana[2] > 0) {
      await page.mouse.click(r.banana[0] + 5, r.banana[1] + 5); await page.waitForTimeout(80);
      out.push(["click Banana", await state(page)]);
    }
    return out;
  },

  async inPopover(page) {
    await setup(page, `${CSS}<button id="t" commandfor="p" command="toggle-popover">open</button>
      <div id="p" popover>${SELECT()}<button id="in">in</button></div>
      <div id="q" popover>other</div>`);
    const out = [];
    const pst = () => page.evaluate(() => ["p", "q"].filter((id) => document.getElementById(id).matches(":popover-open")).join(",") || "(none)");
    await page.click("#t"); out.push(["open popover", await pst()]);
    await page.click("#s"); await page.waitForTimeout(80); out.push(["click select", await pst(), await state(page)]);
    await page.keyboard.press("Escape"); await page.waitForTimeout(80); out.push(["Escape", await pst(), await state(page)]);
    await page.keyboard.press("Escape"); await page.waitForTimeout(80); out.push(["Escape 2", await pst(), await state(page)]);
    // select outside any popover while an auto popover is open
    await page.click("#t");
    await page.evaluate(() => { document.body.insertAdjacentHTML("beforeend", '<select id="s2" style="appearance:base-select"><option>x</option><option>y</option></select><style>#s2::picker(select){appearance:base-select}</style>'); });
    await page.click("#s2", { force: true }).catch((e) => out.push(["click s2 failed", e.message.split("\n")[0]]));
    await page.waitForTimeout(80);
    out.push(["open unrelated select while popover open", await pst(), await page.evaluate(() => document.getElementById("s2").matches(":open"))]);
    return out;
  },

  async inModalDialog(page) {
    await setup(page, `${CSS}<dialog id="d">${SELECT()}<button id="in">in</button></dialog>`);
    await page.evaluate(() => document.getElementById("d").showModal());
    const out = [];
    const dst = () => page.evaluate(() => document.getElementById("d").open);
    await page.focus("#s");
    await page.keyboard.press("Enter"); await page.waitForTimeout(80); out.push(["Enter", await dst(), await state(page)]);
    await page.keyboard.press("Escape"); await page.waitForTimeout(80); out.push(["Escape", await dst(), await state(page)]);
    await page.keyboard.press("Escape"); await page.waitForTimeout(80); out.push(["Escape 2", await dst(), await state(page)]);
    return out;
  },

  async hiddenOptionsFiltering(page) {
    // Can a Select filter its own options with `hidden`? (e.g. search-in-picker)
    await setup(page);
    await page.evaluate(() => { for (const o of document.querySelectorAll("#s option")) o.hidden = !/^b/.test(o.value); });
    await page.focus("#s");
    const out = [];
    for (const k of ["Enter", "ArrowDown", "ArrowDown", "ArrowDown", "Enter"]) {
      await page.keyboard.press(k); await page.waitForTimeout(80);
      out.push([k, await state(page)]);
    }
    return out;
  },

  async buttonInPicker(page) {
    // Interactive content inside the picker (not options): a search input, a button.
    await setup(page, `${CSS}<select class="c" id="s"><button><selectedcontent id="sc"></selectedcontent></button>
      <div class="search"><input id="q" placeholder="search"></div>
      <option>One</option><option>Two</option><option>Three</option></select>`);
    const out = [];
    out.push(["input kept in select", await page.evaluate(() => !!document.querySelector("#s input"))]);
    await page.click("#s"); await page.waitForTimeout(80);
    out.push(["open", await state(page)]);
    const vis = await page.evaluate(() => { const r = document.getElementById("q")?.getBoundingClientRect(); return r ? [r.width, r.height] : null; });
    out.push(["input rect", vis]);
    if (vis && vis[0] > 0) {
      await page.click("#q").catch((e) => out.push(["click input failed", e.message.split("\n")[0]]));
      await page.waitForTimeout(80);
      await page.keyboard.type("tw"); await page.waitForTimeout(80);
      out.push(["typed into input", await state(page), await page.evaluate(() => document.getElementById("q").value)]);
    }
    return out;
  },
};

const engines = [
  ["chromium", {}],
  ["firefox", {}],
  ["firefox+prefs", { firefoxUserPrefs: { "dom.select.customizable_select.enabled": true, "layout.css.appearance-base.enabled": true } }],
];
const only = process.argv[2];
for (const [name, opts] of engines) {
  const type = name.split("+")[0];
  const browser = await pw[type].launch(opts);
  console.log(`\n######## ${name} ${browser.version()}`);
  for (const [pname, fn] of Object.entries(probes)) {
    if (only && pname !== only) continue;
    const page = await browser.newPage();
    try {
      const r = await fn(page);
      console.log(`\n== ${pname}`);
      if (Array.isArray(r)) for (const row of r) console.log("  " + JSON.stringify(row));
      else console.log("  " + JSON.stringify(r, null, 1).replace(/\n/g, "\n  "));
    } catch (e) {
      console.log(`\n== ${pname} ERROR ${e.message.split("\n")[0]}`);
    }
    await page.close();
  }
  await browser.close();
}

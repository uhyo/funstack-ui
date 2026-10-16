// Platform probes for <dialog>: run with `node platform.mjs`. Chromium + Firefox (WebKit cannot launch locally).
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");

const BASE = `<!doctype html><html><head><style>
  body { margin:0; height: 5000px; }
  dialog { width: 300px; height: 200px; }
  #cover { position: fixed; inset: 0; z-index: 99999; background: rgba(0,0,0,0.01); display:none; }
</style></head><body>
<button id="opener">open</button>
<div id="log"></div>
</body></html>`;

const probes = {
  async features(page) {
    await page.setContent(BASE);
    return page.evaluate(() => ({
      closedbyProp: "closedBy" in HTMLDialogElement.prototype,
      requestClose: "requestClose" in HTMLDialogElement.prototype,
      commandForElement: "commandForElement" in HTMLButtonElement.prototype,
      CloseWatcher: typeof CloseWatcher !== "undefined",
      overlay: CSS.supports("overlay", "auto"),
      startingStyle: typeof CSSStartingStyleRule !== "undefined",
      openPseudo: CSS.supports("selector(:open)"),
      modalPseudo: CSS.supports("selector(:modal)"),
      interpolateSize: CSS.supports("interpolate-size", "allow-keywords"),
      scrollbarGutter: CSS.supports("scrollbar-gutter", "stable"),
    }));
  },

  async toggleEvents(page) {
    await page.setContent(BASE + `<dialog id="d"><button>x</button></dialog>`);
    return page.evaluate(async () => {
      const d = document.getElementById("d"); const log = [];
      for (const t of ["beforetoggle", "toggle", "cancel", "close"]) d.addEventListener(t, (e) => log.push(`${t}:${e.newState ?? ""}:${e.oldState ?? ""}:cancelable=${e.cancelable}:${e.constructor.name}`));
      d.showModal(); await new Promise((r) => setTimeout(r, 50));
      d.close(); await new Promise((r) => setTimeout(r, 50));
      // cancel opening via beforetoggle
      const h = (e) => { if (e.newState === "open") e.preventDefault(); };
      d.addEventListener("beforetoggle", h);
      d.showModal(); const openedAfterPrevent = d.open; d.removeEventListener("beforetoggle", h);
      // requestClose: cancel cancelable? preventDefault keeps open?
      d.showModal(); await new Promise((r) => setTimeout(r, 50));
      const c = (e) => e.preventDefault();
      d.addEventListener("cancel", c); d.requestClose("rv"); const openAfterRCprevent = d.open;
      d.requestClose("rv"); const openAfterRCprevent2 = d.open;
      d.removeEventListener("cancel", c); d.requestClose("rv2");
      await new Promise((r) => setTimeout(r, 50));
      return { log, openedAfterPrevent, openAfterRCprevent, openAfterRCprevent2, returnValue: d.returnValue, openEnd: d.open };
    });
  },

  async initialFocus(page) {
    const cases = {
      noFocusable: `<dialog id="d"><p>text</p></dialog>`,
      tabindexMinus1First: `<dialog id="d"><div id="t" tabindex="-1">t</div><button id="b">b</button></dialog>`,
      autofocusInside: `<dialog id="d"><button id="a">a</button><input id="i" autofocus></dialog>`,
      autofocusOnDialog: `<dialog id="d" autofocus><button id="a">a</button></dialog>`,
      firstButton: `<dialog id="d"><p>t</p><button id="a">a</button></dialog>`,
      linkFirst: `<dialog id="d"><a id="l" href="#x">l</a><button id="a">a</button></dialog>`,
      scrollableNoFocusable: `<dialog id="d" style="overflow:auto;height:100px"><div style="height:1000px">long</div></dialog>`,
    };
    const out = {};
    for (const [k, html] of Object.entries(cases)) {
      for (const mode of ["showModal", "show"]) {
        await page.setContent(BASE + html);
        await page.click("#opener");
        await page.evaluate((m) => document.getElementById("d")[m](), mode);
        await page.waitForTimeout(50);
        out[`${k}/${mode}`] = await page.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.tagName) : null; });
      }
    }
    return out;
  },

  async focusRestore(page) {
    const out = {};
    for (const mode of ["showModal", "show"]) {
      for (const where of ["inside", "outside"]) {
        await page.setContent(BASE + `<button id="other">other</button><dialog id="d"><button id="in">in</button></dialog>`);
        await page.click("#opener");
        await page.evaluate((m) => document.getElementById("d")[m](), mode);
        await page.waitForTimeout(30);
        if (where === "outside" && mode === "show") await page.click("#other");
        if (where === "inside") await page.focus("#in");
        await page.evaluate(() => document.getElementById("d").close());
        await page.waitForTimeout(30);
        out[`${mode}/focus-${where}-at-close`] = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
      }
    }
    // opener removed from DOM while open
    await page.setContent(BASE + `<dialog id="d"><button id="in">in</button></dialog>`);
    await page.click("#opener");
    await page.evaluate(() => { document.getElementById("d").showModal(); document.getElementById("opener").remove(); document.getElementById("d").close(); });
    out["showModal/opener-removed"] = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
    return out;
  },

  async escapeAndActivation(page) {
    await page.setContent(BASE + `<dialog id="d"><button id="in">in</button></dialog>`);
    await page.evaluate(() => {
      const d = document.getElementById("d"); window.log = [];
      document.getElementById("opener").onclick = () => d.showModal();
      d.addEventListener("cancel", (e) => { window.log.push("cancel cancelable=" + e.cancelable); e.preventDefault(); });
      d.addEventListener("close", () => window.log.push("close"));
    });
    await page.click("#opener");
    await page.keyboard.press("Escape"); await page.waitForTimeout(50);
    const after1 = await page.evaluate(() => document.getElementById("d").open);
    await page.keyboard.press("Escape"); await page.waitForTimeout(50);
    const after2 = await page.evaluate(() => document.getElementById("d").open);
    return { after1, after2, log: await page.evaluate(() => window.log) };
  },

  async programmaticOpenNoActivationEscape(page) {
    // Dialog opened with no user activation at all: is cancel cancelable on Escape?
    await page.setContent(BASE + `<dialog id="d"><button id="in">in</button></dialog>`);
    await page.evaluate(() => {
      const d = document.getElementById("d"); window.log = [];
      d.addEventListener("cancel", (e) => { window.log.push("cancel cancelable=" + e.cancelable); e.preventDefault(); });
      d.showModal();
    });
    await page.keyboard.press("Escape"); await page.waitForTimeout(50);
    return { open: await page.evaluate(() => document.getElementById("d").open), log: await page.evaluate(() => window.log) };
  },

  async nestedModals(page) {
    await page.setContent(BASE + `<dialog id="d1"><button id="o2">open2</button></dialog><dialog id="d2"><button id="in2">in2</button></dialog>`);
    await page.evaluate(() => { document.getElementById("opener").onclick = () => document.getElementById("d1").showModal(); document.getElementById("o2").onclick = () => document.getElementById("d2").showModal(); });
    await page.click("#opener"); await page.click("#o2");
    const s = () => page.evaluate(() => ({ d1: document.getElementById("d1").open, d2: document.getElementById("d2").open, active: document.activeElement?.id }));
    const both = await s();
    await page.keyboard.press("Escape"); await page.waitForTimeout(50);
    const afterEsc1 = await s();
    await page.keyboard.press("Escape"); await page.waitForTimeout(50);
    const afterEsc2 = await s();
    // nested without activation between: both programmatic in one task
    await page.setContent(BASE + `<dialog id="d1"><button>a</button></dialog><dialog id="d2"><button>b</button></dialog>`);
    await page.evaluate(() => { document.getElementById("opener").onclick = () => { document.getElementById("d1").showModal(); document.getElementById("d2").showModal(); }; });
    await page.click("#opener");
    await page.keyboard.press("Escape"); await page.waitForTimeout(50);
    const groupedOneEscape = await page.evaluate(() => ({ d1: document.getElementById("d1").open, d2: document.getElementById("d2").open }));
    return { both, afterEsc1, afterEsc2, groupedOneEscape };
  },

  async backgroundScroll(page) {
    await page.setContent(BASE + `<dialog id="d"><button>x</button></dialog>`);
    await page.click("#opener");
    await page.evaluate(() => document.getElementById("d").showModal());
    await page.mouse.move(20, 400);
    await page.mouse.wheel(0, 800); await page.waitForTimeout(300);
    const yWheelBackdrop = await page.evaluate(() => scrollY);
    await page.evaluate(() => scrollTo(0, 0));
    await page.keyboard.press("PageDown"); await page.waitForTimeout(300);
    const yPageDown = await page.evaluate(() => scrollY);
    // CSS lock
    await page.evaluate(() => { scrollTo(0, 0); const s = document.createElement("style"); s.textContent = "html:has(dialog:modal){overflow:hidden}"; document.head.append(s); });
    await page.mouse.wheel(0, 800); await page.waitForTimeout(300);
    const yWheelWithCssLock = await page.evaluate(() => scrollY);
    return { yWheelBackdrop, yPageDown, yWheelWithCssLock };
  },

  async lightDismiss(page) {
    const out = {};
    await page.setContent(BASE + `<dialog id="d" closedby="any" style="margin:200px auto 0"><button id="in">in</button><div id="pin" popover>inside popover</div></dialog><div id="pout" popover style="margin:0;left:0;top:0">outside popover</div>`);
    out.closedByReflect = await page.evaluate(() => document.getElementById("d").closedBy);
    await page.click("#opener"); await page.evaluate(() => document.getElementById("d").showModal());
    await page.click("#in"); out.afterInsideClick = await page.evaluate(() => document.getElementById("d").open);
    // popover in dialog subtree
    await page.evaluate(() => document.getElementById("pin").showPopover());
    await page.click("#pin"); out.afterClickPopoverInsideDialogDOM = await page.evaluate(() => [document.getElementById("d").open, document.getElementById("pin").matches(":popover-open")]);
    // popover outside dialog subtree (portal-like)
    await page.evaluate(() => document.getElementById("pout").showPopover());
    out.poutOpen = await page.evaluate(() => document.getElementById("pout").matches(":popover-open"));
    await page.click("#pout", { force: true }).catch((e) => (out.poutClickErr = String(e).slice(0, 80)));
    out.afterClickPopoverOutsideDialogDOM = await page.evaluate(() => [document.getElementById("d").open, document.getElementById("pout").matches(":popover-open")]);
    // backdrop click
    await page.evaluate(() => { const d = document.getElementById("d"); if (!d.open) d.showModal(); });
    await page.mouse.click(5, 5); await page.waitForTimeout(50);
    out.afterBackdropClick = await page.evaluate(() => document.getElementById("d").open);
    // default (no closedby) modal: backdrop click
    await page.evaluate(() => { const d = document.getElementById("d"); d.removeAttribute("closedby"); d.showModal(); });
    await page.mouse.click(5, 5); await page.waitForTimeout(50);
    out.noClosedbyAfterBackdropClick = await page.evaluate(() => document.getElementById("d").open);
    return out;
  },

  async popoverInteraction(page) {
    const out = {};
    // auto popover open, then modal dialog outside it opens -> popover closes?
    await page.setContent(BASE + `<div id="p" popover><button id="pb">open dialog</button><dialog id="din"><button>x</button></dialog></div><dialog id="dout"><button>x</button></dialog>`);
    await page.evaluate(() => { document.getElementById("p").showPopover(); document.getElementById("dout").showModal(); });
    out.outsideDialogClosesPopover = await page.evaluate(() => !document.getElementById("p").matches(":popover-open"));
    await page.evaluate(() => { document.getElementById("dout").close(); document.getElementById("p").showPopover(); document.getElementById("din").showModal(); });
    out.dialogInsidePopover_popoverStillOpen = await page.evaluate(() => document.getElementById("p").matches(":popover-open"));
    // popover inside modal dialog, Escape closes popover first?
    await page.setContent(BASE + `<dialog id="d"><button id="b">b</button><div id="p" popover>pop</div></dialog>`);
    await page.click("#opener");
    await page.evaluate(() => { document.getElementById("d").showModal(); });
    await page.click("#b");
    await page.evaluate(() => document.getElementById("p").showPopover());
    await page.keyboard.press("Escape"); await page.waitForTimeout(50);
    out.escWithPopoverInDialog = await page.evaluate(() => ({ dialog: document.getElementById("d").open, popover: document.getElementById("p").matches(":popover-open") }));
    return out;
  },

  async exitAnimationTopLayer(page) {
    // Is a closing modal dialog still in the top layer during its exit transition (without and with overlay)?
    const out = {};
    for (const withOverlay of [false, true]) {
      await page.setContent(`<!doctype html><style>
        #cover{position:fixed;inset:0;z-index:2147483647;background:transparent}
        dialog{position:fixed;inset:0;margin:auto;width:200px;height:200px;opacity:1;
          transition: opacity 1s, display 1s allow-discrete ${withOverlay ? ", overlay 1s allow-discrete" : ""};}
        dialog:not([open]){opacity:0}
        dialog::backdrop{background:rgb(255,0,0);transition: display 1s allow-discrete ${withOverlay ? ", overlay 1s allow-discrete" : ""};}
      </style><div id="cover"></div><dialog id="d">hi</dialog>`);
      await page.evaluate(() => document.getElementById("d").showModal());
      await page.waitForTimeout(100);
      const before = await page.evaluate(() => document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.id);
      await page.evaluate(() => document.getElementById("d").close());
      await page.waitForTimeout(150);
      const during = await page.evaluate(() => ({ hit: document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.id, display: getComputedStyle(document.getElementById("d")).display, opacity: getComputedStyle(document.getElementById("d")).opacity, modal: document.getElementById("d").matches(":modal") }));
      out[withOverlay ? "withOverlay" : "noOverlay"] = { before, during };
    }
    return out;
  },

  async formMethodDialog(page) {
    await page.setContent(BASE + `<dialog id="d"><form method="dialog"><input name="x" value="1"><button id="ok" value="ok">OK</button><button id="no" formmethod="dialog" value="no">No</button></form></dialog>`);
    await page.evaluate(() => { window.log = []; const d = document.getElementById("d"); d.addEventListener("close", () => log.push("close:" + d.returnValue)); d.addEventListener("submit", (e) => log.push("submit submitter=" + e.submitter?.id)); d.showModal(); });
    await page.click("#ok"); await page.waitForTimeout(50);
    return { open: await page.evaluate(() => document.getElementById("d").open), log: await page.evaluate(() => log) };
  },

  async invokerCommands(page) {
    await page.setContent(BASE + `<button id="show" commandfor="d" command="show-modal">show</button><dialog id="d"><button id="rc" commandfor="d" command="request-close" value="rcv">rc</button><button id="c" commandfor="d" command="close" value="cv">c</button></dialog>`);
    await page.evaluate(() => { window.log = []; const d = document.getElementById("d"); for (const t of ["command", "cancel", "close", "toggle"]) d.addEventListener(t, (e) => log.push(t + (t === "command" ? ":" + e.command : "") + (t === "close" ? ":" + d.returnValue : ""))); });
    await page.click("#show"); await page.waitForTimeout(30);
    const r = { afterShow: await page.evaluate(() => [document.getElementById("d").matches(":modal"), document.activeElement?.id]) };
    await page.click("#rc"); await page.waitForTimeout(30);
    r.afterRequestClose = await page.evaluate(() => document.getElementById("d").open);
    r.activeAfterClose = await page.evaluate(() => document.activeElement?.id);
    await page.click("#show"); await page.click("#c"); await page.waitForTimeout(30);
    r.log = await page.evaluate(() => log);
    // ARIA expanded on invoker?
    r.ariaSnapshot = await page.locator("#show").ariaSnapshot().catch((e) => String(e).slice(0, 80));
    return r;
  },

  async removeOpenAttr(page) {
    await page.setContent(BASE + `<dialog id="d"><button>x</button></dialog>`);
    await page.click("#opener");
    return page.evaluate(async () => {
      const d = document.getElementById("d"); const log = [];
      for (const t of ["close", "toggle"]) d.addEventListener(t, () => log.push(t));
      d.showModal();
      d.removeAttribute("open");
      await new Promise((r) => setTimeout(r, 50));
      const r = { modal: d.matches(":modal"), openProp: d.open, display: getComputedStyle(d).display, bodyInertProbe: document.elementFromPoint(5, 5)?.id || document.elementFromPoint(5, 5)?.tagName, log };
      try { d.showModal(); r.reShowModal = "ok"; } catch (e) { r.reShowModal = e.name; }
      return r;
    });
  },

  async a11y(page) {
    await page.setContent(BASE + `<dialog id="d" aria-labelledby="h"><h2 id="h">Title</h2><button>x</button></dialog><dialog id="nm" aria-label="NM"><button>y</button></dialog>`);
    await page.evaluate(() => { document.getElementById("d").showModal(); });
    const modal = await page.locator("body").ariaSnapshot();
    await page.evaluate(() => { document.getElementById("d").close(); document.getElementById("nm").show(); });
    const nonModal = await page.locator("body").ariaSnapshot();
    return { modal, nonModal };
  },
};

const only = process.argv[2];
for (const name of ["chromium", "firefox"]) {
  const b = await pw[name].launch();
  console.log(`\n##### ${name} ${b.version()}`);
  for (const [k, fn] of Object.entries(probes)) {
    if (only && k !== only) continue;
    const page = await b.newPage();
    try { console.log(k, JSON.stringify(await fn(page), null, 1)); } catch (e) { console.log(k, "ERROR", String(e).slice(0, 300)); }
    await page.close();
  }
  await b.close();
}

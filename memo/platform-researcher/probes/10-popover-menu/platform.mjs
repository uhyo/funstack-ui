// Popover / Menu platform probes (2026-10-17). Run: node platform.mjs  (Chromium + Firefox; WebKit cannot launch locally)
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");

const CSS = `<style>
  body { margin: 0; padding: 20px; }
  [popover] { margin: 0; position: fixed; position-area: block-end span-inline-end; position-try-fallbacks: flip-block, flip-inline; }
  .sub { position-area: span-block-end inline-end; }
  [popover]:popover-open { display: flex; flex-direction: column; }
</style>`;
// Menu: trigger -> #m (auto). Inside #m: item "sub-dom" -> #s1 (auto, DOM child of #m), item "sub-sib" -> #s2 (auto, sibling after #m in body),
// item "sub-js" -> #s3 (auto sibling, opened by script with/without source).
const MENU = `${CSS}
<button id="before">before</button>
<button id="t" commandfor="m" command="toggle-popover">Menu</button>
<button id="after">after</button>
<div id="m" popover>
  <button id="i1">Item 1</button>
  <button id="sub-dom" commandfor="s1" command="toggle-popover">Sub (DOM child)</button>
  <button id="sub-sib" commandfor="s2" command="toggle-popover">Sub (sibling)</button>
  <button id="sub-js">Sub (js)</button>
  <div id="s1" popover class="sub"><button id="s1i">S1 item</button></div>
</div>
<div id="s2" popover class="sub"><button id="s2i">S2 item</button></div>
<div id="s3" popover class="sub"><button id="s3i">S3 item</button></div>
<div id="other" popover>other</div>
<button id="far" style="position:absolute; top: 600px; left: 600px">far</button>`;

const st = () => ["m", "s1", "s2", "s3", "other"].filter((id) => document.getElementById(id).matches(":popover-open")).join(",") || "(none)";
const tick = (page) => page.waitForTimeout(60);

const probes = {
  async features(page) {
    await page.setContent(MENU);
    return page.evaluate(() => ({
      hint: (() => { const d = document.createElement("div"); d.popover = "hint"; return d.popover; })(),
      interestFor: "interestForElement" in HTMLButtonElement.prototype,
      focusgroup: "focusgroup" in HTMLElement.prototype || document.createElement("div").hasAttribute !== undefined && ("focusGroup" in HTMLElement.prototype),
      focusgroupAttrProp: ["focusgroup", "focusGroup"].filter((k) => k in HTMLElement.prototype),
      commandFor: "commandForElement" in HTMLButtonElement.prototype,
      menulistElement: document.createElement("menulist").constructor.name,
      menuitemElement: document.createElement("menuitem").constructor.name,
      anchoredContainer: CSS.supports("container-type", "anchored"),
      positionTryFallbacks: CSS.supports("position-try-fallbacks", "flip-block"),
      positionAnchorInitial: getComputedStyle(document.body).positionAnchor,
      toggleEventSource: "source" in ToggleEvent.prototype,
      openPseudo: CSS.supports("selector(:open)"),
      startVT: typeof document.startViewTransition,
    }));
  },

  async nesting(page) {
    await page.setContent(MENU);
    const r = {};
    await page.click("#t"); await tick(page); r.openMenu = await page.evaluate(st);
    await page.click("#sub-dom"); await tick(page); r.openSubDomChild = await page.evaluate(st);
    await page.click("#sub-sib"); await tick(page); r.thenSubSibling_commandfor = await page.evaluate(st);
    await page.keyboard.press("Escape"); await tick(page); r.esc1 = await page.evaluate(st);
    await page.keyboard.press("Escape"); await tick(page); r.esc2 = await page.evaluate(st);
    // script open of sibling submenu without source / with source
    await page.click("#t"); await tick(page);
    await page.evaluate(() => document.getElementById("s3").showPopover()); await tick(page); r.jsNoSource = await page.evaluate(st);
    await page.evaluate(() => document.getElementById("s3").hidePopover());
    await page.click("#t"); await tick(page);
    await page.evaluate(() => document.getElementById("s3").showPopover({ source: document.getElementById("sub-js") })); await tick(page); r.jsWithSource = await page.evaluate(st);
    // click outside closes all?
    await page.mouse.click(700, 10); await tick(page); r.outsideClick = await page.evaluate(st);
    // click inside parent menu while sub open: closes the sub only?
    await page.click("#t"); await tick(page); await page.click("#sub-dom"); await tick(page);
    await page.click("#i1"); await tick(page); r.clickParentItemWhileSubOpen = await page.evaluate(st);
    // open unrelated auto popover while menu+sub open
    await page.click("#sub-dom"); await tick(page);
    await page.evaluate(() => document.getElementById("other").showPopover()); await tick(page); r.unrelatedAutoOpens = await page.evaluate(st);
    await page.evaluate(() => document.getElementById("other").hidePopover());
    // invoker click toggles closed (not light-dismissed then reopened)
    await page.click("#t"); await tick(page); const a = await page.evaluate(st);
    await page.click("#t"); await tick(page); r.invokerToggle = `${a} -> ${await page.evaluate(st)}`;
    return r;
  },

  async focus(page) {
    await page.setContent(MENU);
    const af = () => document.activeElement?.id || document.activeElement?.tagName;
    const r = {};
    await page.focus("#t"); await page.keyboard.press("Enter"); await tick(page);
    r.afterOpenByKeyboard = await page.evaluate(af);
    await page.keyboard.press("Tab"); r.tabFromInvoker = await page.evaluate(af);
    for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
    r.tab5FromInvoker = await page.evaluate(af); r.openAfterTabbingOut = await page.evaluate(st);
    // Escape with focus inside -> focus returns to invoker?
    await page.evaluate(() => document.getElementById("m").hidePopover());
    await page.focus("#t"); await page.keyboard.press("Enter"); await tick(page);
    await page.focus("#i1"); await page.keyboard.press("Escape"); await tick(page);
    r.escapeFocusReturn = await page.evaluate(af);
    // hidePopover() from script with focus inside
    await page.focus("#t"); await page.keyboard.press("Enter"); await tick(page); await page.focus("#i1");
    await page.evaluate(() => document.getElementById("m").hidePopover()); await tick(page);
    r.hidePopoverFocusReturn = await page.evaluate(af);
    // opened by script without source, focus inside, escape
    await page.focus("#before");
    await page.evaluate(() => document.getElementById("m").showPopover()); await page.focus("#i1"); await page.keyboard.press("Escape"); await tick(page);
    r.scriptOpenNoSourceEscapeFocus = await page.evaluate(af);
    await page.focus("#before");
    await page.evaluate(() => document.getElementById("m").showPopover({ source: document.getElementById("t") })); await page.focus("#i1"); await page.keyboard.press("Escape"); await tick(page);
    r.scriptOpenWithSourceEscapeFocus = await page.evaluate(af);
    // light dismiss by clicking another button: focus goes where?
    await page.click("#t"); await tick(page); await page.focus("#i1");
    await page.click("#far"); await tick(page); r.lightDismissFocus = await page.evaluate(af);
    // autofocus inside popover set by attribute before showing
    await page.evaluate(() => document.getElementById("i1").setAttribute("autofocus", ""));
    await page.click("#t"); await tick(page); r.autofocusOnShow = await page.evaluate(af);
    await page.evaluate(() => { document.getElementById("m").hidePopover(); document.getElementById("i1").removeAttribute("autofocus"); });
    // focus after clicking item that hides popover (command=hide-popover)
    await page.evaluate(() => { const b = document.getElementById("i1"); b.setAttribute("commandfor", "m"); b.setAttribute("command", "hide-popover"); });
    await page.click("#t"); await tick(page); await page.click("#i1"); await tick(page);
    r.itemHidePopoverFocus = await page.evaluate(af) + " open=" + (await page.evaluate(st));
    // Tab order when popover is placed far away in DOM (sibling #s2 after menu) opened via commandfor from #t2
    await page.evaluate(() => { const b = document.createElement("button"); b.id = "t2"; b.setAttribute("commandfor", "s2"); b.setAttribute("command", "toggle-popover"); b.textContent = "t2"; document.body.prepend(b); });
    await page.focus("#t2"); await page.keyboard.press("Enter"); await tick(page);
    await page.keyboard.press("Tab"); r.tabFromCommandforInvokerFarPopover = await page.evaluate(af);
    await page.keyboard.press("Tab"); r.tabOutOfFarPopover = await page.evaluate(af);
    await page.evaluate(() => document.getElementById("s2").hidePopover());
    // same with showPopover({source}) (BCD: focus order not changed)
    await page.focus("#t2");
    await page.evaluate(() => document.getElementById("s2").showPopover({ source: document.getElementById("t2") })); await tick(page);
    await page.keyboard.press("Tab"); r.tabAfterShowPopoverSource = await page.evaluate(af);
    return r;
  },

  async toggleSource(page) {
    await page.setContent(MENU);
    return page.evaluate(async () => {
      const m = document.getElementById("m"); const log = [];
      m.addEventListener("beforetoggle", (e) => log.push(`before:${e.newState}:src=${e.source?.id}:cancelable=${e.cancelable}`));
      m.addEventListener("toggle", (e) => log.push(`toggle:${e.newState}:src=${e.source?.id}`));
      document.getElementById("t").click(); await new Promise((r) => setTimeout(r, 50));
      document.getElementById("t").click(); await new Promise((r) => setTimeout(r, 50));
      // command event cancelable?
      let cmd = null; m.addEventListener("command", (e) => { cmd = `${e.command}:src=${e.source?.id}:cancelable=${e.cancelable}`; e.preventDefault(); }, { once: true });
      document.getElementById("t").click(); await new Promise((r) => setTimeout(r, 50));
      return { log, cmd, openAfterPreventedCommand: m.matches(":popover-open") };
    });
  },

  async anchorPosition(page) {
    await page.setContent(MENU);
    await page.click("#t"); await tick(page);
    await page.click("#sub-dom"); await tick(page);
    await page.click("#sub-sib"); await tick(page);
    await page.evaluate(() => document.getElementById("s3").showPopover({ source: document.getElementById("sub-js") })); await tick(page);
    return page.evaluate(() => {
      const r = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
      return { t: r("t"), m: r("m"), subDom: r("sub-dom"), s1: r("s1"), subSib: r("sub-sib"), s2: r("s2"), subJs: r("sub-js"), s3: r("s3"), open: ["m","s1","s2","s3"].map((i) => document.getElementById(i).matches(":popover-open")) };
    });
  },

  async viewTransition(page) {
    await page.setContent(MENU + `<style>#m { view-transition-name: menu; } ::view-transition-group(menu) { animation-duration: 1s; }</style>`);
    return page.evaluate(async () => {
      const m = document.getElementById("m"); const out = {};
      const vt = document.startViewTransition(() => m.showPopover({ source: document.getElementById("t") }));
      await vt.ready;
      out.openAnims = document.getAnimations().map((a) => a.effect?.pseudoElement).filter(Boolean);
      out.openRect = (() => { const b = m.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top)]; })();
      await vt.finished;
      const vt2 = document.startViewTransition(() => m.hidePopover());
      await vt2.ready;
      out.closeAnims = document.getAnimations().map((a) => a.effect?.pseudoElement).filter(Boolean);
      out.openDuringClose = m.matches(":popover-open");
      await vt2.finished;
      // interaction: does light dismiss / pointer reach page during VT? (skip) ; does an open auto popover stay open across a VT of unrelated content?
      m.showPopover({ source: document.getElementById("t") });
      const vt3 = document.startViewTransition(() => { document.getElementById("before").textContent = "changed"; });
      await vt3.finished; out.popoverStillOpenAfterUnrelatedVT = m.matches(":popover-open");
      return out;
    });
  },
};

const only = process.argv[2];
for (const name of ["chromium", "firefox"]) {
  const b = await pw[name].launch();
  console.log(`\n##### ${name} ${b.version()}`);
  for (const [k, fn] of Object.entries(probes)) {
    if (only && k !== only) continue;
    const page = await b.newPage({ viewport: { width: 1000, height: 700 } }); page.setDefaultTimeout(3000);
    try { console.log(k, JSON.stringify(await fn(page), null, 1)); } catch (e) { console.log(k, "ERROR", e.message.split("\n")[0]); }
    await page.close();
  }
  await b.close();
}

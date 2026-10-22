// Engine facts for `*.browser.test.tsx` files, which run on Chromium, Firefox and WebKit (see
// memo/developer/cross-engine.md). Prefer the feature checks: Playwright's WebKit build tracks
// WebKit trunk and can be ahead of the shipping Safari, so "webkit" does not mean "Safari 27.0".
import { server } from "vitest/browser";

/** The Playwright engine running this file: "chromium", "firefox" or "webkit". */
export const browserName = server.browser;

/**
 * `popover="hint"` is recognised. Where it is not (Safari 27.0), the attribute value is an
 * invalid value and the element behaves, and reflects, as `popover="manual"`.
 */
export const supportsPopoverHint = (() => {
  const el = document.createElement("div");
  el.setAttribute("popover", "hint");
  return el.popover === "hint";
})();

/** Interest Invokers (`interestfor`); Chromium only as of 2026-10. */
export const supportsInterestFor =
  typeof HTMLButtonElement !== "undefined" && "interestForElement" in HTMLButtonElement.prototype;

/**
 * `:checked` matches a checked checkbox whose `indeterminate` flag is also set. False in Chromium
 * 156 (the mixed state hides `:checked`), true in Firefox 157 (memo/developer/switch-checkbox.md).
 */
export const checkedMatchesWhileIndeterminate = (() => {
  const el = document.createElement("input");
  el.type = "checkbox";
  el.checked = true;
  el.indeterminate = true;
  return el.matches(":checked");
})();

/**
 * `<dialog closedby>` (light dismiss and close-request control). Chromium 134+ and Firefox 141+;
 * Safari 27.0 lacks it (Technology Preview only), so the Dialog's JS baseline runs there.
 */
export const supportsDialogClosedBy =
  typeof HTMLDialogElement !== "undefined" && "closedBy" in HTMLDialogElement.prototype;

/**
 * Native roving focus (`focusgroup`); Chromium 150+ only as of 2026-10. The IDL attribute is
 * camel-cased `focusGroup`: `"focusgroup" in HTMLElement.prototype` is always false (issue #43).
 */
export const supportsFocusgroup =
  typeof HTMLElement !== "undefined" && "focusGroup" in HTMLElement.prototype;

/**
 * Customizable select (`appearance: base-select`): Chromium 135+ and Safari 27. Firefox (default
 * prefs) renders the native select from the same markup (design/components/select.md 11).
 */
export const supportsBaseSelect =
  typeof CSS !== "undefined" && CSS.supports("appearance", "base-select");

/**
 * `<selectedcontent>` is a known element whose content the browser clones from the selected
 * option (Chromium 135+, Safari 27). Elsewhere it is a plain `HTMLElement` and stays empty.
 */
export const supportsSelectedContent = "HTMLSelectedContentElement" in globalThis;

/**
 * `Element.prototype.ariaNotify()` (Chromium 141, Firefox 150, Safari 27): Combobox announces
 * the result count with it (design/components/combobox.md 6.4). All three stable engines have it;
 * the check stays for Playwright builds that may lag.
 */
export const supportsAriaNotify =
  typeof Element !== "undefined" && "ariaNotify" in Element.prototype;

/**
 * Whether an anchored `position-area` popover lands where its keywords say when its parent box
 * has a direction different from the root's. False in Firefox (Mozilla bug 2019601, #89): the
 * inline-axis alignment inside the cell is applied mirrored, physical keywords included
 * (`bottom span-right` under a 300..500 px anchor lands at -80 instead of 300). True in Chromium
 * and WebKit. A runtime probe rather than `browserName === "firefox"` (conventions 13.3), so the
 * container-RTL rows fail, and their degraded branch can be deleted, the day the bug is fixed.
 * Evaluated at import, in the LTR test document.
 */
export const anchorPositionHonoursParentDirection = (() => {
  const island = document.createElement("div");
  island.dir = "rtl";
  const anchor = document.createElement("button");
  anchor.style.cssText =
    "position: fixed; left: 300px; top: 100px; width: 200px; height: 20px; margin: 0; padding: 0; border: 0";
  const popover = document.createElement("div");
  popover.popover = "manual";
  popover.style.cssText =
    "margin: 0; padding: 0; border: 0; width: 120px; height: 20px; position-area: bottom span-right; position-try-fallbacks: none";
  island.append(anchor, popover);
  document.body.append(island);
  try {
    popover.showPopover({ source: anchor });
    return Math.abs(popover.getBoundingClientRect().left - 300) < 1;
  } finally {
    if (popover.matches(":popover-open")) popover.hidePopover();
    island.remove();
  }
})();

/**
 * `focus({ focusVisible })` is read (Chromium 145+, Firefox 104+, Safari 18.4+): the bindings
 * read the dictionary member before the method runs, so a detached element is enough.
 */
export const supportsFocusVisibleOption = (() => {
  let read = false;
  document.createElement("div").focus({
    get focusVisible() {
      read = true;
      return false;
    },
  } as FocusOptions);
  return read;
})();

let topLayerReChoice: Promise<boolean> | undefined;

/**
 * Whether an anchored **top-layer** popover re-runs `position-try-fallbacks` after a scroll makes
 * its option overflow (css-anchor-position-1 §6.5). False in Chromium 156, which keeps the
 * overflowing option (#92, a human upstream task); true in Firefox 157. The reduction from #92:
 * show, wait 300 ms, scroll the anchor to the viewport top, wait 500 ms, see whether the popover
 * is still above the viewport. Async, so evaluated once on first use and shared. Measured
 * 2026-10-23 in this harness: the same answer at every show-to-scroll delay from 0 to 300 ms
 * (60 runs per engine), so it is not load-sensitive. The Tooltip scroll row pins the engine's
 * outcome on it, so its Chromium branch fails the day #92 is fixed.
 */
export function topLayerAnchorReChoosesOnScroll(): Promise<boolean> {
  topLayerReChoice ??= (async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const scroller = document.createElement("div");
    scroller.style.cssText =
      "position: fixed; top: 0; left: 0; width: 400px; height: 300px; overflow: auto";
    const before = document.createElement("div");
    before.style.height = "200px";
    const anchor = document.createElement("button");
    anchor.style.cssText = "display: block; width: 100px; height: 30px; margin: 0";
    const popover = document.createElement("div");
    popover.popover = "manual";
    popover.style.cssText =
      "margin: 0; padding: 0; border: 0; width: 60px; height: 20px; position-area: top; position-try-fallbacks: flip-block";
    const after = document.createElement("div");
    after.style.height = "1000px";
    scroller.append(before, anchor, popover, after);
    document.body.append(scroller);
    try {
      popover.showPopover({ source: anchor });
      await wait(300);
      scroller.scrollTop = 200;
      await wait(500);
      return popover.getBoundingClientRect().bottom > 0;
    } finally {
      if (popover.matches(":popover-open")) popover.hidePopover();
      scroller.remove();
    }
  })();
  return topLayerReChoice;
}

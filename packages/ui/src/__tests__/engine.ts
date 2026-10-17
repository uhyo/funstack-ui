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

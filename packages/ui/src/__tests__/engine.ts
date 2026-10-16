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

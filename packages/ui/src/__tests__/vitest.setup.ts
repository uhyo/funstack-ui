import "@testing-library/jest-dom/vitest";
import "./popover-shim.js";
import "./dialog-shim.js";
import "./pointer-capture-shim.js";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { resetWarnOnce } from "../internal/dev-warn.js";
import { resetFocusVisibleOption } from "../internal/focus-visible.js";
import { resetInvalidBatch } from "../internal/focus-first-invalid.js";
import { resetToastServerWarning } from "../toast/toast.js";
import { runCleanups } from "./cleanups.js";
import { settleOpenDeferreds } from "./helpers.js";
import { capturedPointers } from "./pointer-capture-shim.js";

const isJsdom = typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom");

/**
 * Closes every open `<dialog>` and hides every open popover: a modal dialog left open makes the
 * next test's page inert, and in jsdom the shims would still count a popover as shown.
 */
function closeOpenTopLayer(): void {
  if (typeof document === "undefined") return;
  for (const dialog of document.querySelectorAll("dialog")) if (dialog.open) dialog.close();
  for (const element of document.querySelectorAll<HTMLElement>("[popover]")) {
    if (element.matches(":popover-open")) element.hidePopover();
  }
}

// Restore every `vi.spyOn` first, so the teardown runs on the real methods (no file needs its own
// `afterEach(vi.restoreAllMocks)`; a file hook that must reach a real method still restores
// itself, since file hooks run before this one). Then close what the test left in the top layer,
// unmount, and in jsdom empty the body: an element a test appended itself, or the server HTML of
// a hydration row, would otherwise reach the next test (and, files sharing the window, the next
// file). Then run the cleanups the test registered (`onCleanup`, `addStyle`,
// `leaveActEnvironment`) and settle whatever it left pending (a failed assertion before its
// `resolve()`): an unsettled async action would entangle every later test's transitions with it.
// Browser files also run vitest.browser.setup.ts, whose hook runs before this one.
//
// The `jsdom` project shares one module graph and one window between the files of a worker
// (`isolate: false`, #107), so the rest puts back what a file could leave for the next: stubbed
// globals and env, pointer captures, the library's once-only dev warnings and its once-only
// detection of `focus({ focusVisible })` (a file may patch `focus()` to read it). The Field
// first-invalid batch is forgotten after every test: its clearing timer may not have run before
// the next test submits. Fake timers stay with the files that install them (each restores them
// in its own `afterEach`): touching vitest's timer controller here, even `vi.isFakeTimers()`,
// made Firefox's browser run deliver a popover's queued `toggle` after a later `setTimeout(0)`
// (environment.browser.test.tsx).
// (React's own once-only warnings cannot be reset: see `takeSelectedContentWarning`.)
afterEach(async () => {
  vi.restoreAllMocks();
  closeOpenTopLayer();
  cleanup();
  if (isJsdom) document.body.innerHTML = "";
  runCleanups();
  await settleOpenDeferreds();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  capturedPointers.clear();
  resetWarnOnce();
  resetToastServerWarning();
  resetFocusVisibleOption();
  resetInvalidBatch();
});

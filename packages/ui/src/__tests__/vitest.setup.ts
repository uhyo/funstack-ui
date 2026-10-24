import "@testing-library/jest-dom/vitest";
import "./popover-shim.js";
import "./dialog-shim.js";
import "./pointer-capture-shim.js";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { resetAnnouncer } from "../internal/announce.js";
import { resetWarnOnce } from "../internal/dev-warn.js";
import { resetFocusVisibleOption } from "../internal/use-popover-popup.js";
import { resetToastServerWarning } from "../toast/toast.js";
import { runCleanups } from "./cleanups.js";
import { settleOpenDeferreds } from "./helpers.js";
import { capturedPointers } from "./pointer-capture-shim.js";

// Restore every `vi.spyOn` first, so the unmount runs on the real methods (no file needs its own
// `afterEach(vi.restoreAllMocks)`; a file hook that must reach a real method still restores
// itself, since file hooks run before this one). Then unmount, then settle whatever a test left
// pending (a failed assertion before its `resolve()`): an unsettled async action would entangle
// every later test's transitions with it. Cleanups a browser test registered (`addStyle`,
// `onCleanup`) and its own `afterEach` did not run, run after the unmount.
//
// The `jsdom` project shares one module graph and one window between the files of a worker
// (`isolate: false`, #107), so the rest puts back what a file could leave for the next: real
// timers, stubbed globals and env, pointer captures, the announcer's live region (it outlives the
// unmount, with its pending writes), the library's once-only dev warnings and its once-only
// detection of `focus({ focusVisible })` (a file may patch `focus()` to read it). The announcer
// goes before `useRealTimers`, so a write queued on fake timers is cancelled on the same clock.
// (React's own once-only warnings cannot be reset: see `takeSelectedContentWarning`.)
afterEach(async () => {
  vi.restoreAllMocks();
  cleanup();
  runCleanups();
  await settleOpenDeferreds();
  resetAnnouncer();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  capturedPointers.clear();
  resetWarnOnce();
  resetToastServerWarning();
  resetFocusVisibleOption();
});

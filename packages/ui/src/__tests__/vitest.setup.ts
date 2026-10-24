import "@testing-library/jest-dom/vitest";
import "./popover-shim.js";
import "./dialog-shim.js";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { settleOpenDeferreds } from "./helpers.js";

// Restore every `vi.spyOn` first, so the unmount runs on the real methods (no file needs its own
// `afterEach(vi.restoreAllMocks)`; a file hook that must reach a real method still restores
// itself, since file hooks run before this one). Then unmount, then settle whatever a test left
// pending (a failed assertion before its `resolve()`): an unsettled async action would entangle
// every later test's transitions with it.
afterEach(async () => {
  vi.restoreAllMocks();
  cleanup();
  await settleOpenDeferreds();
});

import "@testing-library/jest-dom/vitest";
import "./popover-shim.js";
import "./dialog-shim.js";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { settleOpenDeferreds } from "./helpers.js";

// Unmount first, then settle whatever a test left pending (a failed assertion before its
// `resolve()`): an unsettled async action would entangle every later test's transitions with it.
afterEach(async () => {
  cleanup();
  await settleOpenDeferreds();
});

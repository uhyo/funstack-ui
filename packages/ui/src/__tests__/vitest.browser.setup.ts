// Browser-project teardown, after the file's own hooks and before vitest.setup.ts's: release
// every mouse button a row left down. A row failing between `mouse.down` and `mouse.up` would
// otherwise leave it held for the next rows (in Firefox the files share one mouse, #62).
import { afterEach } from "vitest";
import { mouse } from "./browser-commands.js";

afterEach(async () => {
  await mouse.releaseHeld();
});

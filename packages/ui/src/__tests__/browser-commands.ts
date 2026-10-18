// Custom browser commands registered in vitest.config.ts (browser tests only).
import { commands } from "vitest/browser";

declare module "vitest/browser" {
  interface BrowserCommands {
    emulateReducedMotion: (reduce: boolean) => Promise<void>;
  }
}

/** Runs `body` with `prefers-reduced-motion: reduce` emulated, and restores it afterwards. */
export async function withReducedMotion(body: () => Promise<void>): Promise<void> {
  await commands.emulateReducedMotion(true);
  try {
    await body();
  } finally {
    await commands.emulateReducedMotion(false);
  }
}

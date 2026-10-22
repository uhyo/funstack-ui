// Custom browser commands registered in vitest.config.ts (browser tests only).
import { commands } from "vitest/browser";

declare module "vitest/browser" {
  interface BrowserCommands {
    emulateReducedMotion: (reduce: boolean) => Promise<void>;
    mouse: (
      action: "move" | "down" | "up" | "click",
      x: number,
      y: number,
      button?: "left" | "right" | "middle",
    ) => Promise<void>;
  }
}

/**
 * Maps a point in this test frame's viewport (client coordinates) to the top-level page's
 * viewport, which Playwright's `page.mouse` uses: the test runs in an iframe, so each frame's
 * offset and scale are applied.
 */
export function toPagePoint(x: number, y: number): { x: number; y: number } {
  let px = x;
  let py = y;
  let win: Window = window;
  while (win.frameElement !== null) {
    const frame = win.frameElement as HTMLElement;
    const box = frame.getBoundingClientRect();
    const scale = (box.width - frame.clientLeft * 2) / win.innerWidth || 1;
    px = box.left + frame.clientLeft + px * scale;
    py = box.top + frame.clientTop + py * scale;
    win = win.parent;
  }
  return { x: px, y: py };
}

type Button = "left" | "right" | "middle";

/** Real mouse input at client coordinates of this frame (see `toPagePoint`). */
export const mouse = {
  move: (x: number, y: number) => {
    const p = toPagePoint(x, y);
    return commands.mouse("move", p.x, p.y);
  },
  /** Moves to (x, y) and presses `button`. */
  down: (x: number, y: number, button: Button = "left") => {
    const p = toPagePoint(x, y);
    return commands.mouse("down", p.x, p.y, button);
  },
  /** Moves to (x, y) and releases `button`. */
  up: (x: number, y: number, button: Button = "left") => {
    const p = toPagePoint(x, y);
    return commands.mouse("up", p.x, p.y, button);
  },
  click: (x: number, y: number, button: Button = "left") => {
    const p = toPagePoint(x, y);
    return commands.mouse("click", p.x, p.y, button);
  },
};

/** Runs `body` with `prefers-reduced-motion: reduce` emulated, and restores it afterwards. */
export async function withReducedMotion(body: () => Promise<void>): Promise<void> {
  await commands.emulateReducedMotion(true);
  try {
    await body();
  } finally {
    await commands.emulateReducedMotion(false);
  }
}

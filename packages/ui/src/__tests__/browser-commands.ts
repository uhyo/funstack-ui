// Custom browser commands registered in vitest.config.ts (browser tests only).
import { commands } from "vitest/browser";

declare module "vitest/browser" {
  interface BrowserCommands {
    emulateReducedMotion: (reduce: boolean) => Promise<void>;
    mouse: (
      action: "move" | "down" | "up" | "click" | "dblclick",
      x: number,
      y: number,
      button?: "left" | "right" | "middle",
    ) => Promise<void>;
    wheel: (x: number, y: number, deltaX: number, deltaY: number) => Promise<void>;
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

/**
 * Resolves once `type` reached this window (capture phase) and the rest of that input task ran
 * (one macrotask later: `mousedown` / `contextmenu` follow `pointerdown`, `click` / `auxclick`
 * follow `pointerup`, in the same task). The command's reply can arrive before the page handled
 * the input, so a caller inside `act` awaits this to keep the handlers' updates in its scope.
 * The fallback only bounds a press that produced no event (a release with no button down).
 */
function inputHandled(type: string): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      window.removeEventListener(type, done, true);
      clearTimeout(fallback);
      setTimeout(resolve, 0);
    };
    const fallback = setTimeout(done, 5000);
    window.addEventListener(type, done, true);
  });
}

/** Buttons `mouse.down` pressed and no `mouse.up` released yet. */
const held = new Set<Button>();

/**
 * Real mouse input at client coordinates of this frame (see `toPagePoint`). `down`, `up`,
 * `click` and `dblclick` resolve after the page handled the input (`inputHandled`).
 */
export const mouse = {
  /**
   * Releases every button a row left down (an afterEach: in Firefox the files share one mouse,
   * #62, so a row failing between `down` and `up` would cascade). Bounded: no event wait.
   */
  releaseHeld: async () => {
    for (const button of [...held]) {
      held.delete(button);
      await commands.mouse("up", 1, 1, button);
    }
  },
  move: (x: number, y: number) => {
    const p = toPagePoint(x, y);
    return commands.mouse("move", p.x, p.y);
  },
  /** Moves to (x, y) and presses `button`. */
  down: async (x: number, y: number, button: Button = "left") => {
    const p = toPagePoint(x, y);
    const handled = inputHandled("pointerdown");
    held.add(button);
    await commands.mouse("down", p.x, p.y, button);
    await handled;
  },
  /** Moves to (x, y) and releases `button`. */
  up: async (x: number, y: number, button: Button = "left") => {
    const p = toPagePoint(x, y);
    const handled = inputHandled("pointerup");
    held.delete(button);
    await commands.mouse("up", p.x, p.y, button);
    await handled;
  },
  click: async (x: number, y: number, button: Button = "left") => {
    const p = toPagePoint(x, y);
    const handled = inputHandled("pointerup");
    await commands.mouse("click", p.x, p.y, button);
    await handled;
  },
  /** Two presses and releases, the second with `detail === 2`; resolves after the `dblclick`. */
  dblclick: async (x: number, y: number, button: Button = "left") => {
    const p = toPagePoint(x, y);
    const handled = inputHandled("dblclick");
    await commands.mouse("dblclick", p.x, p.y, button);
    await handled;
  },
};

/**
 * A real wheel turn at client coordinates of this frame (see `toPagePoint`). Resolves once the
 * `wheel` event reached this window and its task ran; the scroll it causes may come later.
 */
export async function wheel(x: number, y: number, deltaX: number, deltaY: number): Promise<void> {
  const p = toPagePoint(x, y);
  const handled = inputHandled("wheel");
  await commands.wheel(p.x, p.y, deltaX, deltaY);
  await handled;
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

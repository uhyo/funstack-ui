// Helpers for the wave 11 placement rows (`*.browser.test.tsx` only): the resolved side
// (conventions 13.2) and direction (13.1, 13.3, 13.4). Browser tests only.
import { act } from "@testing-library/react";
import { expect } from "vitest";

/** Two coordinates within a pixel (sub-pixel layout differs per engine). */
export const near = (a: number, b: number): boolean => Math.abs(a - b) <= 1;

/**
 * Polls inside an `act` scope: the resolved-placement observer writes urgently (`flushSync`)
 * whenever the engine reports a new placement, so wrapping keeps those writes from logging
 * "not wrapped in act".
 */
export async function actPoll<T>(read: () => T, expected: T, timeout = 3000): Promise<void> {
  await act(async () => {
    await expect.poll(read, { timeout }).toBe(expected);
  });
}

/** Two animation frames: every observer callback for the last change has run. */
export const frames = (): Promise<void> =>
  act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });

/** Runs `body` with `dir` on the root element, restoring the previous value afterwards. */
export async function withPageDirection(dir: "rtl", body: () => Promise<void>): Promise<void> {
  const root = document.documentElement;
  const previous = root.getAttribute("dir");
  root.dir = dir;
  try {
    await body();
  } finally {
    if (previous === null) root.removeAttribute("dir");
    else root.setAttribute("dir", previous);
  }
}

/**
 * Which side of `anchor` the `popup` box is on, from the geometry: `"top"` / `"bottom"` /
 * `"left"` / `"right"` when an edge meets the anchor's opposite edge, else a description.
 */
export function placedSide(popup: Element, anchor: Element): string {
  const a = anchor.getBoundingClientRect();
  const p = popup.getBoundingClientRect();
  if (near(p.bottom, a.top)) return "top";
  if (near(p.top, a.bottom)) return "bottom";
  if (near(p.right, a.left)) return "left";
  if (near(p.left, a.right)) return "right";
  return `elsewhere (popup ${p.left},${p.top}..${p.right},${p.bottom}; anchor ${a.left},${a.top}..${a.right},${a.bottom})`;
}

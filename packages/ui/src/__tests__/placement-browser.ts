// Helpers for the wave 11 placement rows (`*.browser.test.tsx` only): the resolved side
// (conventions 13.2) and direction (13.1, 13.3, 13.4). Browser tests only.
import { act } from "@testing-library/react";
import { expect } from "vitest";
import { anchorPositionHonoursParentDirection } from "./engine.js";

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

/** Scrolls `scroller` to `top` and lets the engine lay out the frame after the `scroll` event. */
export async function scrollContainerTo(scroller: Element, top: number): Promise<void> {
  const scrolled = new Promise((resolve) =>
    scroller.addEventListener("scroll", resolve, { once: true }),
  );
  await act(async () => {
    scroller.scrollTop = top;
    await scrolled;
  });
  await frames();
}

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

type InlineEdge = "left" | "right";
const opposite = (edge: InlineEdge): InlineEdge => (edge === "left" ? "right" : "left");

/**
 * Asserts that `popup`'s `edges[0]` meets `anchor`'s `edges[1]` (inline axis), for a popup whose
 * parent box may have a direction different from the root's (a `dir="rtl"` container). Where the
 * engine does not honour that direction (`anchorPositionHonoursParentDirection` false: Firefox,
 * Mozilla 2019601, #89) the inline alignment inside the cell is mirrored and no workaround ships
 * (conventions 13.3), so the degraded placement is asserted instead: neither that pair of edges
 * nor the opposite pair meets. When that branch fails, the bug is fixed: delete it. `honoured`
 * overrides the probe for a row whose popup has no direction island (the page itself is RTL).
 */
export function expectInlineEdges(
  popup: Element,
  anchor: Element,
  [popupEdge, anchorEdge]: readonly [InlineEdge, InlineEdge],
  honoured = anchorPositionHonoursParentDirection,
): void {
  const p = popup.getBoundingClientRect();
  const a = anchor.getBoundingClientRect();
  if (honoured) {
    expect(near(p[popupEdge], a[anchorEdge])).toBe(true);
    return;
  }
  expect(near(p[popupEdge], a[anchorEdge])).toBe(false);
  expect(near(p[opposite(popupEdge)], a[opposite(anchorEdge)])).toBe(false);
}

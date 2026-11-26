// The arithmetic of a swipe toward an edge (design/components/drawer.md 4.1): when a press
// becomes a drag, how far it has gone toward the edge, its release velocity and the dismiss /
// return decision. Pure functions, no DOM; the tracker (`swipe.ts`) feeds them. No directive
// (conventions 7.1).

/** The physical direction a swipe dismisses toward. */
export type SwipeDirection = "up" | "down" | "left" | "right";

/** How far a press must move before it is a drag or is dropped, in px. */
export const SWIPE_SLOP = 6;
/** A release at least this fraction of the extent toward the edge dismisses. */
export const SWIPE_DISMISS_FRACTION = 0.25;
/** A release at least this fast toward the edge dismisses, in px/ms. */
export const SWIPE_FLICK_VELOCITY = 0.5;
/** A release moving back faster than this (away from the edge) returns, in px/ms. */
export const SWIPE_REVERSAL_VELOCITY = 0.1;
/** The release velocity is measured over this much of the gesture's end, in ms. */
export const SWIPE_VELOCITY_WINDOW = 100;

/** The unit vector of a direction. */
export function swipeVector(direction: SwipeDirection): readonly [x: number, y: number] {
  switch (direction) {
    case "up":
      return [0, -1];
    case "down":
      return [0, 1];
    case "left":
      return [-1, 0];
    case "right":
      return [1, 0];
  }
}

/**
 * The signed distance a movement `(dx, dy)` covers toward the edge: positive toward it,
 * negative away from it.
 */
export function towardEdge(dx: number, dy: number, direction: SwipeDirection): number {
  const [x, y] = swipeVector(direction);
  return dx * x + dy * y;
}

/**
 * What a press that has moved `(dx, dy)` from where it went down is: `"wait"` while it is
 * within the slop; once past it, `"start"` when it moved more along the axis than across it
 * and toward the edge, else `"drop"` (the first move in another direction drops the press for
 * good).
 */
export function classifyPress(
  dx: number,
  dy: number,
  direction: SwipeDirection,
): "wait" | "start" | "drop" {
  if (Math.hypot(dx, dy) < SWIPE_SLOP) return "wait";
  const along = towardEdge(dx, dy, direction);
  const [x] = swipeVector(direction);
  const across = x === 0 ? Math.abs(dx) : Math.abs(dy);
  return along > 0 && along > across ? "start" : "drop";
}

/** The offset written while dragging: the distance toward the edge, never below 0. */
export function swipeOffset(toward: number): number {
  return Math.max(0, toward);
}

/** The offset as a physical vector in px (`--drawer-swipe-x` / `-y`). */
export function swipeTranslation(
  offset: number,
  direction: SwipeDirection,
): readonly [x: number, y: number] {
  const [x, y] = swipeVector(direction);
  // `+ 0` turns a `-0` into `0`.
  return [offset * x + 0, offset * y + 0];
}

/** `offset / extent`, clamped to [0, 1]; 0 for an empty extent. */
export function swipeProgress(offset: number, extent: number): number {
  if (!(extent > 0)) return 0;
  return Math.min(1, Math.max(0, offset / extent));
}

/** One point of the gesture: a time (ms) and the signed distance toward the edge. */
export interface SwipeSample {
  readonly time: number;
  readonly toward: number;
}

/**
 * The velocity toward the edge at the release (px/ms, negative when moving back): from the
 * oldest sample within `SWIPE_VELOCITY_WINDOW` of the last one to the last one. 0 when the
 * pointer did not move in that window (held still before the release) or there is one sample.
 */
export function releaseVelocity(samples: readonly SwipeSample[]): number {
  const last = samples.at(-1);
  if (last === undefined) return 0;
  const first = samples.find((sample) => last.time - sample.time <= SWIPE_VELOCITY_WINDOW);
  if (first === undefined || first === last) return 0;
  const elapsed = last.time - first.time;
  if (elapsed <= 0) return 0;
  return (last.toward - first.toward) / elapsed;
}

/**
 * The decision at the release: `"dismiss"` when the offset is at least a quarter of the extent
 * or the release is a flick toward the edge, **but** `"return"` when the pointer was moving
 * back; otherwise `"return"`.
 */
export function releaseOutcome(
  offset: number,
  extent: number,
  velocity: number,
): "dismiss" | "return" {
  if (velocity < -SWIPE_REVERSAL_VELOCITY) return "return";
  if (velocity >= SWIPE_FLICK_VELOCITY) return "dismiss";
  return extent > 0 && offset >= extent * SWIPE_DISMISS_FRACTION ? "dismiss" : "return";
}

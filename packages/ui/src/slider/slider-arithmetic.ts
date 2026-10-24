// Pure value arithmetic of the Slider (design/components/slider.md 5). No directive: no React,
// no client-only API. The library computes exactly what the platform's range sanitisation would,
// so the number it renders is the number the DOM holds and `FormData` posts.

import { EPSILON, gridDecimals, roundTo } from "../internal/decimal.js";
import { clamp, percentage } from "../internal/range-value.js";
import type { Orientation } from "../internal/types.js";

/**
 * The value a native range with these bounds would hold for `value`: snapped to
 * `min + n × step` (ties toward +∞, the HTML step-mismatch rule), clamped to `[min, max]`, and,
 * when the snapped value exceeds `max`, the last grid point below `max` (so `min 0, max 5,
 * step 2` caps at `4`). Rounded to the decimal places of `step` and `min`. With `max < min` the
 * platform's maximum is `min`.
 */
export function snap(value: number, min: number, max: number, step: number): number {
  const decimals = gridDecimals(step, min);
  if (!Number.isFinite(value)) return min;
  if (!(max > min)) return roundTo(min, decimals);
  const lastIndex = Math.floor((max - min) / step + EPSILON);
  let index = Math.floor((value - min) / step + 0.5 + EPSILON);
  if (index > lastIndex) index = lastIndex;
  if (index < 0) index = 0;
  return roundTo(min + index * step, decimals);
}

/** Whether `max` is reachable: `max - min` is a whole number of steps. */
export function isMaxReachable(min: number, max: number, step: number): boolean {
  if (!(max > min)) return true;
  const steps = (max - min) / step;
  return Math.abs(steps - Math.round(steps)) < EPSILON * Math.max(1, steps);
}

/** Whether `value` is a value a native range with these bounds can hold unchanged. */
export function isOnGrid(value: number, min: number, max: number, step: number): boolean {
  return Math.abs(snap(value, min, max, step) - value) < EPSILON * Math.max(1, Math.abs(value));
}

/** The native `min` / `max` of thumb `index`: the slider's bounds, narrowed by its neighbours. */
export function thumbBounds(
  values: readonly number[],
  index: number,
  min: number,
  max: number,
  gap: number,
): { readonly lower: number; readonly upper: number } {
  const decimals = gridDecimals(gap, min);
  const before = values[index - 1];
  const after = values[index + 1];
  const lower = before === undefined ? min : roundTo(before + gap, decimals);
  const upper = after === undefined ? max : roundTo(after - gap, decimals);
  return { lower, upper };
}

/**
 * `next` for thumb `index`, snapped to the slider's grid and clamped between its neighbours
 * (`values[i - 1] + gap`, `values[i + 1] - gap`; on the grid, because every thumb shares `step`
 * and `min`). With no room between the neighbours the thumb keeps its value.
 */
export function clampToNeighbours(
  values: readonly number[],
  index: number,
  next: number,
  min: number,
  max: number,
  step: number,
  gap: number,
): number {
  const { lower, upper } = thumbBounds(values, index, min, max, gap);
  const current = values[index] ?? next;
  if (lower > upper + EPSILON) return current;
  return Math.min(Math.max(snap(next, min, max, step), lower), upper);
}

/**
 * The value a native input with these attributes would hold for `value` (each thumb's bounds come
 * from `reference`, the values it is rendered against). Used to compare a DOM read with the shown
 * value: jsdom does not sanitise a range's value, browsers do, and a consumer's off-grid value is
 * rendered as given and sanitised by the DOM.
 */
export function sanitize(
  values: readonly number[],
  reference: readonly number[],
  min: number,
  max: number,
  step: number,
  gap: number,
): readonly number[] {
  return values.map((value, index) => {
    const { lower, upper } = thumbBounds(reference, index, min, max, gap);
    // The native step base is the input's own `min` attribute (the neighbour-adjusted bound).
    return snap(value, lower, Math.max(lower, upper), step);
  });
}

/** Position of `value` in `[min, max]`, in percent, clamped to `0`–`100`. */
export function percent(value: number, min: number, max: number): number {
  return clamp(percentage(value, min, max), 0, 100);
}

/**
 * The thumb a track press at `target` moves: the nearest by value. On a tie (two thumbs at one
 * value, or equidistant thumbs) the thumb that can move toward the pointer: the later one when
 * the pointer is above it, else the earlier one.
 */
export function nearestThumb(values: readonly number[], target: number): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  values.forEach((value, index) => {
    const distance = Math.abs(value - target);
    if (distance < bestDistance - EPSILON) {
      best = index;
      bestDistance = distance;
    } else if (Math.abs(distance - bestDistance) <= EPSILON && target > value) {
      best = index;
    }
  });
  return best;
}

/** The platform's default value: the midpoint, snapped to the grid; `min` when `max < min`. */
export function platformDefault(min: number, max: number, step: number): number {
  if (!(max > min)) return min;
  return snap(min + (max - min) / 2, min, max, step);
}

/** Element-wise equality of two value arrays (within floating-point tolerance). */
export function equalValues(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => {
    const other = b[index] as number;
    return value === other || Math.abs(value - other) < EPSILON * Math.max(1, Math.abs(value));
  });
}

/** The part of `DOMRect` a pointer position is mapped through. */
export interface TrackRect {
  readonly left: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The value under a pointer at `(clientX, clientY)` on a track occupying `rect` (design 4.1):
 * left to right (right to left with `rtl`), or bottom to top when vertical, clamped to the track
 * and mapped linearly onto `[min, max]`. Not snapped. An empty track maps to `min` (`max` in RTL).
 */
export function pointerValue(
  rect: TrackRect,
  clientX: number,
  clientY: number,
  orientation: Orientation,
  rtl: boolean,
  min: number,
  max: number,
): number {
  let fraction: number;
  if (orientation === "vertical") {
    fraction = rect.height > 0 ? (rect.bottom - clientY) / rect.height : 0;
  } else {
    fraction = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    if (rtl) fraction = 1 - fraction;
  }
  fraction = Math.min(1, Math.max(0, fraction));
  return min + fraction * (max - min);
}

/** Stacked thumbs: the thumbs `first`..`last` all hold the value `at`. */
export interface TiedThumbs {
  readonly first: number;
  readonly last: number;
  readonly at: number;
}

/** The run of thumbs sharing thumb `index`'s value, or `null` when it shares it with none. */
export function tiedRange(values: readonly number[], index: number): TiedThumbs | null {
  const at = values[index];
  if (at === undefined) return null;
  let first = index;
  let last = index;
  while (first > 0 && equalValues([values[first - 1] as number], [at])) first -= 1;
  while (last < values.length - 1 && equalValues([values[last + 1] as number], [at])) last += 1;
  return first !== last ? { first, last, at } : null;
}

/**
 * Which of the stacked thumbs a pointer at `raw` moves: the one that can go toward it (the last
 * above the shared value, the first below). `null` exactly on the value (or with no tie).
 */
export function resolveTie(tied: TiedThumbs | null, raw: number): number | null {
  if (tied === null) return null;
  if (raw > tied.at) return tied.last;
  if (raw < tied.at) return tied.first;
  return null;
}

/**
 * The Root's geometry custom properties (design 3.1): `--slider-start` (the first thumb with
 * several, else `0%`), `--slider-end` (the last thumb) and `--slider-value-<i>`, in percent.
 */
export function sliderGeometry(
  shown: readonly number[],
  min: number,
  max: number,
): Record<string, string> {
  const count = shown.length;
  const percents = shown.map((v) => percent(v, min, max));
  const geometry: Record<string, string> = {
    "--slider-start": count > 1 ? `${percents[0] ?? 0}%` : "0%",
    "--slider-end": `${percents[count - 1] ?? 0}%`,
  };
  percents.forEach((p, index) => {
    geometry[`--slider-value-${index}`] = `${p}%`;
  });
  return geometry;
}

/** A Slider value as an array, one entry per thumb. */
export function toArray(value: number | readonly number[]): readonly number[] {
  return typeof value === "number" ? [value] : value;
}

/** The shape of a Slider value (fixed at mount, design 3.1). */
export function shapeOf(
  value: number | readonly number[] | undefined,
): "number" | "array" | undefined {
  if (value === undefined) return undefined;
  return typeof value === "number" ? "number" : "array";
}

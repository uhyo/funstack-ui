// Stepping arithmetic of NumberField (design/components/number-field.md 5.5). No directive: no
// React, no client-only API. The spec's `stepUp(n)` / `stepDown(n)` (snap off-grid values in the
// stepping direction, clamp into `[min, max]` on the grid), not the native UI stepping.
import { EPSILON, gridDecimals, roundTo } from "../internal/decimal.js";

export interface StepBounds {
  readonly min: number | undefined;
  readonly max: number | undefined;
  /** Positive. */
  readonly step: number;
}

function decimalsFor(bounds: StepBounds): number {
  return gridDecimals(bounds.step, bounds.min ?? 0);
}

/** The largest grid point `≤ max` (an unreachable `max` stays unreachable: `0..5` by `2` is `4`). */
function gridMax(max: number, base: number, step: number): number {
  return base + Math.floor((max - base) / step + EPSILON) * step;
}

function clampAndGuard(
  result: number,
  current: number | null,
  direction: number,
  bounds: StepBounds,
): number {
  const { min, max, step } = bounds;
  const base = min ?? 0;
  let next = result;
  if (max !== undefined && next > max + EPSILON) next = gridMax(max, base, step);
  if (min !== undefined && next < min - EPSILON) next = min;
  next = roundTo(next, decimalsFor(bounds));
  // 4. A step that would move against its direction changes nothing (an empty value has no
  // direction to keep: empty + ArrowDown with `min 3` is `3`, design 5.5).
  if (current !== null) {
    if (direction > 0 && next < current) return current;
    if (direction < 0 && next > current) return current;
  }
  return next;
}

/**
 * `current` stepped `n` times (`n > 0` up, `n < 0` down): empty counts as `0`; the step base is
 * `min` (else `0`); an off-grid value snaps to the nearest grid point in the stepping direction,
 * which counts as one step; the result is clamped to `[min, max]` on the grid and rounded to the
 * decimals of `step` and `min`. When the clamp would move the value against the direction, the
 * value is returned unchanged.
 */
export function stepValue(current: number | null, n: number, bounds: StepBounds): number {
  const { min, step } = bounds;
  const value = current ?? 0;
  const base = min ?? 0;
  const index = (value - base) / step;
  const nearest = Math.round(index);
  let target: number;
  if (Math.abs(index - nearest) <= EPSILON * Math.max(1, Math.abs(index))) {
    target = nearest + n;
  } else if (n > 0) {
    target = Math.ceil(index) + (n - 1);
  } else {
    target = Math.floor(index) + (n + 1);
  }
  return clampAndGuard(base + target * step, current, n, bounds);
}

/**
 * `current` moved by `delta` (PageUp / PageDown, Shift+Arrow: `± largeStep`). A whole number of
 * steps is `stepValue(current, delta / step)`; otherwise the value moves by `delta` and snaps to
 * the grid toward the start (never past `delta`), at least one step.
 */
export function stepBy(current: number | null, delta: number, bounds: StepBounds): number {
  const { min, step } = bounds;
  const ratio = delta / step;
  if (Math.abs(ratio - Math.round(ratio)) <= EPSILON * Math.max(1, Math.abs(ratio))) {
    return stepValue(current, Math.round(ratio), bounds);
  }
  const value = current ?? 0;
  const base = min ?? 0;
  const index = (value + delta - base) / step;
  let target = delta > 0 ? Math.floor(index + EPSILON) : Math.ceil(index - EPSILON);
  const start = (value - base) / step;
  if (delta > 0 && target <= start + EPSILON) target = Math.floor(start + EPSILON) + 1;
  if (delta < 0 && target >= start - EPSILON) target = Math.ceil(start - EPSILON) - 1;
  return clampAndGuard(base + target * step, current, delta, bounds);
}

/** The bound a Home / End key moves to: `min`, or the largest grid point `≤ max`. */
export function boundValue(which: "min" | "max", bounds: StepBounds): number | undefined {
  const { min, max, step } = bounds;
  if (which === "min") return min;
  if (max === undefined) return undefined;
  if (min !== undefined && max < min) return min;
  return roundTo(gridMax(max, min ?? 0, step), decimalsFor(bounds));
}

/** The next step in `direction` would change nothing (a button at its bound). Empty never is. */
export function isAtBound(value: number | null, direction: 1 | -1, bounds: StepBounds): boolean {
  if (value === null) return false;
  return stepValue(value, direction, bounds) === value;
}

/**
 * The step a key makes (design 4.2) from the value it steps from: ArrowUp / ArrowDown one step
 * (with Shift `± largeStep`), PageUp / PageDown `± largeStep`, Home / End the bound
 * (`boundValue`; nothing without one, and nothing with Shift, which selects text). `null`: the key
 * is not a NumberField key.
 */
export function keyStep(
  key: string,
  shiftKey: boolean,
  bounds: StepBounds,
  largeStep: number,
): ((base: number | null) => number | null) | null {
  switch (key) {
    case "ArrowUp":
      return shiftKey ? (v) => stepBy(v, largeStep, bounds) : (v) => stepValue(v, 1, bounds);
    case "ArrowDown":
      return shiftKey ? (v) => stepBy(v, -largeStep, bounds) : (v) => stepValue(v, -1, bounds);
    case "PageUp":
      return (v) => stepBy(v, largeStep, bounds);
    case "PageDown":
      return (v) => stepBy(v, -largeStep, bounds);
    case "Home":
    case "End": {
      if (shiftKey) return null;
      const target = boundValue(key === "Home" ? "min" : "max", bounds);
      return target === undefined ? null : () => target;
    }
    default:
      return null;
  }
}

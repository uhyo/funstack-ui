// Decimal helpers shared by Slider and NumberField (design/components/number-field.md 5.4). No
// directive: no React, no client-only API.

/** Number of decimal places of `n` as written (`0.1` → 1, `1e-7` → 7, `5` → 0). */
export function decimalsOf(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const text = String(n);
  const exponent = /e-(\d+)$/i.exec(text);
  if (exponent !== null) {
    const mantissa = text.slice(0, exponent.index);
    const dot = mantissa.indexOf(".");
    return Number(exponent[1]) + (dot === -1 ? 0 : mantissa.length - dot - 1);
  }
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

/** Tolerance for grid computations on binary floating point (`0.3 / 0.1` is `2.9999999999999996`). */
export const EPSILON = 1e-9;

/** The decimal places a grid of `step` from `min` needs: the larger of the two. */
export function gridDecimals(step: number, min: number): number {
  return Math.max(decimalsOf(step), decimalsOf(min));
}

/**
 * `value` rounded to `decimals` places through `toFixed` (decimal, not binary, rounding of the
 * written digits: `roundTo(0.1 + 0.2, 1)` is `0.3`). `-0` becomes `0`.
 */
export function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return value;
  // `toFixed` takes at most 100 digits; anything near that is already exact.
  const result = decimals <= 0 ? Math.round(value) : Number(value.toFixed(Math.min(decimals, 100)));
  return result === 0 ? 0 : result;
}

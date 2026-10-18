// No "use client": pure functions (design/components/progress.md 2.4).
import { clamp } from "../internal/range-value.js";

export type MeterRegion = "optimum" | "suboptimum" | "even-less-good";

export interface MeterBounds {
  readonly low: number;
  readonly high: number;
  readonly optimum: number;
}

function given(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value);
}

/**
 * HTML's defaults and clamping for `<meter>`, in order: `low` (default `min`) to `[min, max]`,
 * `high` (default `max`) to `[low, max]`, `optimum` (default the midpoint) to `[min, max]`. A
 * non-finite boundary is treated as absent, as the platform's attribute parser does.
 */
export function resolveMeterBounds(
  min: number,
  max: number,
  low: number | undefined,
  high: number | undefined,
  optimum: number | undefined,
): MeterBounds {
  const resolvedLow = clamp(given(low) ? low : min, min, max);
  const resolvedHigh = clamp(given(high) ? high : max, resolvedLow, max);
  const resolvedOptimum = clamp(given(optimum) ? optimum : (min + max) / 2, min, max);
  return { low: resolvedLow, high: resolvedHigh, optimum: resolvedOptimum };
}

/**
 * The gauge region of a meter, with Chromium's comparison operators
 * (`HTMLMeterElement::GetGaugeRegion`). Expects the clamped value and bounds.
 */
export function meterRegion(
  value: number,
  low: number,
  high: number,
  optimum: number,
): MeterRegion {
  if (optimum < low) {
    // Lower is better.
    if (value <= low) return "optimum";
    if (value <= high) return "suboptimum";
    return "even-less-good";
  }
  if (high < optimum) {
    // Higher is better.
    if (high <= value) return "optimum";
    if (low <= value) return "suboptimum";
    return "even-less-good";
  }
  // The middle is best: never "even-less-good".
  return low <= value && value <= high ? "optimum" : "suboptimum";
}

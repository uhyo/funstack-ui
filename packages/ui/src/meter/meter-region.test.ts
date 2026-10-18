import { describe, expect, it } from "vitest";
import { meterRegion, resolveMeterBounds } from "./meter-region.js";
import type { MeterRegion } from "./meter-region.js";

// design/components/progress.md 2.4, 12.1 "Regions (unit)": every row at and beside each
// boundary. Bounds: low 30, high 70.
type Row = [optimum: number, value: number, region: MeterRegion];

const lowerIsBetter: Row[] = [
  [10, 0, "optimum"],
  [10, 30, "optimum"], // value == low
  [10, 31, "suboptimum"],
  [10, 70, "suboptimum"], // value == high
  [10, 71, "even-less-good"],
  [10, 100, "even-less-good"],
];
const higherIsBetter: Row[] = [
  [90, 100, "optimum"],
  [90, 70, "optimum"], // value == high
  [90, 69, "suboptimum"],
  [90, 30, "suboptimum"], // value == low
  [90, 29, "even-less-good"],
  [90, 0, "even-less-good"],
];
const middleIsBest: Row[] = [
  [50, 30, "optimum"], // value == low
  [50, 70, "optimum"], // value == high
  [50, 50, "optimum"],
  [50, 29, "suboptimum"],
  [50, 71, "suboptimum"],
  [50, 0, "suboptimum"],
  [50, 100, "suboptimum"],
  // optimum on a boundary is still "the middle".
  [30, 0, "suboptimum"],
  [70, 100, "suboptimum"],
];

describe("meterRegion", () => {
  it.each(lowerIsBetter)("optimum %d < low: value %d is %s", (optimum, value, region) => {
    expect(meterRegion(value, 30, 70, optimum)).toBe(region);
  });
  it.each(higherIsBetter)("high < optimum %d: value %d is %s", (optimum, value, region) => {
    expect(meterRegion(value, 30, 70, optimum)).toBe(region);
  });
  it.each(middleIsBest)("low <= optimum %d <= high: value %d is %s", (optimum, value, region) => {
    expect(meterRegion(value, 30, 70, optimum)).toBe(region);
  });

  it("never yields even-less-good when the middle is best", () => {
    for (let optimum = 30; optimum <= 70; optimum += 10) {
      for (let value = 0; value <= 100; value += 5) {
        expect(meterRegion(value, 30, 70, optimum)).not.toBe("even-less-good");
      }
    }
  });
});

describe("resolveMeterBounds", () => {
  it("defaults: low = min, high = max, optimum = midpoint, so every value is optimum", () => {
    const bounds = resolveMeterBounds(0, 10, undefined, undefined, undefined);
    expect(bounds).toEqual({ low: 0, high: 10, optimum: 5 });
    for (let value = 0; value <= 10; value++) {
      expect(meterRegion(value, bounds.low, bounds.high, bounds.optimum)).toBe("optimum");
    }
  });

  it("clamps in order: low to [min, max], high to [low, max], optimum to [min, max]", () => {
    expect(resolveMeterBounds(0, 100, -10, 200, 300)).toEqual({ low: 0, high: 100, optimum: 100 });
    // high < low: high = low.
    expect(resolveMeterBounds(0, 100, 60, 40, 50)).toEqual({ low: 60, high: 60, optimum: 50 });
    expect(resolveMeterBounds(0, 100, 150, undefined, -5)).toEqual({
      low: 100,
      high: 100,
      optimum: 0,
    });
  });

  it("treats a non-finite boundary as absent", () => {
    expect(resolveMeterBounds(0, 10, Number.NaN, Infinity, Number.NaN)).toEqual({
      low: 0,
      high: 10,
      optimum: 5,
    });
  });
});

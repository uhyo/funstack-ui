import { describe, expect, it } from "vitest";
import {
  clamp,
  formatRangeValue,
  fraction,
  getNumberFormat,
  isDegenerate,
  percentage,
} from "./range-value.js";

// design/components/progress.md 2.1, 2.2 (unit rows of 12.1 "Arithmetic" and "Text").
describe("clamp", () => {
  it("clamps like the platform", () => {
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(-5, 0, 100)).toBe(0);
    expect(clamp(40, 0, 100)).toBe(40);
    expect(clamp(2, 0, 1)).toBe(1);
  });
});

describe("percentage", () => {
  it("is 0, 50, 100 and fractional", () => {
    expect(percentage(0, 0, 100)).toBe(0);
    expect(percentage(50, 0, 100)).toBe(50);
    expect(percentage(100, 0, 100)).toBe(100);
    expect(percentage(1, 0, 3)).toBeCloseTo(33.333, 2);
    expect(percentage(15, 10, 20)).toBe(50);
  });

  it("is 0 for a degenerate range", () => {
    expect(isDegenerate(5, 5)).toBe(true);
    expect(isDegenerate(5, 1)).toBe(true);
    expect(isDegenerate(0, 1)).toBe(false);
    expect(percentage(5, 5, 5)).toBe(0);
    expect(fraction(3, 5, 1)).toBe(0);
  });
});

describe("formatRangeValue", () => {
  it("formats the fraction with the default percent style", () => {
    expect(formatRangeValue(40, 0, 100, undefined, "en")).toBe("40%");
    expect(formatRangeValue(2, 0, 8, undefined, "en")).toBe("25%");
  });

  it("formats the fraction for a percent format with options", () => {
    expect(formatRangeValue(1, 0, 3, { style: "percent", maximumFractionDigits: 1 }, "en")).toBe(
      "33.3%",
    );
  });

  it("formats the value for any other style", () => {
    expect(
      formatRangeValue(
        3.2,
        0,
        8,
        { style: "unit", unit: "megabyte", maximumFractionDigits: 1 },
        "en",
      ),
    ).toBe("3.2 MB");
    // A format without `style` is decimal per Intl.
    expect(formatRangeValue(3, 0, 8, {}, "en")).toBe("3");
  });

  it("uses the locale", () => {
    expect(formatRangeValue(40, 0, 100, undefined, "de")).toBe("40 %");
  });
});

describe("getNumberFormat", () => {
  it("returns the same instance for equal inputs", () => {
    const a = getNumberFormat("en", { style: "unit", unit: "gigabyte" });
    const b = getNumberFormat("en", { style: "unit", unit: "gigabyte" });
    expect(a).toBe(b);
    expect(getNumberFormat("en", undefined)).toBe(getNumberFormat("en", undefined));
    expect(getNumberFormat("de", undefined)).not.toBe(getNumberFormat("en", undefined));
  });

  it("is bounded: past 32 entries the oldest is dropped", () => {
    const first = getNumberFormat("en", { minimumFractionDigits: 0 });
    for (let i = 1; i <= 40; i++)
      getNumberFormat("en", { minimumIntegerDigits: (i % 20) + 1, minimumFractionDigits: i % 3 });
    expect(getNumberFormat("en", { minimumFractionDigits: 0 })).not.toBe(first);
  });
});

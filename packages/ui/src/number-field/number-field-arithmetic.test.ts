import { describe, expect, it } from "vitest";
import { keyStep } from "./number-field-arithmetic.js";
import type { StepBounds } from "./number-field-arithmetic.js";

const bounds: StepBounds = { min: 0, max: 95, step: 5 };

function apply(key: string, shiftKey: boolean, base: number | null, b = bounds): number | null {
  const compute = keyStep(key, shiftKey, b, 20);
  if (compute === null) throw new Error(`no step for ${key}`);
  return compute(base);
}

describe("keyStep", () => {
  it("ArrowUp / ArrowDown step once; with Shift by largeStep", () => {
    expect(apply("ArrowUp", false, 10)).toBe(15);
    expect(apply("ArrowDown", false, 10)).toBe(5);
    expect(apply("ArrowUp", true, 10)).toBe(30);
    expect(apply("ArrowDown", true, 30)).toBe(10);
  });

  it("PageUp / PageDown step by largeStep, Shift or not", () => {
    expect(apply("PageUp", false, 10)).toBe(30);
    expect(apply("PageUp", true, 10)).toBe(30);
    expect(apply("PageDown", false, 30)).toBe(10);
  });

  it("Home / End go to the bounds (End: the last grid point)", () => {
    expect(apply("Home", false, 50)).toBe(0);
    expect(apply("End", false, 50)).toBe(95);
    expect(apply("End", false, 50, { min: 0, max: 7, step: 2 })).toBe(6);
  });

  it("Shift+Home / Shift+End and a missing bound make no step", () => {
    expect(keyStep("Home", true, bounds, 20)).toBeNull();
    expect(keyStep("End", true, bounds, 20)).toBeNull();
    const open: StepBounds = { min: undefined, max: undefined, step: 1 };
    expect(keyStep("Home", false, open, 10)).toBeNull();
    expect(keyStep("End", false, open, 10)).toBeNull();
  });

  it("any other key is not a step", () => {
    expect(keyStep("Enter", false, bounds, 20)).toBeNull();
    expect(keyStep("a", false, bounds, 20)).toBeNull();
    expect(keyStep("ArrowLeft", false, bounds, 20)).toBeNull();
  });
});

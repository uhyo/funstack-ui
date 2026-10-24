import { describe, expect, it } from "vitest";
import { pointerValue, resolveTie, sliderGeometry, tiedRange } from "./slider-arithmetic.js";

const rect = { left: 100, bottom: 300, width: 200, height: 100 };

describe("pointerValue", () => {
  it("maps x linearly onto [min, max] on a horizontal track", () => {
    expect(pointerValue(rect, 100, 0, "horizontal", false, 0, 100)).toBe(0);
    expect(pointerValue(rect, 150, 0, "horizontal", false, 0, 100)).toBe(25);
    expect(pointerValue(rect, 300, 0, "horizontal", false, 0, 100)).toBe(100);
  });

  it("mirrors in RTL", () => {
    expect(pointerValue(rect, 150, 0, "horizontal", true, 0, 100)).toBe(75);
  });

  it("maps y bottom to top on a vertical track, ignoring rtl", () => {
    expect(pointerValue(rect, 0, 300, "vertical", false, 10, 20)).toBe(10);
    expect(pointerValue(rect, 0, 250, "vertical", true, 10, 20)).toBe(15);
    expect(pointerValue(rect, 0, 200, "vertical", false, 10, 20)).toBe(20);
  });

  it("clamps outside the track", () => {
    expect(pointerValue(rect, 0, 0, "horizontal", false, 0, 100)).toBe(0);
    expect(pointerValue(rect, 999, 0, "horizontal", false, 0, 100)).toBe(100);
    expect(pointerValue(rect, 0, 999, "vertical", false, 0, 100)).toBe(0);
  });

  it("maps an empty track to min (max in RTL)", () => {
    const empty = { left: 0, bottom: 0, width: 0, height: 0 };
    expect(pointerValue(empty, 5, 5, "horizontal", false, 0, 100)).toBe(0);
    expect(pointerValue(empty, 5, 5, "horizontal", true, 0, 100)).toBe(100);
    expect(pointerValue(empty, 5, 5, "vertical", false, 0, 100)).toBe(0);
  });
});

describe("tiedRange / resolveTie", () => {
  it("finds the run of thumbs sharing a value", () => {
    expect(tiedRange([10, 20, 20, 20, 30], 2)).toEqual({ first: 1, last: 3, at: 20 });
    expect(tiedRange([10, 20, 20, 20, 30], 1)).toEqual({ first: 1, last: 3, at: 20 });
  });

  it("is null for a thumb alone at its value or out of range", () => {
    expect(tiedRange([10, 20, 30], 1)).toBeNull();
    expect(tiedRange([10], 0)).toBeNull();
    expect(tiedRange([10, 20], 5)).toBeNull();
  });

  it("picks the thumb that can move toward the pointer", () => {
    const tied = { first: 1, last: 3, at: 20 };
    expect(resolveTie(tied, 25)).toBe(3);
    expect(resolveTie(tied, 15)).toBe(1);
    expect(resolveTie(tied, 20)).toBeNull();
    expect(resolveTie(null, 25)).toBeNull();
  });
});

describe("sliderGeometry", () => {
  it("starts at 0% with one thumb", () => {
    expect(sliderGeometry([25], 0, 100)).toEqual({
      "--slider-start": "0%",
      "--slider-end": "25%",
      "--slider-value-0": "25%",
    });
  });

  it("spans the first to the last thumb with several, clamped to 0-100", () => {
    expect(sliderGeometry([-10, 50, 120], 0, 100)).toEqual({
      "--slider-start": "0%",
      "--slider-end": "100%",
      "--slider-value-0": "0%",
      "--slider-value-1": "50%",
      "--slider-value-2": "100%",
    });
    expect(sliderGeometry([20, 60], 0, 200)).toEqual({
      "--slider-start": "10%",
      "--slider-end": "30%",
      "--slider-value-0": "10%",
      "--slider-value-1": "30%",
    });
  });
});

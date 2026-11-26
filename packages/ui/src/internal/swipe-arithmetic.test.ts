// The swipe arithmetic (design/components/drawer.md 4.1): slop and axis, offset, velocity and
// the release decision. Pure functions.
import { describe, expect, it } from "vitest";
import {
  classifyPress,
  releaseOutcome,
  releaseVelocity,
  swipeOffset,
  swipeProgress,
  swipeTranslation,
  towardEdge,
} from "./swipe-arithmetic.js";

describe("towardEdge", () => {
  it("projects a movement on the direction, positive toward the edge", () => {
    expect(towardEdge(3, 40, "down")).toBe(40);
    expect(towardEdge(3, 40, "up")).toBe(-40);
    expect(towardEdge(-25, 2, "left")).toBe(25);
    expect(towardEdge(-25, 2, "right")).toBe(-25);
  });
});

describe("classifyPress", () => {
  it("waits within the 6 px slop", () => {
    expect(classifyPress(0, 5, "down")).toBe("wait");
    expect(classifyPress(3, 4.9, "down")).toBe("wait");
  });

  it("starts past the slop when the move is along the axis and toward the edge", () => {
    expect(classifyPress(0, 6, "down")).toBe("start");
    expect(classifyPress(2, 7, "down")).toBe("start");
    expect(classifyPress(0, -6, "up")).toBe("start");
    expect(classifyPress(-8, 1, "left")).toBe("start");
    expect(classifyPress(8, -1, "right")).toBe("start");
  });

  it("drops a first move away from the edge or across the axis", () => {
    expect(classifyPress(0, -6, "down")).toBe("drop");
    expect(classifyPress(7, 2, "down")).toBe("drop");
    // Exactly diagonal is not "more along the axis than across".
    expect(classifyPress(5, 5, "down")).toBe("drop");
    expect(classifyPress(8, 0, "left")).toBe("drop");
  });
});

describe("offset, translation, progress", () => {
  it("never writes an offset below 0 (no overdrag)", () => {
    expect(swipeOffset(-12)).toBe(0);
    expect(swipeOffset(30)).toBe(30);
  });

  it("turns the offset into a physical vector", () => {
    expect(swipeTranslation(120, "down")).toEqual([0, 120]);
    expect(swipeTranslation(80, "left")).toEqual([-80, 0]);
    expect(swipeTranslation(10, "up")).toEqual([0, -10]);
    expect(swipeTranslation(10, "right")).toEqual([10, 0]);
    // No `-0px`.
    expect(Object.is(swipeTranslation(10, "left")[1], 0)).toBe(true);
    expect(Object.is(swipeTranslation(0, "up")[1], 0)).toBe(true);
  });

  it("is a clamped fraction of the extent", () => {
    expect(swipeProgress(50, 200)).toBe(0.25);
    expect(swipeProgress(300, 200)).toBe(1);
    expect(swipeProgress(10, 0)).toBe(0);
  });
});

describe("releaseVelocity", () => {
  it("is measured from the oldest sample within 100 ms of the last one", () => {
    const samples = [
      { time: 0, toward: 0 },
      { time: 50, toward: 10 },
      { time: 150, toward: 60 },
      { time: 200, toward: 110 },
    ];
    // From t=150 (the 100 ms window starts at 100) to t=200: 50 px / 50 ms.
    expect(releaseVelocity(samples)).toBe(1);
  });

  it("is negative for a pointer moving back", () => {
    expect(
      releaseVelocity([
        { time: 0, toward: 100 },
        { time: 40, toward: 80 },
      ]),
    ).toBe(-0.5);
  });

  it("is 0 for one sample, no samples, or a pointer held still for the window", () => {
    expect(releaseVelocity([])).toBe(0);
    expect(releaseVelocity([{ time: 5, toward: 30 }])).toBe(0);
    expect(
      releaseVelocity([
        { time: 0, toward: 0 },
        { time: 10, toward: 80 },
        { time: 300, toward: 80 },
      ]),
    ).toBe(0);
  });
});

describe("releaseOutcome", () => {
  it("dismisses at 25% of the extent", () => {
    expect(releaseOutcome(50, 200, 0)).toBe("dismiss");
    expect(releaseOutcome(49.9, 200, 0)).toBe("return");
  });

  it("dismisses a flick of 0.5 px/ms toward the edge, however short", () => {
    expect(releaseOutcome(10, 200, 0.5)).toBe("dismiss");
    expect(releaseOutcome(10, 200, 0.49)).toBe("return");
  });

  it("returns when the pointer was moving back faster than 0.1 px/ms, however far", () => {
    expect(releaseOutcome(180, 200, -0.11)).toBe("return");
    expect(releaseOutcome(180, 200, -0.1)).toBe("dismiss");
  });

  it("never dismisses by distance with an empty extent", () => {
    expect(releaseOutcome(10, 0, 0)).toBe("return");
  });
});

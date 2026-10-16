import { afterEach, describe, expect, it, vi } from "vitest";
import { createActionDetails } from "./action-details.js";

interface Fields {
  reason: string;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createActionDetails", () => {
  it("serves `event` as a virtual, non-own property", () => {
    const event = new Event("click");
    const details = createActionDetails(event, { reason: "click" });
    expect(details.event).toBe(event);
    expect("event" in details).toBe(true);
    expect(details.reason).toBe("click");
    expect(Object.hasOwn(details, "event")).toBe(false);
    expect(Object.keys(details)).toEqual(["reason"]);
    expect({ ...details }).toEqual({ reason: "click" });
    expect(JSON.stringify(details)).toBe('{"reason":"click"}');
  });

  it("serves `undefined` for programmatic changes", () => {
    const details = createActionDetails(undefined, {});
    expect(details.event).toBeUndefined();
    expect("event" in details).toBe(true);
  });

  describe("rejects writes to `event`", () => {
    it("throws on assignment in development", () => {
      const details = createActionDetails(new Event("click"), {}) as { event: unknown };
      expect(() => {
        details.event = "x";
      }).toThrow(TypeError);
      expect(() => Reflect.set(details, "event", "x")).toThrow(TypeError);
      expect(Object.keys(details)).toEqual([]);
      expect(details.event).toBeInstanceOf(Event);
    });

    it("throws on defineProperty in development", () => {
      const details = createActionDetails(new Event("click"), {});
      expect(() => Object.defineProperty(details, "event", { value: "x" })).toThrow(TypeError);
      expect(() =>
        Reflect.defineProperty(details, "event", { value: "x", configurable: true }),
      ).toThrow(TypeError);
      expect(Object.keys(details)).toEqual([]);
      expect(details.event).toBeInstanceOf(Event);
    });

    it("ignores an assignment and declines a defineProperty in production", () => {
      vi.stubEnv("NODE_ENV", "production");
      const event = new Event("click");
      const details = createActionDetails(event, {}) as { event: unknown };
      expect(() => {
        details.event = "x";
      }).not.toThrow();
      expect(Reflect.set(details, "event", "x")).toBe(true);
      expect(Reflect.defineProperty(details, "event", { value: "x", configurable: true })).toBe(
        false,
      );
      expect(() => Object.defineProperty(details, "event", { value: "x" })).toThrow(TypeError);
      expect(details.event).toBe(event);
      expect(Object.keys(details)).toEqual([]);
      expect(JSON.stringify(details)).toBe("{}");
    });
  });

  it("still lets real fields be written and defined", () => {
    const details = createActionDetails(undefined, { reason: "click" }) as Fields & {
      extra?: number;
    };
    details.reason = "keyboard";
    Object.defineProperty(details, "extra", { value: 1, enumerable: true, configurable: true });
    expect(details.reason).toBe("keyboard");
    expect(details.extra).toBe(1);
    expect(Object.keys(details)).toEqual(["reason", "extra"]);
  });
});

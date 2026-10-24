// jsdom has no layout: `getComputedStyle(popup).positionArea` is not even a known property, so
// the resolved-placement hook (conventions 13.2) always falls back to the requested values. This
// stub makes `getComputedStyle` report a chosen `position-area` / `direction` / `writing-mode`
// for one element, as an engine would after applying a `position-try-fallbacks` option, so the
// jsdom rows can drive the hook with the shim's `toggle` event. Everything else is jsdom's.
import { vi } from "vitest";
import type { MockInstance } from "vitest";

export interface StubbedStyle {
  positionArea?: string;
  direction?: string;
  writingMode?: string;
}

export interface PlacementStub {
  /** Replaces the values reported for the element from now on. */
  set(values: StubbedStyle): void;
  /** Calls of `getComputedStyle` for the stubbed element so far. */
  calls(): number;
  readonly spy: MockInstance<typeof getComputedStyle>;
}

/**
 * Stubs `getComputedStyle` for the element `target()` returns (looked up on each call, so the
 * element may mount later). Restored after each test (vitest.setup.ts restores every spy).
 */
export function stubComputedPlacement(
  target: () => Element | null,
  initial: StubbedStyle = {},
): PlacementStub {
  let values = initial;
  let count = 0;
  const original = globalThis.getComputedStyle.bind(globalThis);
  const spy = vi
    .spyOn(globalThis, "getComputedStyle")
    .mockImplementation((element: Element, pseudo?: string | null) => {
      const style = original(element, pseudo);
      if (element !== target()) return style;
      count++;
      const current = values;
      return new Proxy(style, {
        get(object, key) {
          if (typeof key === "string" && key in current) {
            return current[key as keyof StubbedStyle];
          }
          const value = Reflect.get(object, key, object) as unknown;
          return typeof value === "function" ? value.bind(object) : value;
        },
      });
    });
  return {
    set(next) {
      values = next;
    },
    calls: () => count,
    spy,
  };
}

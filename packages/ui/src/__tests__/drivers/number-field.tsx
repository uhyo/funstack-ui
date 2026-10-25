// NumberField as seen by the commit-action suite (commit-action-suite.tsx), and the jsdom helpers
// its test file shares: typing, blur, keys and button presses.
import { act, fireEvent, screen } from "@testing-library/react";
import { expect } from "vitest";
import { NumberField } from "../../number-field/index.js";
import type {
  NumberFieldRootProps,
  NumberFieldValueChangeDetails,
} from "../../number-field/index.js";
import type { CommitActionDriver } from "../commit-action-suite.js";

export const root = () => screen.getByTestId("root");
export const input = () => screen.getByTestId("input") as HTMLInputElement;
export const hidden = () => input().nextElementSibling as HTMLInputElement;
export const inc = () => screen.getByTestId("inc");
export const dec = () => screen.getByTestId("dec");

/** Types `text` into the visible input as the browser would (one `input` event). */
export function typeText(text: string): void {
  act(() => {
    fireEvent.change(input(), { target: { value: text } });
  });
}

export function blur(): void {
  act(() => {
    fireEvent.blur(input());
  });
}

export function key(k: string, init: KeyboardEventInit = {}, target: Element = input()): boolean {
  let result = true;
  act(() => {
    result = fireEvent.keyDown(target, { key: k, bubbles: true, cancelable: true, ...init });
  });
  return result;
}

export function pointer(
  type: "pointerDown" | "pointerUp" | "pointerCancel",
  element: Element,
  init: { pointerId?: number; button?: number; isPrimary?: boolean } = {},
): boolean {
  let result = true;
  act(() => {
    result = fireEvent[type](element, {
      pointerId: init.pointerId ?? 1,
      button: init.button ?? 0,
      isPrimary: init.isPrimary ?? true,
      bubbles: true,
      cancelable: true,
    });
  });
  return result;
}

/** A press and a release on a button: one step, one commit. */
export function press(button: Element): void {
  pointer("pointerDown", button);
  pointer("pointerUp", button);
}

export function Parts() {
  return (
    <>
      <NumberField.Label data-testid="label">Quantity</NumberField.Label>
      <NumberField.Decrement data-testid="dec">−</NumberField.Decrement>
      <NumberField.Input data-testid="input" />
      <NumberField.Increment data-testid="inc">+</NumberField.Increment>
    </>
  );
}

const format = (v: number | null) => (v === null ? "" : new Intl.NumberFormat("en-US").format(v));

/**
 * An en-US field from 1000 (so the text is grouped, "1,000"): gesture 0 presses the Increment,
 * gestures 1 and 2 are ArrowUp, gesture 3 types "9" and blurs.
 */
export const numberFieldDriver: CommitActionDriver<
  number | null,
  NumberFieldValueChangeDetails,
  NumberFieldValueChangeDetails,
  NumberFieldRootProps
> = {
  name: "NumberField",
  render: (props, rootProps) => (
    <NumberField.Root data-testid="root" locale="en-US" {...props} {...rootProps}>
      <Parts />
    </NumberField.Root>
  ),
  values: [1000, 1001, 1002, 1003, 9],
  gesture: (i) => {
    if (i === 0) {
      press(inc());
    } else if (i < 3) {
      key("ArrowUp");
    } else {
      typeText("9");
      expect(input().value).toBe("9");
      blur();
    }
  },
  pointerGesture: {
    down: async () => {
      await act(async () => {
        fireEvent.pointerDown(inc(), { pointerId: 1, button: 0, isPrimary: true });
      });
    },
    up: async () => {
      await act(async () => {
        fireEvent.pointerUp(inc(), { pointerId: 1 });
      });
    },
  },
  expectShown: (v) => {
    expect(input().value).toBe(format(v));
    expect(hidden().value).toBe(v === null ? "" : String(v));
  },
  readShown: () => input().value,
  format,
  readDefault: () => input().defaultValue,
  pendingOn: (i) => (i === 0 ? [root(), input(), inc()] : [root(), input()]),
  sourceKey: "source",
  setPlatformValue: (container, v) => {
    (container.querySelector('input[type="text"]') as HTMLInputElement).value = format(v);
  },
  openDraft: () => typeText("8"),
};

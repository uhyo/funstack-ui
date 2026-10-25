// Slider as seen by the commit-action suite (commit-action-suite.tsx), and the jsdom helpers its
// test file shares: a key press through the native value setter, a mocked Track, pointer events.
import { act, fireEvent, screen } from "@testing-library/react";
import { expect, vi } from "vitest";
import { Slider } from "../../slider/index.js";
import type {
  SliderRootProps,
  SliderValueChangeDetails,
  SliderValueCommitDetails,
} from "../../slider/index.js";
import type { CommitActionDriver } from "../commit-action-suite.js";

export type SliderTestValue = number | readonly number[];

const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;

/** Sets an input's value through the native setter, as the browser's stepping does. */
export function setNativeValue(input: HTMLInputElement, value: string): void {
  valueSetter.call(input, value);
}

/** One key press as the browser delivers it: the value changes, `input`, then `change`. */
export function press(input: HTMLInputElement, value: number): void {
  act(() => {
    valueSetter.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

const RECT = { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0 };

export function mockTrack(track: HTMLElement = screen.getByTestId("track")): HTMLElement {
  vi.spyOn(track, "getBoundingClientRect").mockReturnValue({
    ...RECT,
    toJSON: () => RECT,
  } as DOMRect);
  return track;
}

export function pointer(
  type: "pointerDown" | "pointerMove" | "pointerUp" | "pointerCancel",
  element: Element,
  x: number,
  init: { pointerId?: number; y?: number; button?: number } = {},
): boolean {
  let result = true;
  act(() => {
    result = fireEvent[type](element, {
      pointerId: init.pointerId ?? 1,
      button: init.button ?? 0,
      clientX: x,
      clientY: init.y ?? 50,
      bubbles: true,
      cancelable: true,
    });
  });
  return result;
}

/** A pointer event for `dispatchEvent` inside an awaited `act` (Testing Library's is sync). */
export function rawPointer(type: string, x: number, y = 50): PointerEvent {
  return new PointerEvent(type, {
    pointerId: 1,
    button: 0,
    clientX: x,
    clientY: y,
    bubbles: true,
    cancelable: true,
  });
}

export const thumbInput = (index = 0) =>
  screen.getByTestId(`thumb-${index}`).querySelector("input") as HTMLInputElement;
export const thumb = (index = 0) => screen.getByTestId(`thumb-${index}`);
export const root = () => screen.getByTestId("root");

export function Parts({ count, thumbs = true }: { count: number; thumbs?: boolean }) {
  return (
    <>
      <Slider.Label data-testid="label">Volume</Slider.Label>
      <Slider.Value data-testid="value">{(s) => s.values.join(",")}</Slider.Value>
      <Slider.Track data-testid="track">
        <Slider.Indicator data-testid="indicator" />
        {thumbs &&
          Array.from({ length: count }, (_, i) => (
            <Slider.Thumb
              key={i}
              index={i}
              data-testid={`thumb-${i}`}
              aria-label={count > 1 ? `Thumb ${i}` : undefined}
            />
          ))}
      </Slider.Track>
    </>
  );
}

const values = [40, 41, 42, 43, 70] as const;

/** One thumb on a 0-100 track; gesture `i` is a key press to `values[i + 1]`. */
export const sliderDriver: CommitActionDriver<
  SliderTestValue,
  SliderValueChangeDetails,
  SliderValueCommitDetails,
  SliderRootProps<SliderTestValue>
> = {
  name: "Slider",
  render: (props, rootProps) => {
    const shown = props.value ?? props.defaultValue ?? 0;
    return (
      <Slider.Root data-testid="root" {...props} {...rootProps}>
        <Parts count={typeof shown === "number" ? 1 : shown.length} />
      </Slider.Root>
    );
  },
  values,
  gesture: (i) => press(thumbInput(), values[i + 1]!),
  pointerGesture: {
    down: async () => {
      const track = mockTrack();
      await act(async () => {
        track.dispatchEvent(rawPointer("pointerdown", values[1]));
      });
    },
    up: async () => {
      await act(async () => {
        screen.getByTestId("track").dispatchEvent(rawPointer("pointerup", values[1]));
      });
    },
  },
  expectShown: (v) => {
    expect(thumbInput().value).toBe(String(v));
    expect(thumb().style.getPropertyValue("--slider-value")).toBe(`${String(v)}%`);
    expect(screen.getByTestId("value").textContent).toBe(String(v));
  },
  readShown: () => thumbInput().value,
  format: String,
  readDefault: () => thumbInput().defaultValue,
  pendingOn: () => [root(), thumb()],
  sourceKey: "thumb",
  setPlatformValue: (container, v) => {
    (container.querySelector("input") as HTMLInputElement).value = String(v);
  },
};

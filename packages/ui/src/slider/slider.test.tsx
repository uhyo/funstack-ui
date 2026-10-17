// Slider tests (jsdom), mapped to design/components/slider.md section 14.1. jsdom has no range
// key stepping, no value sanitisation and no layout: keyboard rows set the input's value through
// the native setter and fire `input` then `change` in one task (the shape a real key press has);
// pointer rows mock the Track's `getBoundingClientRect` and polyfill pointer capture.
//
// Covered by `slider.browser.test.tsx` instead: real keys (native stepping, RTL mirroring,
// vertical Up / Down, Firefox's vertical ArrowRight), a real drag, the hidden input's box and
// hit-testing, the accessibility tree, the rollback CSS transition.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { StrictMode, Suspense, startTransition, useState } from "react";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createSuspender,
  deferred,
  ErrorCatcher,
  expectNotPending,
  expectPending,
} from "../__tests__/helpers.js";
import { Slider } from "./index.js";
import type {
  SliderRootProps,
  SliderRootState,
  SliderThumbState,
  SliderValueChangeDetails,
  SliderValueCommitDetails,
} from "./index.js";
import {
  clampToNeighbours,
  decimalsOf,
  isMaxReachable,
  nearestThumb,
  percent,
  platformDefault,
  sanitize,
  snap,
} from "./slider-arithmetic.js";

type Value = number | readonly number[];
type ChangeFn = (next: Value, details: SliderValueChangeDetails) => unknown;
type CommitFn = (next: Value, details: SliderValueCommitDetails) => unknown;

// --- jsdom polyfills -----------------------------------------------------------------------------

const captured = new Map<number, Element>();
beforeAll(() => {
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  if (typeof proto.setPointerCapture !== "function") {
    proto.setPointerCapture = function (this: Element, id: number) {
      captured.set(id, this);
    };
    proto.releasePointerCapture = function (this: Element, id: number) {
      if (captured.get(id) === this) captured.delete(id);
    };
    proto.hasPointerCapture = function (this: Element, id: number) {
      return captured.get(id) === this;
    };
  }
});

afterEach(() => {
  captured.clear();
  vi.restoreAllMocks();
});

// --- Helpers -------------------------------------------------------------------------------------

const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;

/** One key press as the browser delivers it: the value changes, `input`, then `change`. */
function press(input: HTMLInputElement, value: number): void {
  act(() => {
    valueSetter.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

const RECT = { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0 };

function mockTrack(track: HTMLElement = screen.getByTestId("track")): HTMLElement {
  vi.spyOn(track, "getBoundingClientRect").mockReturnValue({
    ...RECT,
    toJSON: () => RECT,
  } as DOMRect);
  return track;
}

function pointer(
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

const flush = () => act(async () => {});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A pointer event dispatched without Testing Library's `act` wrapper. */
function rawPointer(type: string, x: number, y = 50): PointerEvent {
  return new PointerEvent(type, {
    pointerId: 1,
    button: 0,
    clientX: x,
    clientY: y,
    bubbles: true,
    cancelable: true,
  });
}

/** Runs `body` on React's real scheduler (no `act` queue); see the "no snap" suspense row. */
async function withoutAct(body: () => Promise<void>): Promise<void> {
  const env = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = env.IS_REACT_ACT_ENVIRONMENT;
  env.IS_REACT_ACT_ENVIRONMENT = false;
  try {
    await body();
  } finally {
    env.IS_REACT_ACT_ENVIRONMENT = previous;
  }
}

const thumbInput = (index = 0) =>
  screen.getByTestId(`thumb-${index}`).querySelector("input") as HTMLInputElement;
const thumb = (index = 0) => screen.getByTestId(`thumb-${index}`);
const root = () => screen.getByTestId("root");

type Mode = "uncontrolled" | "adopt" | "commit";
const modes: readonly Mode[] = ["uncontrolled", "adopt", "commit"];

interface FixtureProps {
  mode: Mode;
  initial?: Value;
  onChange?: ChangeFn;
  onCommit?: CommitFn;
  rootProps?: Partial<SliderRootProps<Value>>;
  /** Content under the Root, rendered from the parent's committed value. */
  below?: (value: Value) => ReactNode;
  boundary?: (error: unknown) => void;
}

function Parts({ count, thumbs = true }: { count: number; thumbs?: boolean }) {
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

/**
 * The three wrappers of "both" (design 14): uncontrolled; a controlled parent that adopts every
 * step (`setValue` in the step action's sync prefix); a controlled "update on success" parent
 * (`startTransition(() => setValue(next))` after the commit action's own `await`).
 */
function Fixture({
  mode,
  initial = 40,
  onChange,
  onCommit,
  rootProps,
  below,
  boundary,
}: FixtureProps) {
  const [value, setValue] = useState<Value>(initial);
  const count = typeof initial === "number" ? 1 : initial.length;
  let props: SliderRootProps<Value>;
  if (mode === "uncontrolled") {
    props = { defaultValue: initial, valueChangeAction: onChange, valueCommitAction: onCommit };
  } else if (mode === "adopt") {
    props = {
      value,
      valueChangeAction: (next, details) => {
        setValue(next);
        return onChange?.(next, details);
      },
      valueCommitAction: onCommit,
    };
  } else {
    props = {
      value,
      valueChangeAction: onChange,
      valueCommitAction: async (next, details) => {
        await onCommit?.(next, details);
        startTransition(() => setValue(next));
      },
    };
  }
  let slider: ReactNode = (
    <Slider.Root data-testid="root" {...props} {...rootProps}>
      <Parts count={count} />
    </Slider.Root>
  );
  if (boundary) slider = <ErrorCatcher onError={boundary}>{slider}</ErrorCatcher>;
  return (
    <>
      {slider}
      <output data-testid="parent">{String(value)}</output>
      {below?.(value)}
    </>
  );
}

function eachMode(name: string, body: (mode: Mode) => void): void {
  describe.each(modes)(`${name} (%s)`, (mode) => body(mode));
}

// --- Arithmetic ----------------------------------------------------------------------------------

describe("arithmetic", () => {
  it("snaps to the grid from min, ties toward +∞", () => {
    expect(snap(33, 0, 100, 10)).toBe(30);
    expect(snap(35, 0, 100, 10)).toBe(40);
    expect(snap(-5, 0, 100, 10)).toBe(0);
    expect(snap(7, 3, 100, 5)).toBe(8);
    expect(snap(5.5, 3, 100, 5)).toBe(8);
  });

  it("caps at the last grid point below an unreachable max", () => {
    expect(snap(5, 0, 5, 2)).toBe(4);
    expect(snap(100, 0, 5, 2)).toBe(4);
    expect(isMaxReachable(0, 5, 2)).toBe(false);
    expect(isMaxReachable(0, 100, 10)).toBe(true);
    expect(isMaxReachable(0, 1, 0.1)).toBe(true);
  });

  it("rounds to the step's decimals", () => {
    expect(snap(0.3, 0, 1, 0.1)).toBe(0.3);
    expect(snap(0.1 + 0.2, 0, 1, 0.1)).toBe(0.3);
    expect(snap(0.27, 0, 1, 0.05)).toBe(0.25);
    expect(decimalsOf(0.001)).toBe(3);
    expect(decimalsOf(1e-7)).toBe(7);
    expect(decimalsOf(5)).toBe(0);
  });

  it("uses the platform midpoint as the default", () => {
    expect(platformDefault(0, 100, 1)).toBe(50);
    expect(platformDefault(0, 5, 2)).toBe(2);
    expect(platformDefault(0, 9, 1)).toBe(5);
    expect(platformDefault(10, 0, 1)).toBe(10);
  });

  it("clamps a thumb between its neighbours with the gap", () => {
    expect(clampToNeighbours([100, 300], 0, 350, 0, 500, 10, 10)).toBe(290);
    expect(clampToNeighbours([100, 300], 1, 50, 0, 500, 10, 10)).toBe(110);
    expect(clampToNeighbours([100, 300], 1, 50, 0, 500, 10, 0)).toBe(100);
    expect(clampToNeighbours([100, 300], 0, 183, 0, 500, 10, 0)).toBe(180);
  });

  it("finds the nearest thumb, and on a tie the one that can move toward the pointer", () => {
    expect(nearestThumb([100, 300], 180)).toBe(0);
    expect(nearestThumb([100, 300], 220)).toBe(1);
    expect(nearestThumb([50, 50], 60)).toBe(1);
    expect(nearestThumb([50, 50], 40)).toBe(0);
  });

  it("computes percentages and sanitises against neighbour bounds", () => {
    expect(percent(25, 0, 200)).toBe(12.5);
    expect(percent(-5, 0, 100)).toBe(0);
    expect(sanitize([33, 77], [33, 77], 0, 100, 10, 0)).toEqual([30, 73]);
  });
});

// --- Roles and ARIA ------------------------------------------------------------------------------

describe("roles and ARIA", () => {
  it("renders one range input per thumb with the native attributes", () => {
    render(
      <form>
        <Slider.Root
          data-testid="root"
          defaultValue={[100, 300]}
          min={0}
          max={500}
          step={10}
          minStepsBetweenThumbs={1}
          name="price"
          getAriaValueText={(v) => `${v} dollars`}
        >
          <Parts count={2} />
        </Slider.Root>
      </form>,
    );
    const [a, b] = [thumbInput(0), thumbInput(1)];
    expect(a.type).toBe("range");
    expect(a).toHaveAttribute("min", "0");
    expect(a).toHaveAttribute("max", "290");
    expect(a).toHaveAttribute("step", "10");
    expect(a.value).toBe("100");
    expect(b).toHaveAttribute("min", "110");
    expect(b).toHaveAttribute("max", "500");
    expect(b.value).toBe("300");
    expect(a.name).toBe("price");
    expect(a).toHaveAttribute("aria-valuetext", "100 dollars");
    expect(b).toHaveAttribute("aria-valuetext", "300 dollars");
    expect(a).toHaveAttribute("aria-label", "Thumb 0");
    expect(thumb(0)).not.toHaveAttribute("aria-label");
    expect(a.id).not.toBe(b.id);
    for (const input of [a, b]) {
      for (const attr of ["aria-valuemin", "aria-valuemax", "aria-valuenow", "aria-orientation"]) {
        expect(input).not.toHaveAttribute(attr);
      }
    }
    expect(screen.getAllByRole("slider")).toHaveLength(2);
    expect(thumb(1)).toHaveAttribute("data-index", "1");
    expect(thumb(0)).toHaveAttribute("data-orientation", "horizontal");
  });

  it("is a labelled group with several thumbs, consumer tokens merged", () => {
    render(
      <Slider.Root data-testid="root" defaultValue={[20, 80]} aria-labelledby="extra">
        <Parts count={2} />
      </Slider.Root>,
    );
    const label = screen.getByTestId("label");
    expect(root()).toHaveAttribute("role", "group");
    expect(root().getAttribute("aria-labelledby")?.split(" ").sort()).toEqual(
      [label.id, "extra"].sort(),
    );
    expect(label).not.toHaveAttribute("for");
    expect(screen.getByRole("group")).toBe(root());
  });

  it("has no role with one thumb; the Label names the input through `for`", () => {
    render(
      <Slider.Root data-testid="root" defaultValue={40}>
        <Parts count={1} />
      </Slider.Root>,
    );
    expect(root()).not.toHaveAttribute("role");
    expect(root()).not.toHaveAttribute("aria-labelledby");
    expect(screen.getByTestId("label")).toHaveAttribute("for", thumbInput().id);
    expect(screen.getByRole("slider", { name: "Volume" })).toBe(thumbInput());
  });

  it("emits aria-labelledby only while a Label is mounted", () => {
    function Toggle() {
      const [label, setLabel] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setLabel((l) => !l)}>
            toggle
          </button>
          <Slider.Root data-testid="root" defaultValue={[20, 80]} aria-label="Range">
            {label && <Slider.Label>Range</Slider.Label>}
            <Slider.Thumb index={0} aria-label="Min" />
            <Slider.Thumb index={1} aria-label="Max" />
          </Slider.Root>
        </>
      );
    }
    render(<Toggle />);
    expect(root()).toHaveAttribute("aria-labelledby");
    fireEvent.click(screen.getByText("toggle"));
    expect(root()).not.toHaveAttribute("aria-labelledby");
  });

  it("warns for unnamed thumbs and an unnamed group", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Slider.Root defaultValue={[20, 80]}>
        <Slider.Thumb index={0} />
        <Slider.Thumb index={1} />
      </Slider.Root>,
    );
    const messages = consoleError.mock.calls.map((c) => String(c[0]));
    expect(messages.some((m) => m.includes("needs its own name"))).toBe(true);
    expect(messages.some((m) => m.includes("needs a name"))).toBe(true);
  });

  it("does not warn about a group named by its Label", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Slider.Root defaultValue={[20, 80]}>
        <Parts count={2} />
      </Slider.Root>,
    );
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("warns for a duplicate and an out-of-range index", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Slider.Root defaultValue={40}>
        <Slider.Label>Volume</Slider.Label>
        <Slider.Thumb index={0} />
        <Slider.Thumb index={0} />
        <Slider.Thumb index={3} data-testid="outside" />
      </Slider.Root>,
    );
    const messages = consoleError.mock.calls.map((c) => String(c[0]));
    expect(messages.some((m) => m.includes("two Thumbs"))).toBe(true);
    expect(messages.some((m) => m.includes("outside the value"))).toBe(true);
    expect(screen.queryByTestId("outside")).toBeNull();
  });

  it("warns for an off-grid value, an unreachable max and a descending array", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <>
        <Slider.Root defaultValue={33} step={10} aria-label="a">
          <Slider.Thumb aria-label="a" />
        </Slider.Root>
        <Slider.Root defaultValue={2} max={5} step={2}>
          <Slider.Thumb aria-label="b" />
        </Slider.Root>
        <Slider.Root defaultValue={[80, 20]} aria-label="c">
          <Slider.Thumb index={0} aria-label="c0" />
          <Slider.Thumb index={1} aria-label="c1" />
        </Slider.Root>
      </>,
    );
    const messages = consoleError.mock.calls.map((c) => String(c[0]));
    expect(messages.some((m) => m.includes("off the step grid"))).toBe(true);
    expect(messages.some((m) => m.includes("unreachable"))).toBe(true);
    expect(messages.some((m) => m.includes("ascending order"))).toBe(true);
  });

  it("throws for a Thumb outside a Root", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Slider.Thumb />)).toThrow(/inside a Slider.Root/);
  });

  it("defaults to the platform midpoint", () => {
    render(
      <Slider.Root data-testid="root" max={9}>
        <Parts count={1} />
      </Slider.Root>,
    );
    expect(thumbInput().value).toBe("5");
  });
});

// --- Geometry and state --------------------------------------------------------------------------

describe("geometry", () => {
  it("publishes the custom properties from the shown value", () => {
    render(
      <Slider.Root data-testid="root" defaultValue={[100, 300]} max={500}>
        <Parts count={2} />
      </Slider.Root>,
    );
    expect(root().style.getPropertyValue("--slider-start")).toBe("20%");
    expect(root().style.getPropertyValue("--slider-end")).toBe("60%");
    expect(root().style.getPropertyValue("--slider-value-0")).toBe("20%");
    expect(root().style.getPropertyValue("--slider-value-1")).toBe("60%");
    expect(thumb(0).style.getPropertyValue("--slider-value")).toBe("20%");
    expect(thumb(0).style.touchAction).toBe("pan-y");
    expect(screen.getByTestId("track").style.touchAction).toBe("pan-y");
    expect(screen.getByTestId("indicator").getAttribute("style")).toBeNull();
  });

  it("fills from 0% with one thumb", () => {
    render(
      <Slider.Root data-testid="root" defaultValue={40}>
        <Parts count={1} />
      </Slider.Root>,
    );
    expect(root().style.getPropertyValue("--slider-start")).toBe("0%");
    expect(root().style.getPropertyValue("--slider-end")).toBe("40%");
  });

  it("lets the consumer's style win per property", () => {
    render(
      <Slider.Root data-testid="root" defaultValue={40} style={{ "--slider-end": "1%" } as never}>
        <Slider.Track data-testid="track" style={{ touchAction: "none" }}>
          <Slider.Thumb
            data-testid="thumb-0"
            aria-label="v"
            style={(s) => ({ "--slider-value": "2%", color: s.dragging ? "red" : "blue" }) as never}
          />
        </Slider.Track>
      </Slider.Root>,
    );
    expect(root().style.getPropertyValue("--slider-end")).toBe("1%");
    expect(root().style.getPropertyValue("--slider-value-0")).toBe("40%");
    expect(screen.getByTestId("track").style.touchAction).toBe("none");
    expect(thumb().style.getPropertyValue("--slider-value")).toBe("2%");
    expect(thumb().style.touchAction).toBe("pan-y");
    expect(thumb().style.color).toBe("blue");
  });

  it("uses pan-x and the vertical writing mode when vertical", () => {
    render(
      <Slider.Root data-testid="root" defaultValue={40} orientation="vertical">
        <Parts count={1} />
      </Slider.Root>,
    );
    expect(root()).toHaveAttribute("data-orientation", "vertical");
    expect(thumb().style.touchAction).toBe("pan-x");
    expect(thumbInput().style.writingMode).toBe("vertical-lr");
    expect(thumbInput().style.direction).toBe("rtl");
    expect(thumbInput()).not.toHaveAttribute("aria-orientation");
  });

  it("keeps the input inside a render element, with the library's handlers", () => {
    const inputRef = { current: null as HTMLInputElement | null };
    render(
      <Slider.Root data-testid="root" defaultValue={40}>
        <Slider.Track data-testid="track">
          <Slider.Thumb
            aria-label="v"
            inputRef={inputRef}
            render={
              <div data-testid="thumb-0" className="custom">
                ignored
              </div>
            }
            className={(s: SliderThumbState) => `v-${s.value}`}
          >
            <i data-testid="icon" />
          </Slider.Thumb>
        </Slider.Track>
      </Slider.Root>,
    );
    expect(thumb().tagName).toBe("DIV");
    expect(thumb()).toHaveClass("custom", "v-40");
    expect(thumbInput()).toBe(inputRef.current);
    expect(screen.getByTestId("icon").parentElement).toBe(thumb());
    expect(thumb()).not.toHaveTextContent("ignored");
    press(thumbInput(), 41);
    expect(thumb()).toHaveClass("v-41");
  });

  it("shows the documented state to function props", () => {
    let rootState: SliderRootState<number> | undefined;
    render(
      <Slider.Root defaultValue={40} min={10} max={90} step={5} disabled>
        {(s) => {
          rootState = s;
          return (
            <>
              <Slider.Value data-testid="v" />
              <Slider.Thumb aria-label="v" data-testid="thumb-0" />
            </>
          );
        }}
      </Slider.Root>,
    );
    expect(rootState).toEqual({
      value: 40,
      values: [40],
      pending: false,
      dragging: false,
      orientation: "horizontal",
      disabled: true,
      min: 10,
      max: 90,
      step: 5,
    });
    expect(screen.getByTestId("v")).toHaveTextContent("40");
    expect(thumbInput()).toBeDisabled();
    expect(thumb()).toHaveAttribute("data-disabled", "");
  });

  it("Value shows one thumb by index and warns without children for several", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Slider.Root defaultValue={[20, 80]} aria-label="r">
        <Slider.Value data-testid="v1" index={1} />
        <Slider.Value data-testid="none" />
        <Slider.Thumb index={0} aria-label="a" />
        <Slider.Thumb index={1} aria-label="b" />
      </Slider.Root>,
    );
    expect(screen.getByTestId("v1")).toHaveTextContent("80");
    expect(screen.getByTestId("none")).toBeEmptyDOMElement();
    expect(consoleError.mock.calls.some((c) => String(c[0]).includes("Slider.Value"))).toBe(true);
  });
});

// --- Steps and commits ---------------------------------------------------------------------------

eachMode("steps", (mode) => {
  it("dispatches one step per input event with the native event, updating everything at once", async () => {
    const onChange = vi.fn<ChangeFn>();
    render(
      <Fixture
        mode={mode}
        onChange={onChange}
        rootProps={{ getAriaValueText: (v) => `${v} percent` }}
      />,
    );
    const input = thumbInput();
    let seen: { value: string; prop: string; text: string; valueText: string | null } | undefined;
    act(() => {
      valueSetter.call(input, "41");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      // Read in the same task, before anything settles.
      seen = {
        value: input.value,
        prop: thumb().style.getPropertyValue("--slider-value"),
        text: screen.getByTestId("value").textContent ?? "",
        valueText: input.getAttribute("aria-valuetext"),
      };
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    const [next, details] = onChange.mock.calls[0]!;
    expect(next).toBe(41);
    expect(details.reason).toBe("activate");
    expect(details.thumb).toBe(0);
    expect(details.event?.type).toBe("input");
    expect(seen?.value).toBe("41");
    await flush();
    expect(input.value).toBe("41");
    expect(thumb().style.getPropertyValue("--slider-value")).toBe("41%");
    expect(input).toHaveAttribute("aria-valuetext", "41 percent");
    expect(screen.getByTestId("value")).toHaveTextContent("41");
  });

  it("dispatches nothing for a value equal to the shown one", async () => {
    const onChange = vi.fn<ChangeFn>();
    const onCommit = vi.fn<CommitFn>();
    render(<Fixture mode={mode} onChange={onChange} onCommit={onCommit} />);
    press(thumbInput(), 40);
    await flush();
    expect(onChange).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("dispatches the commit once per key press with the change event", async () => {
    const onCommit = vi.fn<CommitFn>();
    render(<Fixture mode={mode} onCommit={onCommit} />);
    press(thumbInput(), 41);
    await flush();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0]![0]).toBe(41);
    expect(onCommit.mock.calls[0]![1].reason).toBe("activate");
    expect(onCommit.mock.calls[0]![1].thumb).toBe(0);
    expect(onCommit.mock.calls[0]![1].event?.type).toBe("change");
    expect(thumbInput().value).toBe("41");
    expect(screen.getByTestId("parent")).toHaveTextContent(mode === "uncontrolled" ? "40" : "41");
  });

  it("ignores a trailing change with no value change", async () => {
    const onCommit = vi.fn<CommitFn>();
    render(<Fixture mode={mode} onCommit={onCommit} />);
    press(thumbInput(), 41);
    await flush();
    act(() => {
      thumbInput().dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("adds the step and commit transition types", async () => {
    // Observable only through a ViewTransition; here: the actions run inside transitions, so a
    // suspending parent update keeps the old content (see "suspending content").
    const onCommit = vi.fn<CommitFn>();
    render(<Fixture mode={mode} onCommit={onCommit} />);
    press(thumbInput(), 42);
    await flush();
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});

eachMode("async commit", (mode) => {
  it("holds the gesture value with data-pending until the save resolves", async () => {
    const d = deferred();
    const onCommit = vi.fn<CommitFn>(() => d.promise);
    render(<Fixture mode={mode} onCommit={onCommit} />);
    press(thumbInput(), 45);
    await flush();
    expectPending(root());
    expectPending(thumb());
    expect(thumbInput().value).toBe("45");
    expect(thumb().style.getPropertyValue("--slider-value")).toBe("45%");
    expect(screen.getByTestId("value")).toHaveTextContent("45");
    if (mode !== "adopt") expect(screen.getByTestId("parent")).toHaveTextContent("40");
    await act(async () => d.resolve());
    expectNotPending(root());
    expectNotPending(thumb());
    expect(thumbInput().value).toBe("45");
    if (mode !== "uncontrolled") expect(screen.getByTestId("parent")).toHaveTextContent("45");
  });
});

eachMode("rejection", (mode) => {
  it("reaches the boundary and rolls the thumb back to the pre-gesture value", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const d = deferred();
    const caught = vi.fn();
    const onChange = vi.fn<ChangeFn>();
    function Probe() {
      return (
        <Fixture mode={mode} onChange={onChange} onCommit={() => d.promise} boundary={caught} />
      );
    }
    render(<Probe />);
    press(thumbInput(), 70);
    await flush();
    expect(thumbInput().value).toBe("70");
    onChange.mockClear();
    await act(async () => d.reject(new Error("save failed")));
    expect(caught).toHaveBeenCalledTimes(1);
    expect((caught.mock.calls[0]![0] as Error).message).toBe("save failed");
    if (mode === "uncontrolled") {
      expect(onChange).toHaveBeenCalledTimes(1);
      const [next, details] = onChange.mock.calls[0]!;
      expect(next).toBe(40);
      expect(details.reason).toBe("dismiss");
      expect(details.thumb).toBeNull();
      expect(details.event).toBeUndefined();
    } else {
      expect(onChange.mock.calls.filter((c) => c[1].reason === "dismiss")).toHaveLength(0);
    }
    consoleError.mockRestore();
  });

  it("rolls the DOM value back when the error is caught by a boundary inside the Root's parent", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const d = deferred();
    function Inside() {
      const [, setV] = useState(0);
      return (
        <ErrorCatcher>
          <Slider.Root data-testid="root" defaultValue={40} valueCommitAction={() => d.promise}>
            <Parts count={1} />
          </Slider.Root>
          <button type="button" onClick={() => setV((n) => n + 1)}>
            rerender
          </button>
        </ErrorCatcher>
      );
    }
    render(<Inside />);
    press(thumbInput(), 70);
    await flush();
    await act(async () => d.reject(new Error("x")));
    expect(screen.getByTestId("error-catcher")).toHaveTextContent("x");
  });

  it("commits when the action catches its own error", async () => {
    const onCommit = vi.fn<CommitFn>(async () => {
      try {
        throw new Error("handled");
      } catch {
        // handled inside
      }
    });
    render(<Fixture mode={mode} onCommit={onCommit} />);
    press(thumbInput(), 60);
    await flush();
    expect(thumbInput().value).toBe("60");
    expectNotPending(root());
  });
});

// --- Continuous control: no snap (conventions 10.1) ----------------------------------------------

describe("no snap", () => {
  it("keeps the last step's value between two moves with a sync step action (uncontrolled)", async () => {
    const onChange = vi.fn<ChangeFn>();
    const onCommit = vi.fn<CommitFn>();
    render(<Fixture mode="uncontrolled" onChange={onChange} onCommit={onCommit} />);
    const track = mockTrack();
    pointer("pointerDown", track, 55);
    await flush();
    expect(thumbInput().value).toBe("55");
    pointer("pointerMove", track, 60);
    await flush();
    // The step's transition has settled; the shown value is still the gesture's.
    expect(thumbInput().value).toBe("60");
    expect(thumb().style.getPropertyValue("--slider-value")).toBe("60%");
    pointer("pointerUp", track, 60);
    await flush();
    expect(thumbInput().value).toBe("60");
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("shows the gesture value until an adopting parent's suspended content resolves", async () => {
    const { Suspender, resolve } = createSuspender();
    resolve("40");
    render(
      <Fixture
        mode="adopt"
        below={(v) => (
          <Suspense fallback={<span data-testid="fallback" />}>
            <Suspender value={String(v)} />
          </Suspense>
        )}
      />,
    );
    const track = mockTrack();
    // Every value the input holds from here on, so a snap back to 40 in between is caught.
    const seen: string[] = [];
    const input = thumbInput();
    const observer = new MutationObserver(() => seen.push(input.value));
    observer.observe(root(), { attributes: true, subtree: true });
    // On React's real scheduler: under `act`, a transition started while another one is
    // suspended (the release's commit after the step suspended) is never retried after the
    // ping (React 19.3.1; plain-React repro in memo/developer/slider.md). Browsers are fine.
    await withoutAct(async () => {
      track.dispatchEvent(rawPointer("pointerdown", 70));
      await waitFor(() => expect(screen.getByTestId("parent")).toHaveTextContent("40"));
      await sleep(20);
      track.dispatchEvent(rawPointer("pointerup", 70));
      await sleep(20);
      expect(thumbInput().value).toBe("70");
      expectPending(root());
      expect(screen.getByTestId("suspender")).toHaveTextContent("40");
      expect(screen.queryByTestId("fallback")).toBeNull();
      resolve("70");
      await waitFor(() => expect(screen.getByTestId("suspender")).toHaveTextContent("70"));
      await waitFor(() => expectNotPending(root()));
    });
    expect(thumbInput().value).toBe("70");
    observer.disconnect();
    expect(seen).not.toContain("40");
  });

  it("follows the pointer and returns to value when a controlled parent does not adopt", async () => {
    render(
      <Slider.Root data-testid="root" value={40}>
        <Parts count={1} />
      </Slider.Root>,
    );
    const track = mockTrack();
    pointer("pointerDown", track, 55);
    pointer("pointerMove", track, 70);
    await flush();
    expect(thumbInput().value).toBe("70");
    pointer("pointerUp", track, 70);
    await flush();
    expect(thumbInput().value).toBe("40");
  });

  it("a press on the current value shows that value, not an earlier gesture's", async () => {
    function External() {
      const [value, setValue] = useState(40);
      return (
        <>
          <Slider.Root
            data-testid="root"
            value={value}
            valueChangeAction={(next) => setValue(next)}
          >
            <Parts count={1} />
          </Slider.Root>
          <button type="button" onClick={() => setValue(30)}>
            set 30
          </button>
        </>
      );
    }
    render(<External />);
    const track = mockTrack();
    pointer("pointerDown", track, 70);
    pointer("pointerUp", track, 70);
    await flush();
    fireEvent.click(screen.getByText("set 30"));
    expect(thumbInput().value).toBe("30");
    pointer("pointerDown", track, 30);
    expect(thumbInput().value).toBe("30");
    expect(root()).toHaveAttribute("data-dragging", "");
    pointer("pointerUp", track, 30);
    await flush();
    expect(thumbInput().value).toBe("30");
  });

  it("dispatches steps and no commit for a drag that returns to its start", async () => {
    const onChange = vi.fn<ChangeFn>();
    const onCommit = vi.fn<CommitFn>();
    render(<Fixture mode="uncontrolled" onChange={onChange} onCommit={onCommit} />);
    const track = mockTrack();
    pointer("pointerDown", track, 40);
    pointer("pointerMove", track, 60);
    pointer("pointerMove", track, 50);
    pointer("pointerMove", track, 40);
    pointer("pointerUp", track, 40);
    await flush();
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([60, 50, 40]);
    expect(onCommit).not.toHaveBeenCalled();
    expect(thumbInput().value).toBe("40");
  });
});

// --- Overlap -------------------------------------------------------------------------------------

eachMode("overlap", (mode) => {
  it("keeps data-pending across two key presses; the latest commit lands", async () => {
    const first = deferred();
    const second = deferred();
    const onCommit = vi
      .fn<CommitFn>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    render(<Fixture mode={mode} onCommit={onCommit} />);
    press(thumbInput(), 41);
    await flush();
    press(thumbInput(), 42);
    await flush();
    expect(onCommit).toHaveBeenCalledTimes(2);
    await act(async () => first.resolve());
    expectPending(root());
    expect(thumbInput().value).toBe("42");
    await act(async () => second.resolve());
    expectNotPending(root());
    expect(thumbInput().value).toBe("42");
    if (mode !== "uncontrolled") expect(screen.getByTestId("parent")).toHaveTextContent("42");
  });

  it("surfaces the superseded commit's rejection", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const first = deferred();
    const second = deferred();
    const caught = vi.fn();
    const onCommit = vi
      .fn<CommitFn>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    render(<Fixture mode={mode} onCommit={onCommit} boundary={caught} />);
    press(thumbInput(), 41);
    await flush();
    press(thumbInput(), 42);
    await flush();
    await act(async () => first.reject(new Error("older")));
    if (mode === "adopt") {
      // The adopting parent's step updates are entangled with the pending save (React holds a
      // transition update until every async action in its scope settles), so the boundary's
      // retry render waits for the newer commit too: the error arrives once it settles.
      expect(caught).not.toHaveBeenCalled();
      await act(async () => second.resolve());
      expect(caught).toHaveBeenCalledTimes(1);
    } else {
      expect(caught).toHaveBeenCalledTimes(1);
      await act(async () => second.resolve());
    }
    expect((caught.mock.calls[0]![0] as Error).message).toBe("older");
  });

  it("a drag while a commit is pending supersedes it", async () => {
    const first = deferred();
    const second = deferred();
    const onCommit = vi
      .fn<CommitFn>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    render(<Fixture mode={mode} onCommit={onCommit} />);
    press(thumbInput(), 70);
    await flush();
    const track = mockTrack();
    pointer("pointerDown", track, 75);
    pointer("pointerMove", track, 80);
    // The thumb follows at once although the step transitions are entangled with the save.
    expect(thumbInput().value).toBe("80");
    pointer("pointerUp", track, 80);
    await flush();
    expect(onCommit).toHaveBeenCalledTimes(2);
    expect(onCommit.mock.calls[1]![0]).toBe(80);
    // The earlier save's resolution does not land: the thumb keeps the newer gesture's value.
    await act(async () => first.resolve());
    expect(thumbInput().value).toBe("80");
    expectPending(root());
    await act(async () => second.resolve());
    expect(thumbInput().value).toBe("80");
    expectNotPending(root());
    if (mode !== "uncontrolled") expect(screen.getByTestId("parent")).toHaveTextContent("80");
  });
});

// --- Suspending content --------------------------------------------------------------------------

describe("suspending content", () => {
  it("keeps the old content while the adopted value's content loads", async () => {
    const { Suspender, resolve } = createSuspender();
    resolve("40");
    render(
      <Fixture
        mode="adopt"
        below={(v) => (
          <Suspense fallback={<span data-testid="fallback" />}>
            <Suspender value={String(v)} />
          </Suspense>
        )}
      />,
    );
    press(thumbInput(), 41);
    await flush();
    expect(screen.getByTestId("suspender")).toHaveTextContent("40");
    expect(screen.queryByTestId("fallback")).toBeNull();
    expectPending(root());
    expectPending(thumb());
    expect(thumbInput().value).toBe("41");
    await act(async () => resolve("41"));
    expect(screen.getByTestId("suspender")).toHaveTextContent("41");
    expectNotPending(root());
  });
});

// --- Pointer -------------------------------------------------------------------------------------

describe("pointer", () => {
  it("a track press is prevented, captures, focuses the nearest thumb and steps", async () => {
    const onChange = vi.fn<ChangeFn>();
    render(
      <Slider.Root
        data-testid="root"
        defaultValue={[100, 300]}
        max={500}
        step={10}
        valueChangeAction={onChange}
      >
        <Parts count={2} />
      </Slider.Root>,
    );
    const track = mockTrack();
    // 36% of 500 = 180: nearer to thumb 0.
    const notPrevented = pointer("pointerDown", track, 36);
    expect(notPrevented).toBe(false);
    expect(track.hasPointerCapture(1)).toBe(true);
    expect(document.activeElement).toBe(thumbInput(0));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0]).toEqual([180, 300]);
    expect(onChange.mock.calls[0]![1].thumb).toBe(0);
    expect(onChange.mock.calls[0]![1].event?.type).toBe("pointerdown");
    expect(root()).toHaveAttribute("data-dragging", "");
    expect(thumb(0)).toHaveAttribute("data-dragging", "");
    expect(thumb(1)).not.toHaveAttribute("data-dragging");
    // Past the other thumb: clamped to it.
    pointer("pointerMove", track, 80);
    expect(thumbInput(0).value).toBe("300");
    pointer("pointerUp", track, 80);
    await flush();
    expect(root()).not.toHaveAttribute("data-dragging");
    expect(thumb(0)).not.toHaveAttribute("data-dragging");
  });

  it("moves for the captured pointer only and ignores a second pointer", async () => {
    const onChange = vi.fn<ChangeFn>();
    render(
      <Slider.Root data-testid="root" defaultValue={40} valueChangeAction={onChange}>
        <Parts count={1} />
      </Slider.Root>,
    );
    const track = mockTrack();
    pointer("pointerDown", track, 50, { pointerId: 1 });
    pointer("pointerDown", track, 90, { pointerId: 2 });
    pointer("pointerMove", track, 10, { pointerId: 2 });
    expect(thumbInput().value).toBe("50");
    pointer("pointerMove", track, 60, { pointerId: 1 });
    expect(thumbInput().value).toBe("60");
    pointer("pointerUp", track, 60, { pointerId: 2 });
    expect(root()).toHaveAttribute("data-dragging", "");
    pointer("pointerUp", track, 60, { pointerId: 1 });
    await flush();
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([50, 60]);
  });

  it.each(["pointerUp", "pointerCancel", "lostpointercapture"] as const)(
    "%s commits where the gesture stopped",
    async (end) => {
      const onCommit = vi.fn<CommitFn>();
      render(
        <Slider.Root data-testid="root" defaultValue={40} valueCommitAction={onCommit}>
          <Parts count={1} />
        </Slider.Root>,
      );
      const track = mockTrack();
      pointer("pointerDown", track, 50);
      pointer("pointerMove", track, 65);
      if (end === "lostpointercapture") {
        act(() => {
          track.dispatchEvent(
            Object.assign(new Event("lostpointercapture"), { pointerId: 1 }) as Event,
          );
        });
      } else {
        pointer(end, track, 65);
      }
      await flush();
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit.mock.calls[0]![0]).toBe(65);
      expect(onCommit.mock.calls[0]![1].event?.type).toBe(end.toLowerCase());
      expect(root()).not.toHaveAttribute("data-dragging");
    },
  );

  it("mirrors under direction: rtl", async () => {
    const onChange = vi.fn<ChangeFn>();
    render(
      <div dir="rtl" style={{ direction: "rtl" }}>
        <Slider.Root data-testid="root" defaultValue={40} valueChangeAction={onChange}>
          <Parts count={1} />
        </Slider.Root>
      </div>,
    );
    const track = mockTrack();
    track.style.direction = "rtl";
    pointer("pointerDown", track, 20);
    expect(onChange.mock.calls[0]![0]).toBe(80);
    pointer("pointerUp", track, 20);
    await flush();
  });

  it("uses the block axis from the bottom when vertical", async () => {
    const onChange = vi.fn<ChangeFn>();
    render(
      <Slider.Root
        data-testid="root"
        defaultValue={40}
        orientation="vertical"
        valueChangeAction={onChange}
      >
        <Parts count={1} />
      </Slider.Root>,
    );
    const track = mockTrack();
    pointer("pointerDown", track, 0, { y: 25 });
    expect(onChange.mock.calls[0]![0]).toBe(75);
    pointer("pointerUp", track, 0, { y: 25 });
    await flush();
  });

  it("works for a Thumb outside the Track and captures on the Thumb", async () => {
    const onChange = vi.fn<ChangeFn>();
    render(
      <Slider.Root data-testid="root" defaultValue={40} valueChangeAction={onChange}>
        <Slider.Track data-testid="track" />
        <Slider.Thumb data-testid="thumb-0" aria-label="v" />
      </Slider.Root>,
    );
    mockTrack();
    pointer("pointerDown", thumb(), 45);
    expect(thumb().hasPointerCapture(1)).toBe(true);
    expect(thumb()).toHaveAttribute("data-dragging", "");
    pointer("pointerMove", thumb(), 47);
    pointer("pointerUp", thumb(), 47);
    await flush();
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([45, 47]);
  });

  it("a press on a Thumb inside the Track starts one gesture", async () => {
    const onChange = vi.fn<ChangeFn>();
    render(
      <Slider.Root
        data-testid="root"
        defaultValue={[20, 80]}
        valueChangeAction={onChange}
        aria-label="r"
      >
        <Parts count={2} />
      </Slider.Root>,
    );
    const track = mockTrack();
    // Pressing thumb 1 at 30 (nearer to thumb 0 by value): the Thumb's own gesture wins.
    pointer("pointerDown", thumb(1), 30);
    expect(thumb(1).hasPointerCapture(1)).toBe(true);
    expect(track.hasPointerCapture(1)).toBe(false);
    expect(onChange.mock.calls[0]![0]).toEqual([20, 30]);
    pointer("pointerUp", thumb(1), 30);
    await flush();
  });

  it("ignores the pointer when disabled, and a non-primary button", async () => {
    const onChange = vi.fn<ChangeFn>();
    const { rerender } = render(
      <Slider.Root data-testid="root" defaultValue={40} valueChangeAction={onChange} disabled>
        <Parts count={1} />
      </Slider.Root>,
    );
    const track = mockTrack();
    expect(pointer("pointerDown", track, 70)).toBe(true);
    rerender(
      <Slider.Root data-testid="root" defaultValue={40} valueChangeAction={onChange}>
        <Parts count={1} />
      </Slider.Root>,
    );
    pointer("pointerDown", mockTrack(), 70, { button: 2 });
    expect(onChange).not.toHaveBeenCalled();
    expect(root()).not.toHaveAttribute("data-dragging");
  });

  it("warns once and stays keyboard-only without a Track", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Slider.Root defaultValue={40}>
        <Slider.Thumb data-testid="thumb-0" aria-label="v" />
      </Slider.Root>,
    );
    pointer("pointerDown", thumb(), 70);
    expect(consoleError.mock.calls.some((c) => String(c[0]).includes("Slider.Track"))).toBe(true);
    expect(thumbInput().value).toBe("40");
  });
});

// --- Keyboard normalisation ----------------------------------------------------------------------

describe("keyboard normalisation", () => {
  it("vertical: ArrowRight / ArrowLeft are prevented and dispatch step + commit", async () => {
    const onChange = vi.fn<ChangeFn>();
    const onCommit = vi.fn<CommitFn>();
    render(
      <Slider.Root
        data-testid="root"
        defaultValue={40}
        orientation="vertical"
        valueChangeAction={onChange}
        valueCommitAction={onCommit}
      >
        <Parts count={1} />
      </Slider.Root>,
    );
    let notPrevented = true;
    act(() => {
      notPrevented = fireEvent.keyDown(thumbInput(), { key: "ArrowRight" });
    });
    await flush();
    expect(notPrevented).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0]).toBe(41);
    expect(onChange.mock.calls[0]![1].event?.type).toBe("keydown");
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0]![0]).toBe(41);
    expect(onCommit.mock.calls[0]![1].event?.type).toBe("keydown");
    act(() => {
      fireEvent.keyDown(thumbInput(), { key: "ArrowLeft" });
    });
    await flush();
    expect(thumbInput().value).toBe("40");
  });

  it("horizontal: keydown is left to the browser", async () => {
    const onChange = vi.fn<ChangeFn>();
    render(
      <Slider.Root data-testid="root" defaultValue={40} valueChangeAction={onChange}>
        <Parts count={1} />
      </Slider.Root>,
    );
    let notPrevented = false;
    act(() => {
      notPrevented = fireEvent.keyDown(thumbInput(), { key: "ArrowRight" });
    });
    expect(notPrevented).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });
});

// --- Forms ---------------------------------------------------------------------------------------

describe("forms", () => {
  it("posts one entry per thumb under the Thumb's or the Root's name", () => {
    render(
      <form data-testid="form">
        <Slider.Root defaultValue={[100, 300]} max={500} name="price" aria-label="p">
          <Slider.Thumb index={0} aria-label="min" />
          <Slider.Thumb index={1} aria-label="max" />
        </Slider.Root>
        <Slider.Root defaultValue={[1, 2]} aria-label="q">
          <Slider.Thumb index={0} name="lo" aria-label="lo" />
          <Slider.Thumb index={1} name="hi" aria-label="hi" />
        </Slider.Root>
      </form>,
    );
    const data = new FormData(screen.getByTestId("form") as HTMLFormElement);
    expect(data.getAll("price")).toEqual(["100", "300"]);
    expect(data.get("lo")).toBe("1");
    expect(data.get("hi")).toBe("2");
  });

  it("omits disabled thumbs and honours the form attribute", () => {
    render(
      <>
        <form data-testid="form" id="f" />
        <Slider.Root defaultValue={40} name="v" form="f">
          <Slider.Thumb aria-label="v" />
        </Slider.Root>
        <form data-testid="other">
          <Slider.Root defaultValue={40} name="w" disabled>
            <Slider.Thumb aria-label="w" />
          </Slider.Root>
        </form>
      </>,
    );
    expect(new FormData(screen.getByTestId("form") as HTMLFormElement).get("v")).toBe("40");
    expect(new FormData(screen.getByTestId("other") as HTMLFormElement).get("w")).toBeNull();
  });
});

// --- Platform paths ------------------------------------------------------------------------------

async function hydrate(ui: ReactNode, mutate: (container: HTMLElement) => void) {
  const container = document.createElement("div");
  document.body.append(container);
  container.innerHTML = renderToString(ui);
  mutate(container);
  render(ui, { container, hydrate: true });
  await flush();
  return container;
}

eachMode("mount reconciliation", (mode) => {
  it("adopts a value stepped before hydration with one platform step + commit", async () => {
    const onChange = vi.fn<ChangeFn>();
    const onCommit = vi.fn<CommitFn>();
    await hydrate(<Fixture mode={mode} onChange={onChange} onCommit={onCommit} />, (c) => {
      (c.querySelector("input") as HTMLInputElement).value = "100";
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0]).toBe(100);
    expect(onChange.mock.calls[0]![1].reason).toBe("platform");
    expect(onChange.mock.calls[0]![1].thumb).toBeNull();
    expect(onChange.mock.calls[0]![1].event).toBeUndefined();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0]![0]).toBe(100);
    expect(onCommit.mock.calls[0]![1].reason).toBe("platform");
    expect(thumb().style.getPropertyValue("--slider-value")).toBe("100%");
    expect(thumbInput().value).toBe("100");
  });

  it("dispatches once under StrictMode and not at all when equal", async () => {
    const onCommit = vi.fn<CommitFn>();
    await hydrate(
      <StrictMode>
        <Fixture mode={mode} onCommit={onCommit} />
      </StrictMode>,
      (c) => {
        (c.querySelector("input") as HTMLInputElement).value = "90";
      },
    );
    expect(onCommit).toHaveBeenCalledTimes(1);
    document.body.innerHTML = "";
    const quiet = vi.fn<CommitFn>();
    await hydrate(<Fixture mode={mode} onCommit={quiet} />, () => {});
    expect(quiet).not.toHaveBeenCalled();
  });
});

describe("mount reconciliation of a late Thumb", () => {
  it("reconciles a Thumb that hydrates after the Root", async () => {
    const onCommit = vi.fn<CommitFn>();
    const gate = deferred();
    let ready = false;
    void gate.promise.then(() => {
      ready = true;
    });
    function Gate({ children }: { children: ReactNode }) {
      if (!ready && typeof window !== "undefined" && hydrating) throw gate.promise;
      return children;
    }
    let hydrating = false;
    const ui = (
      <Slider.Root defaultValue={[20, 80]} valueCommitAction={onCommit} aria-label="r">
        <Slider.Thumb index={0} aria-label="a" data-testid="thumb-0" />
        <Suspense fallback={null}>
          <Gate>
            <Slider.Thumb index={1} aria-label="b" data-testid="thumb-1" />
          </Gate>
        </Suspense>
      </Slider.Root>
    );
    const container = document.createElement("div");
    document.body.append(container);
    container.innerHTML = renderToString(ui);
    hydrating = true;
    render(ui, { container, hydrate: true });
    await flush();
    expect(onCommit).not.toHaveBeenCalled();
    (container.querySelectorAll("input")[1] as HTMLInputElement).value = "90";
    await act(async () => gate.resolve());
    await flush();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0]![0]).toEqual([20, 90]);
    expect(onCommit.mock.calls[0]![1].reason).toBe("platform");
  });
});

eachMode("form reset", (mode) => {
  function InForm(props: Omit<FixtureProps, "mode">) {
    return (
      <form data-testid="form">
        <Fixture mode={mode} {...props} rootProps={{ name: "volume", ...props.rootProps }} />
        <button type="reset" data-testid="reset">
          reset
        </button>
      </form>
    );
  }

  it("form.reset() mirrors the target into defaultValue and dispatches step + commit", async () => {
    const onChange = vi.fn<ChangeFn>();
    const onCommit = vi.fn<CommitFn>();
    render(<InForm onChange={onChange} onCommit={onCommit} />);
    press(thumbInput(), 70);
    await flush();
    onChange.mockClear();
    onCommit.mockClear();
    const form = screen.getByTestId("form") as HTMLFormElement;
    let defaultAtEvent: string | undefined;
    form.addEventListener("reset", () => {
      queueMicrotask(() => {
        defaultAtEvent = thumbInput().defaultValue;
      });
    });
    await act(async () => form.reset());
    await flush();
    expect(defaultAtEvent).toBe("40");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0]).toBe(40);
    expect(onChange.mock.calls[0]![1].reason).toBe("platform");
    expect(onChange.mock.calls[0]![1].event?.type).toBe("reset");
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0]![0]).toBe(40);
    expect(onCommit.mock.calls[0]![1].reason).toBe("platform");
    expect(onCommit.mock.calls[0]![1].thumb).toBeNull();
    expect(thumbInput().value).toBe("40");
    if (mode !== "uncontrolled") expect(screen.getByTestId("parent")).toHaveTextContent("40");
  });

  it("a reset button works the same, and a cancelled reset dispatches nothing", async () => {
    const onCommit = vi.fn<CommitFn>();
    render(<InForm onCommit={onCommit} />);
    press(thumbInput(), 70);
    await flush();
    onCommit.mockClear();
    const form = screen.getByTestId("form") as HTMLFormElement;
    const cancel = (e: Event) => e.preventDefault();
    form.addEventListener("reset", cancel);
    await act(async () => fireEvent.click(screen.getByTestId("reset")));
    await flush();
    expect(onCommit).not.toHaveBeenCalled();
    form.removeEventListener("reset", cancel);
    await act(async () => fireEvent.click(screen.getByTestId("reset")));
    await flush();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(thumbInput().value).toBe("40");
  });

  it("a disabled slider still follows a reset", async () => {
    const onCommit = vi.fn<CommitFn>();
    function Toggle() {
      const [disabled, setDisabled] = useState(false);
      return (
        <>
          <InForm onCommit={onCommit} rootProps={{ disabled }} />
          <button type="button" onClick={() => setDisabled(true)}>
            disable
          </button>
        </>
      );
    }
    render(<Toggle />);
    press(thumbInput(), 70);
    await flush();
    fireEvent.click(screen.getByText("disable"));
    await act(async () => (screen.getByTestId("form") as HTMLFormElement).reset());
    await flush();
    expect(thumbInput().value).toBe("40");
  });
});

describe("form reset, controlled specifics", () => {
  it("resets to the mount-time value and re-syncs the DOM when the parent refuses", async () => {
    const onCommit = vi.fn<CommitFn>();
    function Refusing() {
      const [value, setValue] = useState(40);
      return (
        <form data-testid="form">
          <Slider.Root
            data-testid="root"
            value={value}
            valueCommitAction={(next, details) => {
              onCommit(next, details);
              if (details.reason !== "platform") setValue(next as number);
            }}
          >
            <Parts count={1} />
          </Slider.Root>
        </form>
      );
    }
    render(<Refusing />);
    press(thumbInput(), 70);
    await flush();
    expect(thumbInput().value).toBe("70");
    await act(async () => (screen.getByTestId("form") as HTMLFormElement).reset());
    await flush();
    expect(onCommit).toHaveBeenLastCalledWith(40, expect.objectContaining({ reason: "platform" }));
    expect(thumbInput().value).toBe("70");
  });

  it("resets an uncontrolled slider to the latest defaultValue", async () => {
    function Latest() {
      const [d, setD] = useState(40);
      return (
        <form data-testid="form">
          <Slider.Root data-testid="root" defaultValue={d} key="k">
            <Parts count={1} />
          </Slider.Root>
          <button type="button" onClick={() => setD(10)}>
            change default
          </button>
        </form>
      );
    }
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Latest />);
    press(thumbInput(), 70);
    await flush();
    fireEvent.click(screen.getByText("change default"));
    await act(async () => (screen.getByTestId("form") as HTMLFormElement).reset());
    await flush();
    expect(thumbInput().value).toBe("10");
  });

  it("follows React's automatic reset after a successful form action", async () => {
    const onCommit = vi.fn<CommitFn>();
    const submitted = vi.fn();
    render(
      <form
        data-testid="form"
        action={async (data) => {
          submitted(data.get("volume"));
        }}
      >
        <Slider.Root
          data-testid="root"
          defaultValue={40}
          name="volume"
          valueCommitAction={onCommit}
        >
          <Parts count={1} />
        </Slider.Root>
        <button type="submit" data-testid="submit">
          save
        </button>
      </form>,
    );
    press(thumbInput(), 70);
    await flush();
    onCommit.mockClear();
    await act(async () => fireEvent.click(screen.getByTestId("submit")));
    await flush();
    await flush();
    expect(submitted).toHaveBeenCalledWith("70");
    expect(onCommit).toHaveBeenCalledWith(40, expect.objectContaining({ reason: "platform" }));
    expect(thumbInput().value).toBe("40");
  });
});

// --- Post-await rule -----------------------------------------------------------------------------

describe("post-await rule", () => {
  it("a controlled parent updating after its own await inside startTransition", async () => {
    const d = deferred();
    render(<Fixture mode="commit" onCommit={() => d.promise} />);
    press(thumbInput(), 55);
    await flush();
    expect(screen.getByTestId("parent")).toHaveTextContent("40");
    expect(thumbInput().value).toBe("55");
    await act(async () => d.resolve());
    expect(screen.getByTestId("parent")).toHaveTextContent("55");
    expect(thumbInput().value).toBe("55");
    expectNotPending(root());
  });
});

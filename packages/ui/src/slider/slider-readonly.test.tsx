// `readOnly` on Slider.Root (conventions 3.6.1, design/components/slider.md 9.1): every input
// stays focusable and submitted; the pointer does nothing, the keys that move a range are
// cancelled, a stray native `input` steps nothing and the shown value is written back; each
// input carries `aria-readonly`, every part `data-readonly`. The engines' own stepping is probed
// in slider.browser.test.tsx (P5, P6, P7).
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  mockTrack,
  Parts,
  pointer,
  press,
  root,
  thumb,
  thumbInput,
} from "../__tests__/drivers/slider.js";
import { deferred, hydrateFromServer } from "../__tests__/helpers.js";
import { Field } from "../field/index.js";
import { Slider } from "./index.js";
import type { SliderRootProps, SliderValueChangeDetails } from "./index.js";

type Value = number | readonly number[];
type ChangeFn = (next: Value, details: SliderValueChangeDetails) => unknown;

function ReadOnlySlider(props: Partial<SliderRootProps<Value>>) {
  return (
    <Slider.Root data-testid="root" defaultValue={40} readOnly {...(props as object)}>
      <Parts count={1} />
    </Slider.Root>
  );
}

describe("Slider readOnly (conventions 3.6.1)", () => {
  it("aria-readonly on each input; data-readonly and readOnly in every part's state", () => {
    const rootState = vi.fn(() => "r");
    render(<ReadOnlySlider className={rootState} />);
    expect(thumbInput()).toHaveAttribute("aria-readonly", "true");
    expect(thumbInput()).not.toBeDisabled();
    for (const el of [
      root(),
      thumb(),
      screen.getByTestId("track"),
      screen.getByTestId("indicator"),
      screen.getByTestId("label"),
    ]) {
      expect(el).toHaveAttribute("data-readonly", "");
    }
    expect(rootState).toHaveBeenLastCalledWith(expect.objectContaining({ readOnly: true }));
  });

  it("not read-only: no aria-readonly, no data-readonly", () => {
    render(<ReadOnlySlider readOnly={false} />);
    expect(thumbInput()).not.toHaveAttribute("aria-readonly");
    expect(root()).not.toHaveAttribute("data-readonly");
  });

  it.each(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"])(
    "%s is cancelled (with a modifier too)",
    (key) => {
      render(<ReadOnlySlider />);
      expect(fireEvent.keyDown(thumbInput(), { key })).toBe(false);
      expect(fireEvent.keyDown(thumbInput(), { key, shiftKey: true })).toBe(false);
    },
  );

  it("Tab is not cancelled", () => {
    render(<ReadOnlySlider />);
    expect(fireEvent.keyDown(thumbInput(), { key: "Tab" })).toBe(true);
  });

  it("a stray native input steps nothing, commits nothing, and the shown value is written back", () => {
    const onChange = vi.fn<ChangeFn>();
    const onCommit = vi.fn<ChangeFn>();
    render(<ReadOnlySlider valueChangeAction={onChange} valueCommitAction={onCommit} />);
    press(thumbInput(), 70);
    expect(thumbInput().value).toBe("40");
    expect(onChange).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("a press on the Track or a Thumb does nothing", () => {
    const onChange = vi.fn<ChangeFn>();
    render(<ReadOnlySlider valueChangeAction={onChange} />);
    const track = mockTrack();
    pointer("pointerDown", track, 80);
    pointer("pointerMove", track, 90);
    pointer("pointerUp", track, 90);
    pointer("pointerDown", thumb(), 40);
    pointer("pointerUp", thumb(), 40);
    expect(onChange).not.toHaveBeenCalled();
    expect(root()).not.toHaveAttribute("data-dragging");
    expect(thumbInput().value).toBe("40");
  });

  it("readOnly turned on during a drag: no further step; the release commits where it stopped", () => {
    const onChange = vi.fn<ChangeFn>();
    const onCommit = vi.fn<ChangeFn>();
    function App({ readOnly }: { readOnly: boolean }) {
      return (
        <Slider.Root
          data-testid="root"
          defaultValue={40}
          readOnly={readOnly}
          valueChangeAction={onChange}
          valueCommitAction={onCommit}
        >
          <Parts count={1} />
        </Slider.Root>
      );
    }
    const { rerender } = render(<App readOnly={false} />);
    const track = mockTrack();
    pointer("pointerDown", track, 60);
    expect(onChange.mock.calls.map(([v]) => v)).toEqual([60]);
    act(() => rerender(<App readOnly />));
    pointer("pointerMove", track, 90);
    expect(onChange).toHaveBeenCalledTimes(1);
    pointer("pointerUp", track, 90);
    expect(onCommit.mock.calls.map(([v]) => v)).toEqual([60]);
  });

  it("readOnly turned on while a step is pending cancels nothing", async () => {
    const d = deferred();
    const onChange = vi.fn<ChangeFn>(() => d.promise);
    function App({ readOnly }: { readOnly: boolean }) {
      return (
        <Slider.Root
          data-testid="root"
          defaultValue={40}
          readOnly={readOnly}
          valueChangeAction={onChange}
        >
          <Parts count={1} />
        </Slider.Root>
      );
    }
    const { rerender } = render(<App readOnly={false} />);
    press(thumbInput(), 45);
    expect(root()).toHaveAttribute("data-pending", "");
    rerender(<App readOnly />);
    expect(root()).toHaveAttribute("data-pending", "");
    await act(async () => d.resolve());
    expect(root()).not.toHaveAttribute("data-pending");
    expect(thumbInput().value).toBe("45");
  });

  it("is submitted", () => {
    render(
      <form data-testid="form">
        <ReadOnlySlider name="volume" />
      </form>,
    );
    expect(new FormData(screen.getByTestId("form") as HTMLFormElement).get("volume")).toBe("40");
  });

  it("Field.Root readOnly reaches the inputs and the Field parts", () => {
    render(
      <Field.Root name="volume" readOnly data-testid="field">
        <Field.Label>Volume</Field.Label>
        <Slider.Root data-testid="root" defaultValue={40}>
          <Parts count={1} />
        </Slider.Root>
      </Field.Root>,
    );
    expect(thumbInput()).toHaveAttribute("aria-readonly", "true");
    expect(root()).toHaveAttribute("data-readonly", "");
    expect(screen.getByTestId("field")).toHaveAttribute("data-readonly", "");
  });

  it("disabled wins: the inputs are disabled; state.readOnly stays the prop", () => {
    const rootState = vi.fn(() => "r");
    render(<ReadOnlySlider disabled className={rootState} />);
    expect(thumbInput()).toBeDisabled();
    expect(rootState).toHaveBeenLastCalledWith(
      expect.objectContaining({ readOnly: true, disabled: true }),
    );
  });

  it("a value changed before hydration is written back at mount; nothing dispatched", async () => {
    const onChange = vi.fn<ChangeFn>();
    const onCommit = vi.fn<ChangeFn>();
    await hydrateFromServer(
      <ReadOnlySlider valueChangeAction={onChange} valueCommitAction={onCommit} />,
      {
        mutate: (container) => {
          container.querySelector("input")!.value = "90";
        },
      },
    );
    expect(thumbInput().value).toBe("40");
    expect(onChange).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });
});

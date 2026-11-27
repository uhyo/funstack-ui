// A form reset writes a controlled input's value past react-dom's value tracker, so without a
// sync the first edit back to the pre-reset value is dropped as "no change" (#181 review,
// `internal/form/sync-value-tracker.ts`). The rows for the controls with a rule-6 mirror besides
// TextField and NumberField, whose rows are in their own files.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { checkableResetRows } from "./checkable-reset-rows.js";
import { flushMicrotasks } from "./helpers.js";
import { Combobox } from "../combobox/index.js";
import { OTPField } from "../otp-field/index.js";
import { Slider } from "../slider/index.js";

const reset = async () => {
  await act(async () => (screen.getByTestId("form") as HTMLFormElement).reset());
  await flushMicrotasks();
};

describe("an edit after a form reset back to the pre-reset value is heard", () => {
  it("Combobox: the text", async () => {
    const onInputValueChange = vi.fn();
    render(
      <form data-testid="form">
        <Combobox.Root
          defaultInputValue="Jap"
          allowCustomValue
          onInputValueChange={onInputValueChange}
        >
          <Combobox.Input data-testid="input" aria-label="Country" />
          <Combobox.Popup>
            <Combobox.List>
              <Combobox.Option value="jp">Japan</Combobox.Option>
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Root>
      </form>,
    );
    const input = screen.getByTestId("input") as HTMLInputElement;
    act(() => {
      fireEvent.change(input, { target: { value: "xyz" } });
    });
    await reset();
    expect(input.value).toBe("Jap");
    onInputValueChange.mockClear();
    act(() => {
      fireEvent.change(input, { target: { value: "xyz" } });
    });
    expect(onInputValueChange.mock.calls.map(([v]) => v)).toEqual(["xyz"]);
    expect(input.value).toBe("xyz");
  });

  it("Slider: a thumb", async () => {
    const action = vi.fn();
    render(
      <form data-testid="form">
        <Slider.Root defaultValue={0} valueCommitAction={action} aria-label="Volume">
          <Slider.Track>
            <Slider.Thumb data-testid="thumb" aria-label="Volume" />
          </Slider.Track>
        </Slider.Root>
      </form>,
    );
    const thumb = screen.getByRole("slider") as HTMLInputElement;
    act(() => {
      fireEvent.input(thumb, { target: { value: "5" } });
      fireEvent.change(thumb);
    });
    await flushMicrotasks();
    await reset();
    expect(thumb.value).toBe("0");
    action.mockClear();
    act(() => {
      fireEvent.input(thumb, { target: { value: "5" } });
      fireEvent.change(thumb);
    });
    await flushMicrotasks();
    expect(thumb.value).toBe("5");
    expect(action.mock.calls.map(([v]) => v)).toEqual([5]);
  });

  it("OTPField: the code", async () => {
    const onValueChange = vi.fn();
    render(
      <form data-testid="form">
        <OTPField.Root length={4} onValueChange={onValueChange}>
          <OTPField.Input aria-label="Code" data-testid="input" />
        </OTPField.Root>
      </form>,
    );
    const input = screen.getByTestId("input") as HTMLInputElement;
    act(() => {
      fireEvent.change(input, { target: { value: "12" } });
    });
    await reset();
    expect(input.value).toBe("");
    onValueChange.mockClear();
    act(() => {
      fireEvent.change(input, { target: { value: "12" } });
    });
    expect(onValueChange.mock.calls.map(([v]) => v)).toEqual(["12"]);
  });
});

// The same for `checked` (#198): react-dom tracks a checkable input's `checked` the same way, and
// the reset algorithm writes it past the setter too. Check, reset, check again: every step
// dispatches. One row per checkable control, uncontrolled and controlled (a parent that adopts
// every offer, the reset's included). The real reset button rows are in
// form-reset-button.browser.test.tsx.
describe("a check after a form reset back to the pre-reset state is heard", () => {
  for (const row of checkableResetRows) {
    for (const mode of ["uncontrolled", "controlled"] as const) {
      it(`${row.name}, ${mode}`, async () => {
        const calls: Array<[unknown, string]> = [];
        render(<form data-testid="form">{row.render(mode, (n, r) => calls.push([n, r]))}</form>);
        const check = async () => {
          act(() => {
            fireEvent.click(row.target());
          });
          await flushMicrotasks();
        };
        await check();
        expect(row.target().checked).toBe(true);
        await reset();
        expect(row.target().checked).toBe(false);
        await check();
        expect(calls).toEqual([
          [row.checkedValue, "activate"],
          [row.resetValue, "platform"],
          [row.checkedValue, "activate"],
        ]);
        expect(row.target().checked).toBe(true);
      });
    }
  }
});

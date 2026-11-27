// Real keystrokes into every text-like control inside a Field, flipping its validity (#193).
// Chromium runs a microtask checkpoint after each listener of an `input` the user caused (Firefox
// after the whole dispatch): a React state write in the Field's own listener used to commit there,
// before React's listener on the root had seen the event, and that commit wrote a controlled
// control's previous value over the keystroke. The Field now writes the custom-validity slot in
// the listener and its state after the dispatch (design/components/field-form.md 2.4). The keys
// are pressed outside `act`, as in a page (inside `act`, React holds every commit until the
// interaction is over). The flushSync model of the bug is in field.test.tsx. Runs in Chromium,
// Firefox and WebKit.
import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { leaveActEnvironment, settle } from "../__tests__/browser-helpers.js";
import { Combobox } from "../combobox/index.js";
import { Form } from "../form/index.js";
import { NumberField } from "../number-field/index.js";
import { OTPField } from "../otp-field/index.js";
import { Select } from "../select/index.js";
import { Field } from "./index.js";

type Mode = "validate" | "required";

/** One step: keys pressed, then the value the control holds and whether the Field is valid. */
interface Step {
  readonly keys: string;
  readonly value: string;
  readonly valid: boolean;
}

/** Leaves the control (the platform's `:user-invalid` goes live), then focuses it again. */
const BLUR = "blur";
type Script = readonly (Step | typeof BLUR)[];

const control = () => screen.getByTestId("control") as HTMLInputElement | HTMLSelectElement;

/** The element whose validity the Field reads (NumberField's hidden input, else the control). */
function validityElement(): HTMLInputElement | HTMLSelectElement {
  const hidden = screen.queryByTestId("form")?.querySelector<HTMLInputElement>('input[name="f"]');
  return hidden?.type === "number" ? hidden : control();
}

async function outside(body: () => Promise<void>): Promise<void> {
  const restore = leaveActEnvironment();
  try {
    await body();
  } finally {
    restore();
  }
}

async function run(script: Script): Promise<void> {
  await act(async () => control().focus());
  let blurred = false;
  for (const step of script) {
    if (step === BLUR) {
      await outside(() => userEvent.click(screen.getByTestId("elsewhere")));
      await act(async () => control().focus());
      blurred = true;
      continue;
    }
    await outside(() => userEvent.keyboard(step.keys));
    const label = `after ${step.keys}`;
    await settle(() => {
      expect(control().value, label).toBe(step.value);
      expect(validityElement().validity.valid, label).toBe(step.valid);
      // Live after the blur: the Field's state follows the keystroke too.
      if (blurred) expect(control(), label).toHaveAttribute("aria-invalid", String(!step.valid));
    });
  }
}

function Harness({ mode, children }: { mode: Mode; children: ReactNode }) {
  const bad = new Set(["bad", "13", "123"]);
  return (
    <form data-testid="form" onSubmit={(e) => e.preventDefault()}>
      {/* Before the Field: an open listbox below the control would cover a later button. */}
      <button type="button" data-testid="elsewhere">
        Elsewhere
      </button>
      <Field.Root
        name="f"
        required={mode === "required"}
        validate={
          mode === "validate"
            ? (value, data) => (bad.has(value) || bad.has(String(data.get("text"))) ? "No." : null)
            : undefined
        }
      >
        <Field.Label>Field</Field.Label>
        {children}
        <Field.Error />
      </Field.Root>
    </form>
  );
}

function ControlledText({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  return (
    <Field.Control data-testid="control" value={text} onChange={(e) => setText(e.target.value)} />
  );
}

function ControlledNativeSelect() {
  const [value, setValue] = useState("a");
  return (
    <Field.Control
      data-testid="control"
      render={
        <select value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="">None</option>
          <option value="a">A</option>
          <option value="bad">Bad</option>
        </select>
      }
    />
  );
}

/** Text scripts for a control that starts with "Jap" (validate rejects "bad"). */
const TEXT: Record<Mode, Script> = {
  validate: [
    { keys: "{Control>}a{/Control}b", value: "b", valid: true },
    { keys: "a", value: "ba", valid: true },
    { keys: "d", value: "bad", valid: false },
    { keys: "{Backspace}", value: "ba", valid: true },
    BLUR,
    { keys: "{End}d", value: "bad", valid: false },
    { keys: "{Backspace}", value: "ba", valid: true },
  ],
  required: [
    { keys: "{Control>}a{/Control}{Backspace}", value: "", valid: false },
    { keys: "x", value: "x", valid: true },
    BLUR,
    { keys: "{End}{Backspace}", value: "", valid: false },
    { keys: "y", value: "y", valid: true },
  ],
};

/** Arrow keys on a focused, closed select of None / A / Bad starting at A. */
const SELECT: Record<Mode, Script> = {
  validate: [
    { keys: "{ArrowDown}", value: "bad", valid: false },
    { keys: "{ArrowUp}", value: "a", valid: true },
    BLUR,
    { keys: "{ArrowDown}", value: "bad", valid: false },
    { keys: "{ArrowUp}", value: "a", valid: true },
  ],
  required: [
    { keys: "{ArrowUp}", value: "", valid: false },
    { keys: "{ArrowDown}", value: "a", valid: true },
    BLUR,
    { keys: "{ArrowUp}", value: "", valid: false },
    { keys: "{ArrowDown}", value: "a", valid: true },
  ],
};

describe("an edit that changes the Field's validity keeps the keystroke (#193)", () => {
  for (const mode of ["validate", "required"] as const) {
    describe(mode, () => {
      it("Combobox", async () => {
        render(
          <Harness mode={mode}>
            <Combobox.Root allowCustomValue defaultInputValue="Jap">
              {/* The Field's name is the selection's; validate reads the text as "text" (#193). */}
              <Combobox.Input name="text" data-testid="control" />
              <Combobox.Popup style={{ margin: 0, inset: "auto" }}>
                <Combobox.List>
                  <Combobox.Option value="jp">Japan</Combobox.Option>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Root>
          </Harness>,
        );
        await run(TEXT[mode]);
      });

      it("Field.Control, controlled", async () => {
        render(
          <Harness mode={mode}>
            <ControlledText initial="Jap" />
          </Harness>,
        );
        await run(TEXT[mode]);
      });

      it("Field.Control, uncontrolled", async () => {
        render(
          <Harness mode={mode}>
            <Field.Control data-testid="control" defaultValue="Jap" />
          </Harness>,
        );
        await run(TEXT[mode]);
      });

      it("Field.Control rendering a controlled <select>", async () => {
        render(
          <Harness mode={mode}>
            <ControlledNativeSelect />
          </Harness>,
        );
        await run(SELECT[mode]);
      });

      it("Select", async () => {
        render(
          <Harness mode={mode}>
            <Select.Root defaultValue="a" data-testid="control">
              <Select.Option value="">None</Select.Option>
              <Select.Option value="a">A</Select.Option>
              <Select.Option value="bad">Bad</Select.Option>
            </Select.Root>
          </Harness>,
        );
        await run(SELECT[mode]);
      });

      it("OTPField", async () => {
        render(
          <Harness mode={mode}>
            <OTPField.Root length={3} style={{ display: "inline-flex", gap: 8 }}>
              <OTPField.Input data-testid="control" />
              {[0, 1, 2].map((i) => (
                <OTPField.Slot
                  key={i}
                  index={i}
                  style={{ inlineSize: 32, blockSize: 40, border: "1px solid" }}
                />
              ))}
            </OTPField.Root>
          </Harness>,
        );
        // A partial code is a `patternMismatch`; validate also rejects "123".
        await run(
          mode === "validate"
            ? [
                { keys: "1", value: "1", valid: false },
                { keys: "2", value: "12", valid: false },
                { keys: "4", value: "124", valid: true },
                { keys: "{Backspace}", value: "12", valid: false },
                { keys: "3", value: "123", valid: false },
                BLUR,
                { keys: "{End}{Backspace}", value: "12", valid: false },
                { keys: "4", value: "124", valid: true },
              ]
            : [
                { keys: "1", value: "1", valid: false },
                { keys: "23", value: "123", valid: true },
                { keys: "{Backspace}{Backspace}{Backspace}", value: "", valid: false },
                { keys: "7", value: "7", valid: false },
                BLUR,
                { keys: "{End}89", value: "789", valid: true },
                { keys: "{Backspace}", value: "78", valid: false },
              ],
        );
      });

      // NumberField's value changes at the commit (blur, Enter), not on a keystroke: the guard is
      // that the typed text survives the commit that flips the Field.
      it("NumberField", async () => {
        render(
          <Harness mode={mode}>
            <NumberField.Root locale="en-US" defaultValue={1}>
              <NumberField.Input data-testid="control" />
            </NumberField.Root>
          </Harness>,
        );
        await run(
          mode === "validate"
            ? [
                { keys: "{Control>}a{/Control}13", value: "13", valid: true },
                BLUR,
                { keys: "{Control>}a{/Control}12{Enter}", value: "12", valid: true },
                { keys: "{Control>}a{/Control}13{Enter}", value: "13", valid: false },
                { keys: "{Backspace}2{Enter}", value: "12", valid: true },
              ]
            : [
                { keys: "{Control>}a{/Control}{Backspace}", value: "", valid: true },
                BLUR,
                { keys: "{Enter}", value: "", valid: false },
                { keys: "5{Enter}", value: "5", valid: true },
                { keys: "{Backspace}{Enter}", value: "", valid: false },
              ],
        );
      });
    });
  }

  it("the keystroke that dismisses a shown server error is kept", async () => {
    render(
      <Form.Root action={() => {}} errors={{ f: "Taken." }} data-testid="form">
        <Field.Root name="f">
          <Field.Label>Field</Field.Label>
          <ControlledText initial="a" />
          <Field.Error data-testid="error" />
        </Field.Root>
      </Form.Root>,
    );
    await settle(() => expect(screen.getByTestId("error")).toHaveTextContent("Taken."));
    await act(async () => control().focus());
    await outside(() => userEvent.keyboard("{End}b"));
    await settle(() => expect(screen.queryByTestId("error")).toBeNull());
    expect(control().value).toBe("ab");
    expect(control()).toHaveAttribute("aria-invalid", "false");
  });
});

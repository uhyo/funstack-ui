// `details.valid` rows that need a real engine (design/components/field-form.md 7.5, #210): the
// checkable inputs are read in the click, before `input` / `change`, so every engine must already
// report the toggled state's `valueMissing` there, also for a controlled input; real keys commit a
// TextField; a NumberField's hidden input flags a script-set value.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { user } from "../__tests__/browser-user.js";
import { flushTasks } from "../__tests__/helpers.js";
import { Checkbox } from "../checkbox/index.js";
import { NumberField } from "../number-field/index.js";
import { Switch } from "../switch/index.js";
import { TextField } from "../text-field/index.js";
import type { TextFieldValueCommitDetails } from "../text-field/index.js";
import { Field } from "./index.js";

const valids = (fn: { mock: { calls: readonly (readonly unknown[])[] } }) =>
  fn.mock.calls.map((call) => (call[1] as { valid: boolean }).valid);

describe("details.valid in a real engine", () => {
  it.each(["uncontrolled", "controlled"] as const)(
    "Checkbox and Switch, required: the click-time read agrees (%s)",
    async (mode) => {
      const box = vi.fn();
      const sw = vi.fn();
      render(
        <form>
          {mode === "uncontrolled" ? (
            <>
              <Checkbox aria-label="Box" required defaultChecked checkedChangeAction={box} />
              <Switch aria-label="Switch" required defaultChecked checkedChangeAction={sw} />
            </>
          ) : (
            <>
              <Checkbox aria-label="Box" required checked checkedChangeAction={box} />
              <Switch aria-label="Switch" required checked checkedChangeAction={sw} />
            </>
          )}
        </form>,
      );
      await user.click(screen.getByRole("checkbox", { name: "Box" }));
      await user.click(screen.getByRole("switch", { name: "Switch" }));
      await flushTasks(2);
      expect(valids(box)).toEqual([false]);
      expect(valids(sw)).toEqual([false]);
      if (mode === "uncontrolled") {
        await user.click(screen.getByRole("checkbox", { name: "Box" }));
        await flushTasks(2);
        expect(valids(box)).toEqual([false, true]);
      }
    },
  );

  it("TextField, the dogfood case with real keys: the early return keeps the error shown", async () => {
    const save = vi.fn();
    const action = vi.fn(async (next: string, details: TextFieldValueCommitDetails) => {
      if (!details.valid) return;
      save(next);
    });
    render(
      <Field.Root name="title" required>
        <Field.Label>Title</Field.Label>
        <TextField defaultValue="Groceries" valueCommitAction={action} />
        <Field.Error data-testid="error" />
      </Field.Root>,
    );
    const input = screen.getByRole("textbox", { name: "Title" }) as HTMLInputElement;
    await user.click(input);
    await user.clear(input);
    await user.keyboard("{Enter}");
    await user.tab();
    await flushTasks(2);
    expect(valids(action)).toEqual([false]);
    expect(save).not.toHaveBeenCalled();
    expect(input.value).toBe("");
    expect(input.matches(":user-invalid")).toBe(true);
    expect(screen.getByTestId("error")).toHaveTextContent(input.validationMessage);
  });

  it("NumberField: the hidden input flags a script-set value (min, step, required)", async () => {
    const commit = vi.fn();
    render(
      <form>
        <NumberField.Root
          name="qty"
          min={1}
          step={2}
          required
          defaultValue={3}
          locale="en-US"
          valueCommitAction={commit}
        >
          <NumberField.Label>Quantity</NumberField.Label>
          <NumberField.Input data-testid="input" />
        </NumberField.Root>
      </form>,
    );
    const input = screen.getByTestId("input") as HTMLInputElement;
    for (const text of ["0", "4", "", "5"]) {
      await user.click(input);
      await user.clear(input);
      if (text !== "") await user.keyboard(text);
      await user.keyboard("{Enter}");
      await flushTasks(2);
    }
    // 0: rangeUnderflow; 4: stepMismatch (base 1, step 2); "": valueMissing; 5: valid.
    expect(commit.mock.calls.map((c) => c[0])).toEqual([0, 4, null, 5]);
    expect(valids(commit)).toEqual([false, false, false, true]);
  });
});

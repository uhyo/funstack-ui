// `details.valid` on every form control's value action (conventions 2.2,
// design/components/field-form.md 7.5; #210), jsdom. Per control: no constraint, a native
// constraint (in or out of a Field), a Field's `validate` for the requested value, a shown server
// error that does not count, the comparison row (after the commit, with no server error shown,
// `details.valid` equals the validity element's `validity.valid`), the platform paths, the type.
// The click-time read in real engines is pinned in details-valid.browser.test.tsx.
import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { blur, hidden, Parts, typeText, key } from "../__tests__/drivers/number-field.js";
import { press as pressThumb, thumbInput } from "../__tests__/drivers/slider.js";
import { ErrorCatcher, flushTasks, setupUser, silenceErrors } from "../__tests__/helpers.js";
import { Checkbox } from "../checkbox/index.js";
import type { CheckboxCheckedChangeDetails } from "../checkbox/index.js";
import { CheckboxGroup } from "../checkbox-group/index.js";
import type { CheckboxGroupValueChangeDetails } from "../checkbox-group/index.js";
import { Combobox } from "../combobox/index.js";
import type {
  ComboboxMultipleValueChangeDetails,
  ComboboxValueChangeDetails,
} from "../combobox/index.js";
import { Form } from "../form/index.js";
import { MultiSelect } from "../multi-select/index.js";
import type { MultiSelectValueChangeDetails } from "../multi-select/index.js";
import { NumberField } from "../number-field/index.js";
import type {
  NumberFieldValueChangeDetails,
  NumberFieldValueCommitDetails,
} from "../number-field/index.js";
import { OTPField } from "../otp-field/index.js";
import type { OTPFieldCompleteDetails, OTPFieldValueChangeDetails } from "../otp-field/index.js";
import { RadioGroup } from "../radio-group/index.js";
import type { RadioGroupValueChangeDetails } from "../radio-group/index.js";
import { Select } from "../select/index.js";
import type { SelectValueChangeDetails } from "../select/index.js";
import { Slider } from "../slider/index.js";
import type { SliderValueChangeDetails, SliderValueCommitDetails } from "../slider/index.js";
import { Switch } from "../switch/index.js";
import type { SwitchCheckedChangeDetails } from "../switch/index.js";
import { TextField } from "../text-field/index.js";
import type { Rejectable } from "../internal/types.js";
import type { TextFieldValueCommitDetails } from "../text-field/index.js";
import { Field } from "./index.js";

/** The `valid` of each call of a mocked action. */
const valids = (fn: { mock: { calls: readonly (readonly unknown[])[] } }) =>
  fn.mock.calls.map((call) => (call[1] as { valid: boolean }).valid);
const lastDetails = <D,>(fn: { mock: { calls: readonly (readonly unknown[])[] } }) =>
  fn.mock.calls.at(-1)![1] as D;

function InForm({ children }: { children: ReactNode }) {
  return (
    <form data-testid="form" onSubmit={(e) => e.preventDefault()}>
      {children}
      <button type="reset">Reset</button>
    </form>
  );
}
const resetForm = async () => {
  await setupUser().click(screen.getByRole("button", { name: "Reset" }));
  await flushTasks(2);
};

describe("details.valid: Checkbox and Switch (checkable input)", () => {
  const box = () => screen.getByRole("checkbox") as HTMLInputElement;

  it("no constraint: true; JSON-serialisable as an own field", async () => {
    const action = vi.fn();
    render(<Checkbox aria-label="x" checkedChangeAction={action} />);
    await setupUser().click(box());
    const details = lastDetails<CheckboxCheckedChangeDetails>(action);
    expect(details.valid).toBe(true);
    expect(Object.keys(details)).toContain("valid");
    expect(JSON.parse(JSON.stringify(details))).toEqual({ reason: "activate", valid: true });
  });

  it("required outside a Field: unchecking gives false, checking true (comparison row)", async () => {
    const action = vi.fn();
    render(<Checkbox aria-label="x" required defaultChecked checkedChangeAction={action} />);
    const user = setupUser();
    await user.click(box());
    expect(valids(action)).toEqual([false]);
    expect(box().validity.valid).toBe(false);
    await user.click(box());
    expect(valids(action)).toEqual([false, true]);
    expect(box().validity.valid).toBe(true);
  });

  it("a controlled parent that refuses: the requested value is the one judged", async () => {
    const action = vi.fn();
    render(<Checkbox aria-label="x" required checked checkedChangeAction={action} />);
    await setupUser().click(box());
    expect(action.mock.calls[0]![0]).toBe(false);
    expect(valids(action)).toEqual([false]);
    await flushTasks(2);
    expect(box().checked).toBe(true);
  });

  it("a form reset (platform) carries it", async () => {
    const action = vi.fn();
    render(
      <InForm>
        <Checkbox aria-label="x" required checkedChangeAction={action} />
      </InForm>,
    );
    await setupUser().click(box());
    expect(valids(action)).toEqual([true]);
    await resetForm();
    expect(lastDetails<CheckboxCheckedChangeDetails>(action).reason).toBe("platform");
    expect(valids(action)).toEqual([true, false]);
  });

  it("inside a Field: validate failing and passing for the requested value", async () => {
    const action = vi.fn();
    render(
      <InForm>
        <Field.Root name="agree" validate={(v) => (v === "" ? "You must agree" : null)}>
          <Field.Label>Agree</Field.Label>
          <Checkbox checkedChangeAction={action} />
          <Field.Error />
        </Field.Root>
      </InForm>,
    );
    const user = setupUser();
    await user.click(box());
    await user.click(box());
    expect(valids(action)).toEqual([true, false]);
    // Comparison row: the Field's slot now holds `validate`'s message.
    expect(box().validity.valid).toBe(false);
  });

  it("a shown server error does not make it false", async () => {
    const action = vi.fn();
    render(
      <Form.Root action={async () => {}} errors={{ agree: "Server says no" }}>
        <Field.Root name="agree">
          <Field.Label>Agree</Field.Label>
          <Checkbox checkedChangeAction={action} />
          <Field.Error />
        </Field.Root>
      </Form.Root>,
    );
    expect(box().validity.customError).toBe(true);
    await setupUser().click(box());
    expect(valids(action)).toEqual([true]);
  });

  it("Switch: required, uncheck false and check true", async () => {
    const action = vi.fn();
    render(<Switch aria-label="x" required defaultChecked checkedChangeAction={action} />);
    const user = setupUser();
    const sw = screen.getByRole("switch") as HTMLInputElement;
    await user.click(sw);
    await user.click(sw);
    expect(valids(action)).toEqual([false, true]);
  });
});

describe("details.valid: RadioGroup", () => {
  it("required with nothing checked, then a pick: true; a reset to empty: false", async () => {
    const action = vi.fn();
    render(
      <InForm>
        <RadioGroup.Root aria-label="Size" name="size" required valueChangeAction={action}>
          <RadioGroup.Item value="s" aria-label="s" />
          <RadioGroup.Item value="m" aria-label="m" />
        </RadioGroup.Root>
      </InForm>,
    );
    const first = screen.getByRole("radio", { name: "s" }) as HTMLInputElement;
    expect(first.validity.valueMissing).toBe(true);
    await setupUser().click(screen.getByRole("radio", { name: "m" }));
    expect(valids(action)).toEqual([true]);
    expect(first.validity.valid).toBe(true);
    await resetForm();
    expect(action.mock.calls.at(-1)![0]).toBeNull();
    expect(valids(action)).toEqual([true, false]);
  });

  it("inside a Field: validate for the requested value", async () => {
    const action = vi.fn();
    render(
      <Field.Root name="size" validate={(v) => (v === "m" ? "Sold out" : null)}>
        <Field.Label>Size</Field.Label>
        <RadioGroup.Root valueChangeAction={action}>
          <RadioGroup.Item value="s" aria-label="s" />
          <RadioGroup.Item value="m" aria-label="m" />
        </RadioGroup.Root>
      </Field.Root>,
    );
    const user = setupUser();
    // Outside a form the Field's `FormData` is empty: the custom half sees no value.
    await user.click(screen.getByRole("radio", { name: "m" }));
    expect(valids(action)).toEqual([true]);
  });

  it("inside a Field in a form: validate failing for the requested value", async () => {
    const action = vi.fn();
    render(
      <InForm>
        <Field.Root name="size" validate={(v) => (v === "m" ? "Sold out" : null)}>
          <Field.Label>Size</Field.Label>
          <RadioGroup.Root valueChangeAction={action}>
            <RadioGroup.Item value="s" aria-label="s" />
            <RadioGroup.Item value="m" aria-label="m" />
          </RadioGroup.Root>
        </Field.Root>
      </InForm>,
    );
    const user = setupUser();
    await user.click(screen.getByRole("radio", { name: "m" }));
    await user.click(screen.getByRole("radio", { name: "s" }));
    expect(valids(action)).toEqual([false, true]);
  });
});

describe("details.valid: CheckboxGroup (computed)", () => {
  const item = (v: string) => screen.getByRole("checkbox", { name: v }) as HTMLInputElement;
  function Group(props: {
    action: (next: string[], d: CheckboxGroupValueChangeDetails) => void;
    defaultValue: string[];
    required?: boolean;
  }) {
    return (
      <CheckboxGroup.Root
        name="fruit"
        required={props.required}
        defaultValue={props.defaultValue}
        valueChangeAction={props.action}
      >
        <CheckboxGroup.Label>Fruit</CheckboxGroup.Label>
        <CheckboxGroup.Parent values={["a", "b", "c"]} aria-label="all" />
        {["a", "b", "c"].map((v) => (
          <CheckboxGroup.Item key={v} value={v} aria-label={v} />
        ))}
      </CheckboxGroup.Root>
    );
  }

  it("required: the last Item unchecked gives false (comparison row)", async () => {
    const action = vi.fn();
    render(
      <InForm>
        <Group action={action} defaultValue={["a"]} required />
      </InForm>,
    );
    await setupUser().click(item("a"));
    expect(valids(action)).toEqual([false]);
    await flushTasks(2);
    expect(item("a").validity.valid).toBe(false);
  });

  it("a Parent click that clears all gives false, one that checks all true", async () => {
    const action = vi.fn();
    render(
      <InForm>
        <Group action={action} defaultValue={["a", "b", "c"]} required />
      </InForm>,
    );
    const user = setupUser();
    await user.click(item("all"));
    await user.click(item("all"));
    expect(action.mock.calls.map((c) => c[0])).toEqual([[], ["a", "b", "c"]]);
    expect(valids(action)).toEqual([false, true]);
  });

  it("validate sees getAll(name) for the next set, not the committed one", async () => {
    const action = vi.fn();
    const seen: string[][] = [];
    render(
      <InForm>
        <Field.Root
          name="fruit"
          validate={(_v, fd) => {
            const all = fd.getAll("fruit") as string[];
            seen.push(all);
            return all.length > 2 ? "At most two" : null;
          }}
        >
          <Field.Label>Fruit</Field.Label>
          <Group action={action} defaultValue={["a"]} />
        </Field.Root>
      </InForm>,
    );
    seen.length = 0;
    await setupUser().click(item("all"));
    expect(action.mock.calls[0]![0]).toEqual(["a", "b", "c"]);
    expect(valids(action)).toEqual([false]);
    expect(seen[0]).toEqual(["a", "b", "c"]);
  });

  it("a reset (platform) carries it", async () => {
    const action = vi.fn();
    render(
      <InForm>
        <Group action={action} defaultValue={[]} required />
      </InForm>,
    );
    await setupUser().click(item("b"));
    await resetForm();
    expect(valids(action)).toEqual([true, false]);
  });
});

describe("details.valid: Select", () => {
  const sel = () => screen.getByRole("combobox") as HTMLSelectElement;
  function Fruit({
    action,
    defaultValue,
  }: {
    action: (next: string, d: SelectValueChangeDetails) => void;
    defaultValue: string;
  }) {
    return (
      <Select.Root
        aria-label="Fruit"
        name="fruit"
        required
        defaultValue={defaultValue}
        valueChangeAction={action}
      >
        <Select.Option value="">Choose</Select.Option>
        <Select.Option value="a">A</Select.Option>
        <Select.Option value="b">B</Select.Option>
      </Select.Root>
    );
  }

  it('required: the "" option gives false, another true (comparison row)', async () => {
    const action = vi.fn();
    render(<Fruit action={action} defaultValue="a" />);
    const user = setupUser();
    await user.selectOptions(sel(), "");
    expect(valids(action)).toEqual([false]);
    expect(sel().validity.valid).toBe(false);
    await user.selectOptions(sel(), "b");
    expect(valids(action)).toEqual([false, true]);
  });

  it("a reset to the empty option gives false", async () => {
    const action = vi.fn();
    render(
      <InForm>
        <Fruit action={action} defaultValue="" />
      </InForm>,
    );
    await setupUser().selectOptions(sel(), "a");
    await resetForm();
    expect(lastDetails<SelectValueChangeDetails>(action).reason).toBe("platform");
    expect(valids(action)).toEqual([true, false]);
  });
});

describe("details.valid: MultiSelect (computed)", () => {
  const trigger = () => screen.getByTestId("trigger");
  const option = (v: string) => screen.getByTestId(`opt-${v}`);
  function Toppings({
    action,
    required,
  }: {
    action: (next: string[], d: MultiSelectValueChangeDetails) => void;
    required?: boolean;
  }) {
    return (
      <MultiSelect.Root defaultValue={["ham"]} required={required} valueChangeAction={action}>
        <MultiSelect.Trigger data-testid="trigger">
          <MultiSelect.Value placeholder="Choose" />
        </MultiSelect.Trigger>
        <MultiSelect.Popup>
          <MultiSelect.List>
            {["ham", "olive"].map((v) => (
              <MultiSelect.Option key={v} value={v} data-testid={`opt-${v}`}>
                {v}
              </MultiSelect.Option>
            ))}
          </MultiSelect.List>
        </MultiSelect.Popup>
      </MultiSelect.Root>
    );
  }

  it("required: removing the last value gives false (comparison row)", async () => {
    const action = vi.fn();
    render(
      <InForm>
        <Field.Root name="toppings">
          <Field.Label>Toppings</Field.Label>
          <Toppings action={action} required />
        </Field.Root>
      </InForm>,
    );
    const user = setupUser();
    await user.click(trigger());
    await flushTasks(2);
    await user.click(option("ham"));
    expect(valids(action)).toEqual([false]);
    await flushTasks(2);
    expect((trigger().nextElementSibling as HTMLSelectElement).validity.valid).toBe(false);
    await user.click(option("olive"));
    expect(valids(action)).toEqual([false, true]);
  });

  it("validate over getAll(name) sees the next set", async () => {
    const action = vi.fn();
    render(
      <InForm>
        <Field.Root
          name="toppings"
          validate={(_v, fd) => (fd.getAll("toppings").length > 1 ? "One only" : null)}
        >
          <Field.Label>Toppings</Field.Label>
          <Toppings action={action} />
        </Field.Root>
      </InForm>,
    );
    const user = setupUser();
    await user.click(trigger());
    await flushTasks(2);
    await user.click(option("olive"));
    expect(action.mock.calls[0]![0]).toEqual(["ham", "olive"]);
    expect(valids(action)).toEqual([false]);
  });
});

describe("details.valid: Combobox (computed)", () => {
  const noop = () => {};
  const option = (v: string) => screen.getByTestId(`opt-${v}`);
  const comboInput = () => screen.getByRole("combobox") as HTMLInputElement;
  function Countries({ multiple = false }: { multiple?: boolean }) {
    return (
      <>
        {multiple && (
          <Combobox.Chips>
            {({ value }) => value.map((v) => <Combobox.Chip key={v} value={v} />)}
          </Combobox.Chips>
        )}
        <Combobox.Input />
        <Combobox.Clear aria-label="Clear" />
        <Combobox.Popup>
          <Combobox.List>
            {[
              ["jp", "Japan"],
              ["fr", "France"],
            ].map(([v, name]) => (
              <Combobox.Option key={v} value={v!} data-testid={`opt-${v}`}>
                {name}
              </Combobox.Option>
            ))}
          </Combobox.List>
        </Combobox.Popup>
      </>
    );
  }

  it("single, required: a pick gives true, Clear false (comparison row)", async () => {
    const action = vi.fn<(n: string | null, d: ComboboxValueChangeDetails) => void>();
    render(
      <InForm>
        <Field.Root name="country" required>
          <Field.Label>Country</Field.Label>
          <Combobox.Root open onOpenChange={noop} valueChangeAction={action}>
            <Countries />
          </Combobox.Root>
        </Field.Root>
      </InForm>,
    );
    const user = setupUser();
    await user.click(option("jp"));
    await flushTasks(2);
    expect(valids(action)).toEqual([true]);
    expect(comboInput().validity.valid).toBe(true);
    await user.click(screen.getByRole("button", { name: "Clear" }));
    await flushTasks(2);
    expect(action.mock.calls.at(-1)![0]).toBeNull();
    expect(valids(action)).toEqual([true, false]);
    expect(comboInput().validity.valid).toBe(false);
  });

  it("single, required, allowCustomValue: a custom value is true", async () => {
    const action = vi.fn<(n: string | null, d: ComboboxValueChangeDetails) => void>();
    render(
      <Combobox.Root name="tag" allowCustomValue valueChangeAction={action}>
        <Combobox.Input aria-label="Tag" required />
        <Combobox.Popup>
          <Combobox.List />
        </Combobox.Popup>
      </Combobox.Root>,
    );
    const user = setupUser();
    await user.click(comboInput());
    await user.keyboard("Narnia{Enter}");
    await flushTasks(2);
    const details = lastDetails<ComboboxValueChangeDetails>(action);
    expect(details.custom).toBe(true);
    expect(details.valid).toBe(true);
  });

  it("single: validate sees the next selection", async () => {
    const action = vi.fn<(n: string | null, d: ComboboxValueChangeDetails) => void>();
    render(
      <InForm>
        <Field.Root name="country" validate={(v) => (v === "fr" ? "Not France" : null)}>
          <Field.Label>Country</Field.Label>
          <Combobox.Root open onOpenChange={noop} valueChangeAction={action}>
            <Countries />
          </Combobox.Root>
        </Field.Root>
      </InForm>,
    );
    const user = setupUser();
    await user.click(option("fr"));
    await flushTasks(2);
    await user.click(option("jp"));
    await flushTasks(2);
    expect(valids(action)).toEqual([false, true]);
  });

  it("multiple, required: the last chip removed gives false", async () => {
    const action = vi.fn<(n: string[], d: ComboboxMultipleValueChangeDetails) => void>();
    render(
      <InForm>
        <Field.Root name="countries" required>
          <Field.Label>Countries</Field.Label>
          <Combobox.Root
            multiple
            open
            onOpenChange={noop}
            defaultValue={["jp"]}
            valueChangeAction={action}
          >
            <Countries multiple />
          </Combobox.Root>
        </Field.Root>
      </InForm>,
    );
    const user = setupUser();
    await user.click(option("fr"));
    await user.click(option("jp"));
    await user.click(option("fr"));
    expect(action.mock.calls.map((c) => c[0])).toEqual([["jp", "fr"], ["fr"], []]);
    expect(valids(action)).toEqual([true, true, false]);
    await flushTasks(2);
    expect(comboInput().validity.valid).toBe(false);
  });
});

describe("details.valid: TextField", () => {
  const field = () => screen.getByRole("textbox") as HTMLInputElement;

  it("the dogfood case: required, clear, Enter gives false; an early return saves nothing", async () => {
    const save = vi.fn();
    const action = vi.fn(async (next: string, details: TextFieldValueCommitDetails) => {
      if (!details.valid) return;
      save(next);
    });
    render(
      <Field.Root name="title" required>
        <Field.Label>Title</Field.Label>
        <TextField defaultValue="Groceries" valueCommitAction={action} />
        <Field.Error />
      </Field.Root>,
    );
    const user = setupUser();
    await user.clear(field());
    await user.keyboard("{Enter}");
    await flushTasks(2);
    expect(valids(action)).toEqual([false]);
    expect(save).not.toHaveBeenCalled();
    // Uncontrolled: the text stays as a draft (#220, conventions 3.3.1), invalid.
    expect(field().value).toBe("");
    expect(field().validity.valid).toBe(false);
    await user.type(field(), "Chores{Enter}");
    await flushTasks(2);
    expect(valids(action)).toEqual([false, true]);
    expect(save).toHaveBeenCalledExactlyOnceWith("Chores");
  });

  it("pattern, and a blur commit", async () => {
    const action = vi.fn();
    render(<TextField aria-label="Code" pattern="[a-z]+" valueCommitAction={action} />);
    const user = setupUser();
    await user.type(field(), "ABC");
    await user.tab();
    expect(lastDetails<TextFieldValueCommitDetails>(action).event?.type).toBe("focusout");
    expect(valids(action)).toEqual([false]);
    expect(field().validity.valid).toBe(false);
  });

  it("validate inside a Field", async () => {
    const action = vi.fn();
    render(
      <InForm>
        <Field.Root name="title" validate={(v) => (v === "taken" ? "Taken" : null)}>
          <Field.Label>Title</Field.Label>
          <TextField valueCommitAction={action} />
        </Field.Root>
      </InForm>,
    );
    const user = setupUser();
    await user.type(field(), "taken");
    await user.tab();
    await user.type(field(), "x");
    await user.tab();
    expect(valids(action)).toEqual([false, true]);
  });

  it("a textarea commit (Ctrl+Enter)", async () => {
    const action = vi.fn();
    render(
      <TextField
        aria-label="Notes"
        required
        defaultValue="Line"
        render={<textarea />}
        valueCommitAction={action}
      />,
    );
    const user = setupUser();
    await user.clear(field());
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(valids(action)).toEqual([false]);
  });

  it("a reset (platform) carries it", async () => {
    const action = vi.fn();
    render(
      <InForm>
        <TextField aria-label="Title" required valueCommitAction={action} />
      </InForm>,
    );
    const user = setupUser();
    await user.type(field(), "abc");
    await user.tab();
    await resetForm();
    expect(lastDetails<TextFieldValueCommitDetails>(action).reason).toBe("platform");
    expect(valids(action)).toEqual([true, false]);
  });
});

describe("details.valid: NumberField", () => {
  it("a typed 0 with min={1}: false on both actions (comparison row on the hidden input)", () => {
    const change = vi.fn();
    const commit = vi.fn();
    render(
      <InForm>
        <NumberField.Root
          name="qty"
          min={1}
          defaultValue={3}
          locale="en-US"
          valueChangeAction={change}
          valueCommitAction={commit}
        >
          <Parts />
        </NumberField.Root>
      </InForm>,
    );
    typeText("0");
    blur();
    expect(commit.mock.calls[0]![0]).toBe(0);
    expect(valids(commit)).toEqual([false]);
    expect(valids(change)).toEqual([false]);
    expect(hidden().validity.valid).toBe(false);
    expect(hidden().validity.rangeUnderflow).toBe(true);
  });

  it("a step clamps (true for range) but validate can make it false", () => {
    const commit = vi.fn();
    render(
      <InForm>
        <Field.Root name="qty" validate={(v) => (v === "6" ? "No six" : null)}>
          <NumberField.Root
            min={1}
            max={6}
            defaultValue={5}
            locale="en-US"
            valueCommitAction={commit}
          >
            <Parts />
          </NumberField.Root>
        </Field.Root>
      </InForm>,
    );
    key("ArrowUp");
    key("ArrowUp");
    key("ArrowDown");
    expect(commit.mock.calls.map((c) => c[0])).toEqual([6, 5]);
    expect(valids(commit)).toEqual([false, true]);
  });

  it("empty with required: false; unparsable text dispatches nothing", () => {
    const commit = vi.fn();
    render(
      <InForm>
        <NumberField.Root
          name="qty"
          required
          defaultValue={3}
          locale="en-US"
          valueCommitAction={commit}
        >
          <Parts />
        </NumberField.Root>
      </InForm>,
    );
    typeText("abc");
    blur();
    expect(commit).not.toHaveBeenCalled();
    typeText("");
    blur();
    expect(commit.mock.calls[0]![0]).toBeNull();
    expect(valids(commit)).toEqual([false]);
  });

  it("a controlled parent that does not adopt: the hidden input returns to the shown value", async () => {
    const commit = vi.fn(async () => {});
    render(
      <InForm>
        <NumberField.Root name="qty" min={1} value={5} locale="en-US" valueCommitAction={commit}>
          <Parts />
        </NumberField.Root>
      </InForm>,
    );
    typeText("0");
    blur();
    expect(valids(commit)).toEqual([false]);
    await act(async () => {
      await flushTasks(2);
    });
    expect(hidden().value).toBe("5");
    expect(hidden().validity.valid).toBe(true);
  });

  it('the "dismiss" notice of a rejected commit carries it', async () => {
    silenceErrors();
    const change = vi.fn();
    const onError = vi.fn();
    render(
      <ErrorCatcher onError={onError}>
        <NumberField.Root
          name="qty"
          min={1}
          defaultValue={3}
          locale="en-US"
          valueChangeAction={change}
          valueCommitAction={async () => {
            throw new Error("no");
          }}
        >
          <Parts />
        </NumberField.Root>
      </ErrorCatcher>,
    );
    typeText("0");
    blur();
    await act(async () => {
      await flushTasks(3);
    });
    const dismiss = change.mock.calls.find(
      (c) => (c[1] as NumberFieldValueChangeDetails).reason === "dismiss",
    );
    expect(dismiss).toBeDefined();
    expect(dismiss![0]).toBe(3);
    expect((dismiss![1] as NumberFieldValueChangeDetails).valid).toBe(true);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe("details.valid: Slider", () => {
  it("true without validate", () => {
    const commit = vi.fn();
    render(
      <Slider.Root name="volume" defaultValue={40} valueCommitAction={commit}>
        <Slider.Label>Volume</Slider.Label>
        <Slider.Track>
          <Slider.Thumb index={0} data-testid="thumb-0" />
        </Slider.Track>
      </Slider.Root>,
    );
    pressThumb(thumbInput(0), 41);
    expect(valids(commit)).toEqual([true]);
  });

  it("two thumbs: the narrow-the-range rule gives false on both actions", () => {
    const change = vi.fn();
    const commit = vi.fn();
    render(
      <InForm>
        <Field.Root
          name="price"
          validate={(_v, fd) => {
            const [lo = 0, hi = 0] = fd.getAll("price").map(Number);
            return hi - lo < 50 ? "Too narrow" : null;
          }}
        >
          <Field.Label>Price</Field.Label>
          <Slider.Root
            defaultValue={[20, 80]}
            valueChangeAction={change}
            valueCommitAction={commit}
          >
            <Slider.Track>
              <Slider.Thumb index={0} aria-label="Min" data-testid="thumb-0" />
              <Slider.Thumb index={1} aria-label="Max" data-testid="thumb-1" />
            </Slider.Track>
          </Slider.Root>
        </Field.Root>
      </InForm>,
    );
    pressThumb(thumbInput(0), 40);
    expect(valids(change)).toEqual([false]);
    expect(valids(commit)).toEqual([false]);
    pressThumb(thumbInput(0), 25);
    expect(valids(commit)).toEqual([false, true]);
    // Comparison row: the Field's slot is on the first thumb.
    expect(thumbInput(0).validity.valid).toBe(true);
  });
});

describe("details.valid: OTPField", () => {
  const otp = () => screen.getByRole("textbox") as HTMLInputElement;

  it("completeAction: true without validate", async () => {
    const complete = vi.fn();
    render(
      <OTPField.Root length={4} completeAction={complete}>
        <OTPField.Input aria-label="Code" />
      </OTPField.Root>,
    );
    const user = setupUser();
    await user.click(otp());
    await user.keyboard("1234");
    expect(valids(complete)).toEqual([true]);
  });

  it("validate rejecting the code gives false, and validate received the filtered code", async () => {
    const complete = vi.fn();
    const seen: string[] = [];
    render(
      <InForm>
        <Field.Root
          name="code"
          validate={(v) => {
            seen.push(v);
            return v === "1234" ? "Expired" : null;
          }}
        >
          <Field.Label>Code</Field.Label>
          <OTPField.Root length={4} completeAction={complete}>
            <OTPField.Input />
          </OTPField.Root>
        </Field.Root>
      </InForm>,
    );
    const user = setupUser();
    await user.click(otp());
    await user.paste("12-34");
    expect(complete.mock.calls[0]![0]).toBe("1234");
    expect(valids(complete)).toEqual([false]);
    expect(seen).toContain("1234");
  });
});

// The limit of #220 (conventions 3.3.1, "Why not the other controls"): a control with no draft
// writes an invalid value that resolves, as before, and a later rejection returns to it.
describe("details.valid: an invalid value is written where there is no draft", () => {
  it("Checkbox: required, unchecked with an early return stays unchecked; a rejected check shows unchecked", async () => {
    const reportError = vi.fn();
    vi.stubGlobal("reportError", reportError);
    const action = vi.fn(
      async (_next: boolean, details: CheckboxCheckedChangeDetails & Rejectable) => {
        if (!details.valid) return;
        details.reject();
      },
    );
    render(<Checkbox aria-label="x" required defaultChecked checkedChangeAction={action} />);
    const box = () => screen.getByRole("checkbox") as HTMLInputElement;
    const user = setupUser();
    await user.click(box());
    await flushTasks(2);
    expect(box().checked).toBe(false);
    await user.click(box());
    await flushTasks(2);
    expect(valids(action)).toEqual([false, true]);
    expect(box().checked).toBe(false);
    expect(reportError).not.toHaveBeenCalled();
  });

  it("Select: required, back to the placeholder, stays there", async () => {
    const action = vi.fn(async (_next: string, details: SelectValueChangeDetails) => {
      if (!details.valid) return;
    });
    render(
      <Select.Root
        aria-label="Fruit"
        name="fruit"
        required
        defaultValue="a"
        valueChangeAction={action}
      >
        <Select.Option value="">Choose</Select.Option>
        <Select.Option value="a">A</Select.Option>
      </Select.Root>,
    );
    const sel = () => screen.getByRole("combobox") as HTMLSelectElement;
    await setupUser().selectOptions(sel(), "");
    await flushTasks(2);
    expect(valids(action)).toEqual([false]);
    expect(sel().value).toBe("");
  });

  it("CheckboxGroup: required, the last Item unchecked stays empty", async () => {
    const action = vi.fn(async (_next: string[], details: CheckboxGroupValueChangeDetails) => {
      if (!details.valid) return;
    });
    render(
      <InForm>
        <CheckboxGroup.Root name="fruit" required defaultValue={["a"]} valueChangeAction={action}>
          <CheckboxGroup.Label>Fruit</CheckboxGroup.Label>
          <CheckboxGroup.Item value="a" aria-label="a" />
          <CheckboxGroup.Item value="b" aria-label="b" />
        </CheckboxGroup.Root>
      </InForm>,
    );
    const item = (v: string) => screen.getByRole("checkbox", { name: v }) as HTMLInputElement;
    await setupUser().click(item("a"));
    await flushTasks(2);
    expect(valids(action)).toEqual([false]);
    expect(item("a").checked).toBe(false);
    expect(item("b").checked).toBe(false);
  });
});

describe("details.valid: types", () => {
  it("every value action's details type has readonly valid: boolean", () => {
    expectTypeOf<CheckboxCheckedChangeDetails["valid"]>().toEqualTypeOf<boolean>();
    expectTypeOf<SwitchCheckedChangeDetails["valid"]>().toEqualTypeOf<boolean>();
    expectTypeOf<RadioGroupValueChangeDetails["valid"]>().toEqualTypeOf<boolean>();
    expectTypeOf<CheckboxGroupValueChangeDetails["valid"]>().toEqualTypeOf<boolean>();
    expectTypeOf<SelectValueChangeDetails["valid"]>().toEqualTypeOf<boolean>();
    expectTypeOf<MultiSelectValueChangeDetails["valid"]>().toEqualTypeOf<boolean>();
    expectTypeOf<ComboboxValueChangeDetails["valid"]>().toEqualTypeOf<boolean>();
    expectTypeOf<ComboboxMultipleValueChangeDetails["valid"]>().toEqualTypeOf<boolean>();
    expectTypeOf<TextFieldValueCommitDetails["valid"]>().toEqualTypeOf<boolean>();
    expectTypeOf<NumberFieldValueChangeDetails["valid"]>().toEqualTypeOf<boolean>();
    expectTypeOf<NumberFieldValueCommitDetails["valid"]>().toEqualTypeOf<boolean>();
    expectTypeOf<SliderValueChangeDetails["valid"]>().toEqualTypeOf<boolean>();
    expectTypeOf<SliderValueCommitDetails["valid"]>().toEqualTypeOf<boolean>();
    expectTypeOf<OTPFieldCompleteDetails["valid"]>().toEqualTypeOf<boolean>();
    // Not on handlers (conventions 2.2).
    expectTypeOf<OTPFieldValueChangeDetails>().not.toHaveProperty("valid");
  });
});

// Type-level rows of `readOnly` (conventions 3.6.1 rules 1 and 9, #203): the prop is on the value
// owner only; `aria-readonly` is owned (in the `Omit`) on every part that carries the mark; items
// and inner parts keep `readOnly` out of their props types. Typed object literals with the
// hyphenated key, so excess-property checking applies (`pnpm typecheck` fails on a regression;
// the runtime body is trivial).
import { describe, expect, it } from "vitest";
import type { CheckboxProps } from "../checkbox/index.js";
import type {
  CheckboxGroupItemProps,
  CheckboxGroupParentProps,
  CheckboxGroupRootProps,
} from "../checkbox-group/index.js";
import type { ComboboxInputProps, ComboboxRootSingleProps } from "../combobox/index.js";
import type { FieldControlProps, FieldRootProps } from "../field/index.js";
import type { MultiSelectRootProps, MultiSelectTriggerProps } from "../multi-select/index.js";
import type { NumberFieldInputProps, NumberFieldRootProps } from "../number-field/index.js";
import type { OTPFieldInputProps, OTPFieldRootProps } from "../otp-field/index.js";
import type { RadioGroupItemProps, RadioGroupRootProps } from "../radio-group/index.js";
import type { SelectOptionProps, SelectRootProps } from "../select/index.js";
import type { SliderRootProps, SliderThumbProps } from "../slider/index.js";
import type { SwitchProps } from "../switch/index.js";
import type { TextFieldProps } from "../text-field/index.js";
import type { ToggleProps } from "../toggle/index.js";

describe("readOnly types (conventions 3.6.1)", () => {
  it("every value owner and Field.Root take readOnly", () => {
    const owners = [
      { readOnly: true } satisfies CheckboxProps,
      { readOnly: true } satisfies SwitchProps,
      { readOnly: true } satisfies RadioGroupRootProps,
      { readOnly: true } satisfies CheckboxGroupRootProps,
      { readOnly: true } satisfies SelectRootProps,
      { readOnly: true } satisfies SliderRootProps,
      { readOnly: true } satisfies Partial<ComboboxRootSingleProps>,
      { readOnly: true } satisfies MultiSelectRootProps,
      { readOnly: true } satisfies TextFieldProps,
      { readOnly: true } satisfies NumberFieldRootProps,
      { readOnly: true } satisfies Partial<OTPFieldRootProps>,
      { readOnly: true } satisfies FieldRootProps,
      { readOnly: true } satisfies FieldControlProps,
    ];
    expect(owners).toHaveLength(13);
  });

  it("aria-readonly is owned on every part that carries the mark", () => {
    // @ts-expect-error Checkbox renders it from `readOnly`.
    const checkbox: CheckboxProps = { "aria-readonly": "true" };
    // @ts-expect-error Switch renders it from `readOnly`.
    const switchProps: SwitchProps = { "aria-readonly": "true" };
    // @ts-expect-error The radiogroup carries the Root's read-only.
    const radioRoot: RadioGroupRootProps = { "aria-readonly": "true" };
    // @ts-expect-error Each CheckboxGroup Item carries the Root's read-only.
    const item: CheckboxGroupItemProps = { value: "a", "aria-readonly": "true" };
    // @ts-expect-error Each CheckboxGroup Parent carries the Root's read-only.
    const parent: CheckboxGroupParentProps = { values: ["a"], "aria-readonly": "true" };
    // @ts-expect-error The `<select>` carries it.
    const select: SelectRootProps = { "aria-readonly": "true" };
    // @ts-expect-error Each Thumb's input carries it.
    const thumb: SliderThumbProps = { "aria-readonly": "true" };
    // @ts-expect-error The MultiSelect Trigger (`combobox`) carries it.
    const trigger: MultiSelectTriggerProps = { "aria-readonly": "true" };
    expect([checkbox, switchProps, radioRoot, item, parent, select, thumb, trigger]).toHaveLength(
      8,
    );
  });

  it("items and inner parts take no readOnly", () => {
    // @ts-expect-error The value is the Root's.
    const radio: RadioGroupItemProps = { value: "a", readOnly: true };
    // @ts-expect-error The value is the Root's.
    const item: CheckboxGroupItemProps = { value: "a", readOnly: true };
    // @ts-expect-error The value is the Root's.
    const parent: CheckboxGroupParentProps = { values: ["a"], readOnly: true };
    // @ts-expect-error The value is the Root's.
    const input: ComboboxInputProps = { readOnly: true };
    // @ts-expect-error The value is the Root's.
    const option: SelectOptionProps = { value: "a", readOnly: true };
    // @ts-expect-error The value is the Root's.
    const thumb: SliderThumbProps = { readOnly: true };
    // @ts-expect-error The value is the Root's.
    const numberInput: NumberFieldInputProps = { readOnly: true };
    // @ts-expect-error The value is the Root's.
    const otpInput: OTPFieldInputProps = { readOnly: true };
    expect([radio, item, parent, input, option, thumb, numberInput, otpInput]).toHaveLength(8);
  });

  it("Toggle is not a form control: no readOnly (rule 14)", () => {
    // @ts-expect-error A toggle the user may not change is `disabled`.
    const toggle: ToggleProps = { readOnly: true };
    expect(toggle).toBeDefined();
  });
});

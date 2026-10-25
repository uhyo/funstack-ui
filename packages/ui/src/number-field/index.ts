// Ships the platform attribute typings with this subpath (conventions 7.4). Type-only: the
// built JS has no import of it.
import "../internal/platform-attributes.js";
import { NumberFieldDecrement } from "./number-field-decrement.js";
import { NumberFieldIncrement } from "./number-field-increment.js";
import { NumberFieldInput } from "./number-field-input.js";
import { NumberFieldLabel } from "./number-field-label.js";
import { NumberFieldRoot } from "./number-field-root.js";

/**
 * NumberField: a text field that holds a number. `Root` (`div[role=group]`, owns the state),
 * `Label`, `Input` (the visible `input[type=text]` plus a visually hidden native
 * `input[type=number]` that carries `name`, the constraints and the posted value), and the
 * `Increment` / `Decrement` buttons (press-and-hold). The user types in their locale's notation
 * (committed on blur or Enter) or steps with the keys and buttons. Two actions:
 * `valueChangeAction` on every step (a transition; keep it cheap) and `valueCommitAction` once
 * per gesture (the save; uncontrolled state is committed when it resolves).
 *
 * @see https://ui.funstack.work/components/number-field
 */
export const NumberField = {
  Root: NumberFieldRoot,
  Label: NumberFieldLabel,
  Input: NumberFieldInput,
  Increment: NumberFieldIncrement,
  Decrement: NumberFieldDecrement,
} as const;

export type {
  NumberFieldRootProps,
  NumberFieldState,
  NumberFieldValueChangeDetails,
} from "./number-field-root.js";
export type { NumberFieldLabelProps } from "./number-field-label.js";
export type { NumberFieldInputProps } from "./number-field-input.js";
export type {
  NumberFieldButtonState,
  NumberFieldIncrementProps,
  NumberFieldDecrementProps,
} from "./use-step-button.js";

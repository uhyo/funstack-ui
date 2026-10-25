import { FieldControl } from "./field-control.js";
import { FieldDescription } from "./field-description.js";
import { FieldError } from "./field-error.js";
import { FieldLabel } from "./field-label.js";
import { FieldRoot } from "./field-root.js";

/**
 * Field (labelled, described, validated form control): `Root` (`div`, owns the ids and the field's
 * state) > `Label` (`label[for]`), `Control` (`input`, or any FUNSTACK form control in its place),
 * `Description` (`p`), `Error` (`div`, rendered only while invalid). The browser's constraint
 * validation and `:user-invalid` decide when an error shows; the library adds the ARIA wiring, a
 * styleable error, and server errors from `Form.Root`.
 *
 * @see https://ui.funstack.work/components/field
 */
export const Field = {
  Root: FieldRoot,
  Label: FieldLabel,
  Control: FieldControl,
  Description: FieldDescription,
  Error: FieldError,
} as const;

export type { FieldRootProps, FieldState, FieldValidity, FieldValidate } from "./field-root.js";
export type { FieldLabelProps } from "./field-label.js";
export type { FieldControlProps } from "./field-control.js";
export type { FieldDescriptionProps } from "./field-description.js";
export type { FieldErrorProps } from "./field-error.js";

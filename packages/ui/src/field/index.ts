import { FieldControl } from "./field-control.js";
import { FieldDescription } from "./field-description.js";
import { FieldError } from "./field-error.js";
import { FieldLabel } from "./field-label.js";
import { FieldRoot } from "./field-root.js";

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

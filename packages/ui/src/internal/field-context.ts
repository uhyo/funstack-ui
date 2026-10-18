"use client";
import { createContext, use } from "react";
import type { FieldValidity, FormErrors } from "./validity.js";

/** The state every Field part receives (design/components/field-form.md 4.1). */
export interface FieldState {
  /** An error is shown: the control matches `:user-invalid`, or a server error for this field is shown. */
  readonly invalid: boolean;
  /** The messages shown: `[validationMessage]` for a native constraint, the strings `validate` returned for a custom one, the server's strings for a server error; `[]` while valid. */
  readonly messages: readonly string[];
  /** A snapshot of the control's `ValidityState` (all valid on the server and before the first read). */
  readonly validity: FieldValidity;
  /** `Field.Root disabled` or the control's own `disabled`. */
  readonly disabled: boolean;
  /** `Field.Root required` or the control's own `required`. */
  readonly required: boolean;
  /** The enclosing form's submission is in flight (`useFormStatus().pending`); `false` outside a form. */
  readonly pending: boolean;
}

export interface FieldIds {
  readonly control: string;
  readonly label: string;
  readonly description: string;
  readonly error: string;
}

/** What a control reports to its Field (design 7.1). */
export interface FieldControlRegistration {
  /** The element the Field labels, describes and listens to (the input, or a group's fieldset). */
  readonly element: HTMLElement;
  /** `<label for>` can target it. Groups report `false`. */
  readonly labelable: boolean;
  /** The control's own `required` / `disabled` props (for the Field's `data-*` state). */
  readonly required: boolean;
  readonly disabled: boolean;
}

export interface FieldContextValue {
  readonly ids: FieldIds;
  /** `Field.Root name`. */
  readonly name: string | undefined;
  /** `Field.Root disabled` / `required` (the props, not the merged state). */
  readonly disabled: boolean;
  readonly required: boolean;
  readonly state: FieldState;
  /** The registered control is labelable (default `true`, also before any registration). */
  readonly labelable: boolean;
  /** Registers the Field's control; returns the unregister function. The first one wins. */
  readonly registerControl: (registration: FieldControlRegistration) => () => void;
  /** A `Field.Error` is mounted (the Field may cancel the platform bubble). */
  readonly registerError: () => () => void;
}

export const FieldContext = createContext<FieldContextValue | null>(null);

export function useFieldContext(part: string): FieldContextValue {
  const ctx = use(FieldContext);
  if (ctx === null) throw new Error(`${part} must be rendered inside a Field.Root.`);
  return ctx;
}

/** What a Field registers with its Form (design 3.5). */
export interface FormFieldRegistration {
  /** The control, or a group's first enabled (or checked) member. */
  readonly getFocusTarget: () => HTMLElement | null;
  /** The Field shows a server error at the latest commit. */
  readonly showsServerError: () => boolean;
}

export interface FormContextValue {
  readonly errors: FormErrors | undefined;
  readonly registerField: (registration: FormFieldRegistration) => () => void;
  /**
   * The `FormData` of the submission in flight when the Form ran it itself (the intercepted path),
   * else `null`: the stale-value suppression of design 3.2 item 2 is computed against it.
   */
  readonly submittedData: () => FormData | null;
}

export const FormContext = createContext<FormContextValue | null>(null);

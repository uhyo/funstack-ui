"use client";
import { use, useCallback } from "react";
import { FieldContext } from "./field-context.js";

/** Writes the control's own entries for the requested value into a `FormData`. */
export type NextValidityPatch = ((formData: FormData) => void) | null;

/**
 * `details.valid` (conventions 2.2, design/components/field-form.md 7.5): returns a function for
 * event handlers, `(native, patch) => native && custom`. `native` is the control's half (its
 * native constraints for the requested value); `custom` is the enclosing Field's `validate` for
 * the form's data with `patch` applied (`null` when the form's DOM already holds the value).
 * Outside a Field `custom` is `true`. Reads the latest `validate`; writes no state and no
 * custom-validity slot (the Field's own refresh does that after the dispatch).
 */
export function useNextValidity(): (native: boolean, patch: NextValidityPatch) => boolean {
  const validateNext = use(FieldContext)?.validateNext;
  return useCallback(
    (native: boolean, patch: NextValidityPatch): boolean =>
      native && (validateNext?.(patch) ?? true),
    [validateNext],
  );
}

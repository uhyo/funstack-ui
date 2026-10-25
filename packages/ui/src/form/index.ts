import { FormRoot } from "./form-root.js";
import { FormSubmit } from "./form-submit.js";

/**
 * Form: `Root` (`form`) runs its `action` in a transition with `data-pending`, routes server
 * `errors` to the matching `Field.Root`s, focuses the first invalid field and resets only when the
 * action reported no errors; `Submit` (`button[type=submit]`) shows the form's pending state.
 *
 * @see https://ui.funstack.work/components/field
 */
export const Form = { Root: FormRoot, Submit: FormSubmit } as const;

export type { FormRootProps, FormRootState, FormErrors, FieldErrorValue } from "./form-root.js";
export type { FormSubmitProps, FormSubmitState } from "./form-submit.js";

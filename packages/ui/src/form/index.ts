import { FormRoot } from "./form-root.js";
import { FormSubmit } from "./form-submit.js";

export const Form = { Root: FormRoot, Submit: FormSubmit } as const;

export type { FormRootProps, FormRootState, FormErrors, FieldErrorValue } from "./form-root.js";
export type { FormSubmitProps, FormSubmitState } from "./form-submit.js";

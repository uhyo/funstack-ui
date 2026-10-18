"use client";
import { useActionState } from "react";
import { Field } from "@funstack/ui/field";
import { Form } from "@funstack/ui/form";
import type { FormErrors } from "@funstack/ui/form";
import { sleep } from "./fake-api.js";

interface SignUpState {
  readonly errors?: FormErrors;
  readonly created?: string;
}

// A pretend Server Function. It validates on the server and returns field errors keyed by
// name; it never throws for bad input, which is what `useActionState` is for.
async function signUp(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  await sleep(900);
  const email = String(formData.get("email"));
  const handle = String(formData.get("handle"));
  const errors: Record<string, string> = {};
  if (email.toLowerCase() === "taken@example.com") {
    errors["email"] = "This email is already registered.";
  }
  if (handle.toLowerCase().includes("admin")) errors["handle"] = "That handle is reserved.";
  if (Object.keys(errors).length > 0) return { errors };
  return { created: handle };
}

// Try: submit empty (the browser's messages, the first field focused); a short password; a
// mismatched confirmation (re-checked when either field changes); "taken@example.com" or a
// handle containing "admin" (server errors, focused, gone on the next keystroke). A successful
// sign-up resets the form; a failed one keeps every value.
export function FieldSignUp() {
  const [state, formAction] = useActionState(signUp, {});
  return (
    <Form.Root action={formAction} errors={state.errors} className="demo-form">
      <Field.Root name="email" required className="demo-fieldset">
        <Field.Label className="demo-label">Email</Field.Label>
        <Field.Control type="email" autoComplete="off" className="demo-input" />
        <Field.Description className="demo-description">We never share it.</Field.Description>
        <Field.Error className="demo-field-error" />
      </Field.Root>
      <Field.Root name="handle" required className="demo-fieldset">
        <Field.Label className="demo-label">Handle</Field.Label>
        <Field.Control
          pattern="[a-z0-9_]+"
          autoComplete="off"
          className="demo-input"
          aria-describedby="handle-hint"
        />
        <p id="handle-hint" className="demo-description">
          Lowercase letters, digits and underscores.
        </p>
        <Field.Error className="demo-field-error">
          {({ validity, messages }) =>
            validity.patternMismatch
              ? "Use lowercase letters, digits and underscores."
              : messages.join(" ")
          }
        </Field.Error>
      </Field.Root>
      <Field.Root name="password" required className="demo-fieldset">
        <Field.Label className="demo-label">Password</Field.Label>
        <Field.Control
          type="password"
          minLength={8}
          autoComplete="new-password"
          className="demo-input"
        />
        <Field.Error className="demo-field-error">
          {({ validity, messages }) =>
            validity.tooShort ? "Use at least 8 characters." : messages.join(" ")
          }
        </Field.Error>
      </Field.Root>
      <Field.Root
        name="confirm"
        required
        className="demo-fieldset"
        validate={(value, formData) =>
          value === formData.get("password") ? null : "Passwords do not match."
        }
      >
        <Field.Label className="demo-label">Confirm password</Field.Label>
        <Field.Control type="password" autoComplete="new-password" className="demo-input" />
        <Field.Error className="demo-field-error" />
      </Field.Root>
      <div className="demo-row">
        <Form.Submit className="demo-button demo-primary demo-submit">
          {({ pending }) => (
            <>
              {pending && <span className="demo-spinner" aria-hidden />}
              {pending ? "Creating…" : "Create account"}
            </>
          )}
        </Form.Submit>
        <button type="reset" className="demo-button">
          Reset
        </button>
      </div>
      {state.created !== undefined && (
        <output className="demo-readout">
          Created <code>@{state.created}</code> (the form was reset).
        </output>
      )}
    </Form.Root>
  );
}

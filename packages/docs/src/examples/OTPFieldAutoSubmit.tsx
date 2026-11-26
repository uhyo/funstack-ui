"use client";
import { useActionState } from "react";
import { Field } from "@funstack/ui/field";
import { Form } from "@funstack/ui/form";
import type { FormErrors } from "@funstack/ui/form";
import { OTPField } from "@funstack/ui/otp-field";
import { sleep } from "./fake-api.js";

const SLOTS = [0, 1, 2, 3, 4, 5];

interface VerifyState {
  readonly errors?: FormErrors;
  readonly signedIn?: boolean;
}

// A pretend Server Function: it checks the code and returns a field error for a wrong one.
async function verify(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  await sleep(900);
  if (formData.get("code") !== "123456") {
    return { errors: { code: "That code has expired. We sent you a new one." } };
  }
  return { signedIn: true };
}

// The code is submitted as soon as it is complete (`submitOnComplete`): the form's pending
// shows on the button, a wrong code comes back as the Field's error with focus on the input,
// and the next keystroke dismisses it. The description says so before the field (WCAG 3.2.2),
// and the button stays for a user who wants to check the code first. Try 111111, then 123456.
export function OTPFieldAutoSubmit() {
  const [state, formAction] = useActionState(verify, {});
  if (state.signedIn === true) {
    return <p className="demo-readout">Signed in.</p>;
  }
  return (
    <Form.Root action={formAction} errors={state.errors} className="demo-form">
      <Field.Root name="code" required className="demo-fieldset">
        <Field.Label className="demo-label">Sign-in code</Field.Label>
        <Field.Description className="demo-description">
          The 6-digit code from your authenticator app. It is submitted when complete.
        </Field.Description>
        <OTPField.Root length={6} submitOnComplete className="demo-otp">
          <OTPField.Input className="demo-otp-input" title="6 digits" />
          {SLOTS.map((i) => (
            <OTPField.Slot key={i} index={i} className="demo-otp-slot" />
          ))}
        </OTPField.Root>
        <Field.Error className="demo-field-error">
          {({ validity, messages }) =>
            validity.patternMismatch ? "Enter all 6 digits." : messages.join(" ")
          }
        </Field.Error>
      </Field.Root>
      <div className="demo-row">
        <Form.Submit className="demo-button demo-primary demo-submit">
          {({ pending }) => (
            <>
              {pending && <span className="demo-spinner" aria-hidden />}
              Verify
            </>
          )}
        </Form.Submit>
      </div>
    </Form.Root>
  );
}

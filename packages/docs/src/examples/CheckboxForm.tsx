"use client";
import { startTransition, useState } from "react";
import { useFormStatus } from "react-dom";
import { Checkbox } from "@funstack/ui/checkbox";
import { fakeSave } from "./fake-api.js";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="demo-button demo-primary">
      {pending && <span className="demo-spinner" aria-hidden />}
      Sign up
    </button>
  );
}

// No change actions: native form participation. `required` blocks the submit until the terms
// box is checked (and :user-invalid styles it after the attempt). After the form action succeeds
// React resets the form to the `defaultChecked` values; the Reset button does the same.
export function CheckboxForm() {
  const [submitted, setSubmitted] = useState("(nothing yet)");
  return (
    <form
      className="demo-stack"
      action={async (formData) => {
        await fakeSave("the form");
        startTransition(() => setSubmitted(JSON.stringify([...formData])));
      }}
    >
      <label className="demo-field">
        <Checkbox className="demo-checkbox" name="updates" value="yes" defaultChecked />
        Send me product updates
      </label>
      <label className="demo-field">
        <Checkbox className="demo-checkbox" name="terms" required />I accept the terms (required)
      </label>
      <div className="demo-row">
        <SubmitButton />
        <button type="reset" className="demo-button">
          Reset
        </button>
      </div>
      <output className="demo-readout">
        last submitted: <code>{submitted}</code>
      </output>
    </form>
  );
}

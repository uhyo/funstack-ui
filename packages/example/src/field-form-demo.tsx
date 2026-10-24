import { useActionState } from "react";
import { Checkbox } from "@funstack/ui/checkbox";
import { Combobox } from "@funstack/ui/combobox";
import { Field } from "@funstack/ui/field";
import { Form } from "@funstack/ui/form";
import type { FormErrors } from "@funstack/ui/form";
import { RadioGroup } from "@funstack/ui/radio-group";
import { Select } from "@funstack/ui/select";
import { DemoErrorBoundary } from "./shared/DemoErrorBoundary";
import { sleep } from "./shared/fake-backend";
import "./field-form-demo.css";

interface State {
  readonly errors?: FormErrors;
  readonly done?: string;
}

/** Fake Server Function: field errors for "taken@example.com" and an "admin" handle. */
async function signUp(_prev: State, formData: FormData): Promise<State> {
  console.log("[sign-up] submitting", Object.fromEntries(formData));
  await sleep(1000);
  if (formData.get("handle") === "crash") throw new Error("[sign-up] the server crashed");
  const errors: Record<string, string> = {};
  if (formData.get("email") === "taken@example.com") errors["email"] = "Already registered.";
  if (String(formData.get("handle")).includes("admin")) errors["handle"] = "Reserved.";
  console.log("[sign-up] result", errors);
  if (Object.keys(errors).length > 0) return { errors };
  return { done: String(formData.get("handle")) };
}

function SignUp() {
  const [state, formAction] = useActionState(signUp, {});
  return (
    <Form.Root action={formAction} errors={state.errors} className="ff-form">
      <Field.Root name="email" required className="ff-field">
        <Field.Label>Email</Field.Label>
        <Field.Control type="email" className="ff-input" />
        <Field.Description className="ff-description">
          "taken@example.com" is already registered.
        </Field.Description>
        <Field.Error className="ff-error" />
      </Field.Root>
      <Field.Root name="handle" required className="ff-field">
        <Field.Label>Handle</Field.Label>
        <Field.Control pattern="[a-z0-9_]+" className="ff-input" />
        <Field.Description className="ff-description">
          A handle containing "admin" is reserved; "crash" makes the action throw.
        </Field.Description>
        <Field.Error className="ff-error" />
      </Field.Root>
      <Field.Root name="password" required className="ff-field">
        <Field.Label>Password</Field.Label>
        <Field.Control type="password" minLength={8} className="ff-input" />
        <Field.Error className="ff-error" />
      </Field.Root>
      <Field.Root
        name="confirm"
        required
        className="ff-field"
        validate={(value, formData) =>
          value === formData.get("password") ? null : "Passwords do not match."
        }
      >
        <Field.Label>Confirm password</Field.Label>
        <Field.Control type="password" className="ff-input" />
        <Field.Error className="ff-error" />
      </Field.Root>
      <Field.Root name="plan" required className="ff-field">
        <Field.Label>Plan</Field.Label>
        <RadioGroup.Root className="ff-row">
          <label>
            <RadioGroup.Item value="free" /> Free
          </label>
          <label>
            <RadioGroup.Item value="pro" /> Pro
          </label>
        </RadioGroup.Root>
        <Field.Error className="ff-error" />
      </Field.Root>
      <Field.Root name="size" required className="ff-field">
        <Field.Label>T-shirt size</Field.Label>
        <Select.Root defaultValue="">
          <Select.Option value="" disabled>
            Choose a size
          </Select.Option>
          <Select.Option value="m">Medium</Select.Option>
          <Select.Option value="l">Large</Select.Option>
        </Select.Root>
        <Field.Error className="ff-error" />
      </Field.Root>
      <Field.Root name="country" required className="ff-field">
        <Field.Label>Country</Field.Label>
        <Combobox.Root>
          <Combobox.Input className="ff-input" />
          <Combobox.Popup className="ff-popup">
            <Combobox.List>
              <Combobox.Option value="jp">Japan</Combobox.Option>
              <Combobox.Option value="fr">France</Combobox.Option>
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Root>
        <Field.Error className="ff-error" />
      </Field.Root>
      <Field.Root name="terms" required className="ff-field ff-inline">
        <Checkbox />
        <Field.Label>I accept the terms</Field.Label>
        <Field.Error className="ff-error" />
      </Field.Root>
      <div className="ff-row">
        <Form.Submit className="ff-submit">
          {({ pending }) => (pending ? "Creating…" : "Create account")}
        </Form.Submit>
        <button type="reset">Reset</button>
      </div>
      {state.done !== undefined && <p>Created @{state.done}; the form was reset.</p>}
    </Form.Root>
  );
}

export function FieldFormDemo() {
  return (
    <section>
      <h2>Field and Form</h2>
      <p>
        Native validation shown with <code>:user-invalid</code> timing, the bubble replaced by{" "}
        <code>Field.Error</code>, the first invalid control focused, server errors routed to their
        fields (dismissed by the next edit), and a reset only after a submission with no errors.
      </p>
      <DemoErrorBoundary className="ff-error-box">
        <SignUp />
      </DemoErrorBoundary>
    </section>
  );
}

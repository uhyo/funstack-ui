import { useActionState, useState } from "react";
import { Checkbox } from "@funstack/ui/checkbox";
import { Combobox } from "@funstack/ui/combobox";
import { Field } from "@funstack/ui/field";
import { Form } from "@funstack/ui/form";
import type { FormErrors } from "@funstack/ui/form";
import { RadioGroup } from "@funstack/ui/radio-group";
import { Select } from "@funstack/ui/select";
import { Slider } from "@funstack/ui/slider";
import { Switch } from "@funstack/ui/switch";
import { DemoErrorBoundary } from "./shared/DemoErrorBoundary.js";
import { sleep } from "./shared/fake-backend.js";
import { Demo } from "./shared/Demo.js";
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

/**
 * `readOnly` on every Field (conventions 3.6.1): the values stay focusable and are submitted,
 * nothing changes them, and a read-only `required` control never blocks the submission.
 */
function LockedProfile() {
  const [locked, setLocked] = useState(true);
  const [posted, setPosted] = useState<string | null>(null);
  return (
    <Form.Root className="ff-form" action={(formData) => setPosted(JSON.stringify([...formData]))}>
      <label className="ff-inline">
        <Switch checked={locked} checkedChangeAction={setLocked} /> Locked (read-only)
      </label>
      <Field.Root name="name" readOnly={locked} required className="ff-field">
        <Field.Label>Name</Field.Label>
        <Field.Control defaultValue="Ada Lovelace" className="ff-input" />
      </Field.Root>
      <Field.Root name="country" readOnly={locked} className="ff-field">
        <Field.Label>Country</Field.Label>
        <Select.Root defaultValue="gb" className="ff-input">
          <Select.Option value="gb">United Kingdom</Select.Option>
          <Select.Option value="fr">France</Select.Option>
          <Select.Option value="jp">Japan</Select.Option>
        </Select.Root>
      </Field.Root>
      <Field.Root name="plan" readOnly={locked} required className="ff-field">
        <Field.Label>Plan</Field.Label>
        <RadioGroup.Root defaultValue="pro" className="ff-row">
          <label>
            <RadioGroup.Item value="free" /> Free
          </label>
          <label>
            <RadioGroup.Item value="pro" /> Pro
          </label>
        </RadioGroup.Root>
      </Field.Root>
      <Field.Root name="volume" readOnly={locked} className="ff-field">
        <Field.Label>Volume</Field.Label>
        <Slider.Root defaultValue={40}>
          <Slider.Track className="ff-track">
            <Slider.Indicator className="ff-fill" />
            <Slider.Thumb className="ff-thumb" />
          </Slider.Track>
        </Slider.Root>
      </Field.Root>
      <Field.Root name="news" readOnly={locked} required className="ff-field ff-inline">
        <Checkbox />
        <Field.Label>Newsletter (required, unchecked: never blocks while read-only)</Field.Label>
        <Field.Error className="ff-error" />
      </Field.Root>
      <div className="ff-row">
        <Form.Submit className="ff-submit">Save</Form.Submit>
      </div>
      {posted !== null && <p>Posted: {posted}</p>}
    </Form.Root>
  );
}

export function FieldFormDemo() {
  return (
    <Demo title="Field and Form">
      <p>
        Native validation shown with <code>:user-invalid</code> timing, the bubble replaced by{" "}
        <code>Field.Error</code>, the first invalid control focused, server errors routed to their
        fields (dismissed by the next edit), and a reset only after a submission with no errors.
      </p>
      <DemoErrorBoundary className="ff-error-box">
        <SignUp />
      </DemoErrorBoundary>
      <h3>Read-only</h3>
      <p>
        <code>Field.Root readOnly</code> on every control: focus, read and submit the values;
        nothing changes them. Style it with <code>[data-readonly]</code>.
      </p>
      <LockedProfile />
    </Demo>
  );
}

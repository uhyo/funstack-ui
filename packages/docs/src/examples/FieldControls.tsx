"use client";
import { startTransition, useState } from "react";
import { Checkbox } from "@funstack/ui/checkbox";
import { Field } from "@funstack/ui/field";
import { Form } from "@funstack/ui/form";
import type { FormErrors } from "@funstack/ui/form";
import { RadioGroup } from "@funstack/ui/radio-group";
import { Switch } from "@funstack/ui/switch";
import { fakeSave } from "./fake-api.js";

// FUNSTACK controls are a Field's control as they are: the Field labels and describes them,
// gives them its `name` / `required` / `disabled`, and shows their native validation. The Switch
// saves on its own (its own `data-pending`); the form's submission is the Field's `data-pending`.
// `autoReset={false}`: a settings form keeps its values after a successful save.
export function FieldControls() {
  const [errors, setErrors] = useState<FormErrors>({});
  const [saved, setSaved] = useState<string | null>(null);
  return (
    <Form.Root
      className="demo-form"
      autoReset={false}
      errors={errors}
      action={async (formData) => {
        await fakeSave("the profile");
        const bio = String(formData.get("bio"));
        startTransition(() => {
          setErrors(bio.includes("http") ? { bio: "Links are not allowed in the bio." } : {});
          setSaved(bio.includes("http") ? null : `plan=${String(formData.get("plan"))}`);
        });
      }}
    >
      <Field.Root name="plan" required className="demo-fieldset">
        <Field.Label className="demo-label">Plan</Field.Label>
        <RadioGroup.Root className="demo-radio-row">
          <label className="demo-field">
            <RadioGroup.Item value="free" className="demo-radio" /> Free
          </label>
          <label className="demo-field">
            <RadioGroup.Item value="pro" className="demo-radio" /> Pro
          </label>
        </RadioGroup.Root>
        <Field.Description className="demo-description">You can change it later.</Field.Description>
        <Field.Error className="demo-field-error" />
      </Field.Root>
      <Field.Root name="bio" className="demo-fieldset">
        <Field.Label className="demo-label">Bio</Field.Label>
        <Field.Control
          render={<textarea rows={1} maxLength={280} />}
          className="demo-input demo-grow"
        />
        <Field.Description className="demo-description">
          Grows as you type (<code>field-sizing: content</code>). Links are rejected by the server.
        </Field.Description>
        <Field.Error className="demo-field-error" />
      </Field.Root>
      <Field.Root name="news" className="demo-fieldset demo-fieldset-inline">
        <Checkbox className="demo-checkbox" />
        <Field.Label className="demo-label">Email me product news</Field.Label>
      </Field.Root>
      <Field.Root name="terms" required className="demo-fieldset demo-fieldset-inline">
        <Checkbox className="demo-checkbox" />
        <Field.Label className="demo-label">I accept the terms</Field.Label>
        <Field.Error className="demo-field-error" />
      </Field.Root>
      <Field.Root name="beta" className="demo-fieldset demo-fieldset-inline">
        <Switch
          className="demo-switch"
          checkedChangeAction={() => fakeSave("the beta setting", { ms: 1200 })}
        />
        <Field.Label className="demo-label">Beta features (saves on its own)</Field.Label>
      </Field.Root>
      <div className="demo-row">
        <Form.Submit className="demo-button demo-primary demo-submit">
          {({ pending }) => (
            <>
              {pending && <span className="demo-spinner" aria-hidden />}
              Save
            </>
          )}
        </Form.Submit>
      </div>
      {saved !== null && (
        <output className="demo-readout">
          Saved <code>{saved}</code>; the values stay (<code>autoReset=&#123;false&#125;</code>).
        </output>
      )}
    </Form.Root>
  );
}

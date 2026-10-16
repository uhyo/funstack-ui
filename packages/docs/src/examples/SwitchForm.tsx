"use client";
import { startTransition, useState } from "react";
import { useFormStatus } from "react-dom";
import { Switch } from "@funstack/ui/switch";
import { fakeSave } from "./fake-api.js";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="demo-button demo-primary">
      {pending && <span className="demo-spinner" aria-hidden />}
      Save
    </button>
  );
}

// No change actions: the switches are native checkboxes that post `name=value` with the form.
// After the form action succeeds React resets the form; the saved values are the new
// `defaultChecked`, so the reset lands on what was saved. The Reset button goes through the same
// path (the browser restores `defaultChecked`; the Switch follows with reason "platform").
export function SwitchForm() {
  const [saved, setSaved] = useState({ newsletter: false, digest: true });
  const [submitted, setSubmitted] = useState("(nothing yet)");
  return (
    <form
      className="demo-stack"
      action={async (formData) => {
        await fakeSave("the settings");
        const next = {
          newsletter: formData.get("newsletter") === "on",
          digest: formData.get("digest") === "weekly",
        };
        startTransition(() => {
          setSaved(next);
          setSubmitted(JSON.stringify([...formData]));
        });
      }}
    >
      <label className="demo-field">
        <Switch className="demo-switch" name="newsletter" defaultChecked={saved.newsletter} />
        Newsletter
      </label>
      <label className="demo-field">
        <Switch
          className="demo-switch"
          name="digest"
          value="weekly"
          defaultChecked={saved.digest}
        />
        Weekly digest
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

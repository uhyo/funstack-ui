"use client";
import { useState } from "react";
import { Field } from "@funstack/ui/field";
import { Form } from "@funstack/ui/form";
import { Progress } from "@funstack/ui/progress";
import { sleep } from "./fake-api.js";

// An indeterminate bar while the form submits, read from Form.Root's children(state). The
// region being replaced carries aria-busy and is described by the bar (the APG's advice): the
// progressbar never sets aria-busy itself.
export function ProgressForm() {
  const [saved, setSaved] = useState("Ada Lovelace");
  return (
    <Form.Root
      className="demo-form"
      action={async (formData) => {
        await sleep(1500);
        setSaved(String(formData.get("name")));
      }}
    >
      {({ pending }) => (
        <>
          <Field.Root name="name" required className="demo-fieldset">
            <Field.Label className="demo-label">Display name</Field.Label>
            <Field.Control defaultValue={saved} autoComplete="off" className="demo-input" />
          </Field.Root>
          <div className="demo-row">
            <Form.Submit className="demo-button demo-primary">Save</Form.Submit>
            {pending && (
              <Progress.Root id="saving" aria-label="Saving" className="demo-progress demo-grow">
                <Progress.Track className="demo-progress-track">
                  <Progress.Indicator className="demo-progress-fill" />
                </Progress.Track>
              </Progress.Root>
            )}
          </div>
          <p
            className="demo-readout"
            aria-busy={pending}
            aria-describedby={pending ? "saving" : undefined}
          >
            Saved name: <strong>{saved}</strong>
          </p>
        </>
      )}
    </Form.Root>
  );
}

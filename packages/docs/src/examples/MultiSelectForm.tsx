"use client";
import { startTransition, useState } from "react";
import { useFormStatus } from "react-dom";
import { Field } from "@funstack/ui/field";
import { MultiSelect } from "@funstack/ui/multi-select";
import { fakeSave } from "./fake-api.js";

const DAYS = [
  ["mon", "Monday"],
  ["tue", "Tuesday"],
  ["wed", "Wednesday"],
  ["thu", "Thursday"],
  ["fri", "Friday"],
] as const;
const NAMES: Record<string, string> = Object.fromEntries(DAYS);

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="demo-button demo-primary">
      {pending && <span className="demo-spinner" aria-hidden />}
      Save
    </button>
  );
}

// `required` means at least one day. A hidden validity element blocks the submit while nothing is
// selected; the browser shows no bubble of its own, so the message is `Field.Error`'s and focus
// lands on the Trigger. The form posts one `days` entry per value, in pick order.
export function MultiSelectForm() {
  const [posted, setPosted] = useState<string[] | null>(null);
  return (
    <form
      className="demo-stack"
      action={async (formData) => {
        await fakeSave("the schedule");
        const days = formData.getAll("days").map(String);
        startTransition(() => setPosted(days));
      }}
    >
      <Field.Root name="days" required className="demo-stack">
        <Field.Label className="demo-field">Office days</Field.Label>
        <MultiSelect.Root>
          <MultiSelect.Trigger className="demo-multi-select-trigger">
            <MultiSelect.Value placeholder="Choose days">
              {({ value }) =>
                value.length === 0 ? "Choose days" : value.map((v) => NAMES[v] ?? v).join(", ")
              }
            </MultiSelect.Value>
            <span className="demo-multi-select-chevron" aria-hidden>
              ▾
            </span>
          </MultiSelect.Trigger>
          <MultiSelect.Popup className="demo-multi-select-popup">
            <MultiSelect.List>
              {DAYS.map(([value, name]) => (
                <MultiSelect.Option key={value} value={value} className="demo-multi-select-option">
                  {name}
                </MultiSelect.Option>
              ))}
            </MultiSelect.List>
          </MultiSelect.Popup>
        </MultiSelect.Root>
        <Field.Description className="demo-description">Pick one or more.</Field.Description>
        <Field.Error className="demo-field-error" />
      </Field.Root>
      <div className="demo-row">
        <SubmitButton />
        <button type="reset" className="demo-button">
          Reset
        </button>
      </div>
      <output className="demo-readout">
        posted: <code>{posted === null ? "(nothing yet)" : JSON.stringify(posted)}</code>
      </output>
    </form>
  );
}

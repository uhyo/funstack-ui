"use client";
import { startTransition, useState } from "react";
import { useFormStatus } from "react-dom";
import { RadioGroup } from "@funstack/ui/radio-group";
import type { RadioGroupValueChangeDetails } from "@funstack/ui/radio-group";
import { fakeSave } from "./fake-api.js";

const sizes = [
  { value: "s", label: "Small" },
  { value: "m", label: "Medium" },
  { value: "l", label: "Large" },
  { value: "xl", label: "Extra large (sold out)" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="demo-button demo-primary">
      {pending && <span className="demo-spinner" aria-hidden />}
      Order
    </button>
  );
}

// The radios post `size=…` with the form (a real `name`), and `required` blocks the submit until
// one is checked. After the form action succeeds React resets the form; the ordered size is the
// new `defaultValue`, so the reset returns to it. The Reset button returns to the latest default
// too. `valueChangeAction` here only records what the group was told: user changes arrive with
// reason "activate", resets with reason "platform" (`null` when the reset empties the group).
export function RadioGroupForm() {
  const [ordered, setOrdered] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const record = (next: string | null, { reason, event }: RadioGroupValueChangeDetails) => {
    const entry = `${JSON.stringify(next)} (${reason}, ${event?.type ?? "no event"})`;
    setLog((prev) => [entry, ...prev].slice(0, 4));
  };
  return (
    <form
      className="demo-stack"
      action={async (formData) => {
        await fakeSave("the order");
        const size = formData.get("size");
        startTransition(() => setOrdered(typeof size === "string" ? size : null));
      }}
    >
      <RadioGroup.Root
        className="demo-radio-group"
        name="size"
        required
        defaultValue={ordered}
        valueChangeAction={record}
      >
        <RadioGroup.Label>T-shirt size</RadioGroup.Label>
        {sizes.map((size) => (
          <label key={size.value} className="demo-field">
            <RadioGroup.Item
              value={size.value}
              className="demo-radio"
              disabled={size.value === "xl"}
            />
            {size.label}
          </label>
        ))}
      </RadioGroup.Root>
      <div className="demo-row">
        <SubmitButton />
        <button type="reset" className="demo-button">
          Reset
        </button>
      </div>
      <output className="demo-readout">
        ordered: <code>{JSON.stringify(ordered)}</code>
        <br />
        valueChangeAction calls, latest first: <code>{log.join(" · ") || "(none yet)"}</code>
      </output>
    </form>
  );
}

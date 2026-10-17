"use client";
import { startTransition, useState } from "react";
import { useFormStatus } from "react-dom";
import { Select } from "@funstack/ui/select";
import type { SelectValueChangeDetails } from "@funstack/ui/select";
import { fakeSave } from "./fake-api.js";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="demo-button demo-primary">
      {pending && <span className="demo-spinner" aria-hidden />}
      Order
    </button>
  );
}

// The select posts `size=…` with the form (a real `name`). The first option is the placeholder:
// `value=""`, so `required` blocks the submit until a real size is picked, and the select matches
// `:user-invalid` after the attempt. After the form action succeeds React resets the form; the
// ordered size is the new `defaultValue`, so the reset returns to it. `valueChangeAction` only
// records what the Select was told: picks arrive with reason "activate", resets with "platform".
export function SelectForm() {
  const [ordered, setOrdered] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const record = (next: string, { reason, event }: SelectValueChangeDetails) => {
    const entry = `${JSON.stringify(next)} (${reason}, ${event?.type ?? "no event"})`;
    setLog((prev) => [entry, ...prev].slice(0, 4));
  };
  return (
    <form
      className="demo-stack"
      action={async (formData) => {
        await fakeSave("the order");
        const size = formData.get("size");
        startTransition(() => setOrdered(typeof size === "string" ? size : ""));
      }}
    >
      <label className="demo-field" htmlFor="size">
        T-shirt size
      </label>
      <Select.Root
        id="size"
        className="demo-select"
        name="size"
        required
        defaultValue={ordered}
        valueChangeAction={record}
      >
        <Select.Option value="" disabled>
          Choose a size
        </Select.Option>
        <Select.Option value="s">Small</Select.Option>
        <Select.Option value="m">Medium</Select.Option>
        <Select.Option value="l">Large</Select.Option>
        <Select.Option value="xl" disabled>
          Extra large (sold out)
        </Select.Option>
      </Select.Root>
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

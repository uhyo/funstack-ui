"use client";
import { startTransition, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckboxGroup } from "@funstack/ui/checkbox-group";
import type { CheckboxGroupValueChangeDetails } from "@funstack/ui/checkbox-group";
import { fakeSave } from "./fake-api.js";

const permissions = [
  { value: "users:read", label: "Read users", section: "users" },
  { value: "users:write", label: "Edit users", section: "users" },
  { value: "billing:read", label: "Read billing", section: "billing" },
  { value: "billing:write", label: "Edit billing", section: "billing" },
];
const inSection = (section: string) =>
  permissions.filter((p) => p.section === section).map((p) => p.value);

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="demo-button demo-primary">
      {pending && <span className="demo-spinner" aria-hidden />}
      Invite
    </button>
  );
}

// The boxes post `perm=…` once per checked box (a real `name`; read it with
// `formData.getAll("perm")`). `required` on the Root means "at least one": while nothing is
// checked every box is `required`, so the browser blocks the submit with its own message; once
// one is checked nothing is. Two section Parents control their own values. After the form action
// succeeds React resets the form and the group follows: one "platform" dispatch with the diff.
export function CheckboxGroupForm() {
  const [invited, setInvited] = useState<string[] | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const record = (_next: string[], { reason, added, removed }: CheckboxGroupValueChangeDetails) => {
    const entry = `${reason}: +[${added.join(", ")}] −[${removed.join(", ")}]`;
    setLog((prev) => [entry, ...prev].slice(0, 4));
  };
  return (
    <form
      className="demo-stack"
      action={async (formData) => {
        await fakeSave("the invitation");
        const perms = formData.getAll("perm").map(String);
        startTransition(() => setInvited(perms));
      }}
    >
      <CheckboxGroup.Root
        className="demo-checkbox-group"
        name="perm"
        required
        valueChangeAction={record}
      >
        <CheckboxGroup.Label>Permissions (choose at least one)</CheckboxGroup.Label>
        {["users", "billing"].map((section) => (
          <div key={section} className="demo-stack">
            <label className="demo-field">
              <CheckboxGroup.Parent values={inSection(section)} className="demo-checkbox" />
              All {section}
            </label>
            {permissions
              .filter((p) => p.section === section)
              .map((p) => (
                <label key={p.value} className="demo-field demo-nested">
                  <CheckboxGroup.Item value={p.value} className="demo-checkbox" />
                  {p.label}
                </label>
              ))}
          </div>
        ))}
      </CheckboxGroup.Root>
      <div className="demo-row">
        <SubmitButton />
        <button type="reset" className="demo-button">
          Reset
        </button>
      </div>
      <output className="demo-readout">
        invited with: <code>{invited === null ? "(not yet)" : JSON.stringify(invited)}</code>
        <br />
        valueChangeAction calls, latest first: <code>{log.join(" · ") || "(none yet)"}</code>
      </output>
    </form>
  );
}

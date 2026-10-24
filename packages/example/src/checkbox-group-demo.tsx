import { startTransition, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckboxGroup } from "@funstack/ui/checkbox-group";
import type { CheckboxGroupValueChangeDetails } from "@funstack/ui/checkbox-group";
import { fakeSave } from "./shared/fake-backend.js";
import { Demo } from "./shared/Demo.js";
import "./checkbox-group-demo.css";

const toppings = [
  { id: "cheese", label: "Cheese" },
  { id: "ham", label: "Ham" },
  { id: "olives", label: "Olives" },
  { id: "basil", label: "Basil" },
];

function Option({ id, label, disabled }: { id: string; label: string; disabled?: boolean }) {
  return (
    <label className="cg-option">
      <CheckboxGroup.Item value={id} className="cg-box" disabled={disabled ?? false} />
      {label}
      <span className="cg-spinner" aria-hidden />
    </label>
  );
}

/** The functional update keyed by what changed (overlapping saves cannot lose a change). */
function applyDetails(prev: readonly string[], details: CheckboxGroupValueChangeDetails) {
  return [
    ...prev.filter((v) => !details.removed.includes(v)),
    ...details.added.filter((v) => !prev.includes(v)),
  ];
}

function ToppingsDemo() {
  const [selected, setSelected] = useState<string[]>(["cheese"]);
  const [fail, setFail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <section>
      <h3>Select all, controlled, update on success</h3>
      <p>
        The Parent derives its state from the Items: mixed (<code>:indeterminate</code>) while some
        are checked. Its click follows the APG cycle: mixed → all → none → back to the last
        combination you saved → … Each click is one <code>valueChangeAction</code> with{" "}
        <code>added</code> / <code>removed</code>. Turn on failures to see a Parent click roll back
        to mixed after 800 ms.
      </p>
      <label className="cg-option">
        <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} />
        Make saves fail
      </label>
      <CheckboxGroup.Root
        className="cg-group"
        value={selected}
        valueChangeAction={async (next, details) => {
          setError(null);
          try {
            await fakeSave("toppings", next, { fail });
            startTransition(() => setSelected((prev) => applyDetails(prev, details)));
          } catch (e) {
            startTransition(() => setError(e instanceof Error ? e.message : String(e)));
          }
        }}
      >
        <CheckboxGroup.Label>
          {({ pending }) => <>Toppings {pending && <small>(saving...)</small>}</>}
        </CheckboxGroup.Label>
        <label className="cg-option cg-parent">
          <CheckboxGroup.Parent values={toppings.map((t) => t.id)} className="cg-box" />
          All toppings
          <span className="cg-spinner" aria-hidden />
        </label>
        {toppings.map((t) => (
          <Option key={t.id} {...t} />
        ))}
      </CheckboxGroup.Root>
      <output className="cg-readout">
        parent state: <code>{JSON.stringify(selected)}</code>
        {error && <span className="cg-inline-error"> {error}</span>}
      </output>
    </section>
  );
}

function PermissionsDemo() {
  const [log, setLog] = useState<string[]>([]);
  return (
    <section>
      <h3>Section parents, uncontrolled</h3>
      <p>
        Several Parents in one group: each derives from and dispatches for its own{" "}
        <code>values</code>; the top one lists every value and acts as a grand-parent.
      </p>
      <CheckboxGroup.Root
        className="cg-group"
        name="perm"
        defaultValue={["users:read"]}
        valueChangeAction={async (next, details) => {
          await fakeSave("permissions", next);
          startTransition(() =>
            setLog((l) => [
              `+${JSON.stringify(details.added)} -${JSON.stringify(details.removed)}`,
              ...l.slice(0, 3),
            ]),
          );
        }}
      >
        <CheckboxGroup.Label>Permissions</CheckboxGroup.Label>
        <label className="cg-option cg-parent">
          <CheckboxGroup.Parent
            values={["users:read", "users:write", "billing:read", "billing:write"]}
            className="cg-box"
          />
          Everything
        </label>
        <label className="cg-option cg-parent cg-indent">
          <CheckboxGroup.Parent values={["users:read", "users:write"]} className="cg-box" />
          Manage users
        </label>
        <div className="cg-indent2">
          <Option id="users:read" label="Read" />
          <Option id="users:write" label="Write" />
        </div>
        <label className="cg-option cg-parent cg-indent">
          <CheckboxGroup.Parent values={["billing:read", "billing:write"]} className="cg-box" />
          Manage billing
        </label>
        <div className="cg-indent2">
          <Option id="billing:read" label="Read" />
          <Option id="billing:write" label="Write" />
        </div>
      </CheckboxGroup.Root>
      <output className="cg-readout">
        last changes: <code>{log.join(" | ") || "(none)"}</code>
      </output>
    </section>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? "Ordering..." : "Order"}
    </button>
  );
}

function FormDemo() {
  const [saved, setSaved] = useState("(nothing yet)");
  return (
    <section>
      <h3>
        Native form, group <code>required</code>
      </h3>
      <p>
        No change action. <code>required</code> on the Root means &quot;at least one&quot;: every
        box is <code>required</code> while none is checked and none is once one is, so the browser
        blocks an empty submission with its own message and <code>:user-invalid</code>. The form
        posts <code>toppings=…</code> once per checked box; after the action succeeds React resets
        the form and the group follows.
      </p>
      <form
        className="cg-stack"
        action={async (formData) => {
          await fakeSave("order", formData.getAll("toppings"));
          startTransition(() => setSaved(JSON.stringify(formData.getAll("toppings"))));
        }}
      >
        <CheckboxGroup.Root className="cg-group" name="toppings" required>
          <CheckboxGroup.Label>Toppings (choose at least one)</CheckboxGroup.Label>
          <label className="cg-option cg-parent">
            <CheckboxGroup.Parent values={toppings.map((t) => t.id)} className="cg-box" />
            All toppings
          </label>
          {toppings.map((t) => (
            <Option key={t.id} {...t} disabled={t.id === "basil"} />
          ))}
        </CheckboxGroup.Root>
        <div className="cg-buttons">
          <SubmitButton />
          <button type="reset">Reset</button>
        </div>
      </form>
      <output className="cg-readout">
        last order: <code>{saved}</code>
      </output>
    </section>
  );
}

export function CheckboxGroupDemo() {
  return (
    <Demo title="CheckboxGroup">
      <ToppingsDemo />
      <PermissionsDemo />
      <FormDemo />
    </Demo>
  );
}

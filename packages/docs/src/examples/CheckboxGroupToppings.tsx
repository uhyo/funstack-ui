"use client";
import { startTransition, useId, useRef, useState } from "react";
import { CheckboxGroup } from "@funstack/ui/checkbox-group";
import type { CheckboxGroupValueChangeDetails } from "@funstack/ui/checkbox-group";
import { fakeSave } from "./fake-api.js";

const toppings = [
  { value: "cheese", label: "Cheese" },
  { value: "ham", label: "Ham" },
  { value: "olives", label: "Olives" },
  { value: "basil", label: "Basil" },
];

/** The functional update keyed by what changed: overlapping saves can never lose a change. */
function applyChange(prev: readonly string[], change: CheckboxGroupValueChangeDetails) {
  return [
    ...prev.filter((v) => !change.removed.includes(v)),
    ...change.added.filter((v) => !prev.includes(v)),
  ];
}

// Controlled, "update on success": the parent adopts a change only after its save resolves. The
// Parent box derives its checked / mixed state from the Items' optimistic state and its click
// follows the APG cycle: mixed → all → none → the last combination that was saved → … Every
// click is one `valueChangeAction` with `added` / `removed`. A failed save is caught and not
// adopted, so the boxes roll back (the Parent to mixed) when it settles. `aria-controls` on the
// Parent lists the boxes it controls, as in the APG mixed-state example (it passes through).
export function CheckboxGroupToppings() {
  const idPrefix = useId();
  const itemId = (value: string) => `${idPrefix}-${value}`;
  const [selected, setSelected] = useState<string[]>(["cheese"]);
  // Read from a ref: state set inside a pending transition is not visible to a second click.
  const failNext = useRef(false);
  const [failNextShown, setFailNextShown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <CheckboxGroup.Root
        className="demo-checkbox-group"
        value={selected}
        valueChangeAction={async (next, details) => {
          setError(null);
          const fail = failNext.current;
          failNext.current = false;
          if (fail) setFailNextShown(false);
          try {
            await fakeSave(`[${next.join(", ")}]`, { fail });
            startTransition(() => setSelected((prev) => applyChange(prev, details)));
          } catch (e) {
            startTransition(() => setError(e instanceof Error ? e.message : String(e)));
          }
        }}
      >
        <CheckboxGroup.Label>
          {({ pending }) => (
            <>Toppings {pending && <span className="demo-checkbox-group-saving">saving…</span>}</>
          )}
        </CheckboxGroup.Label>
        <label className="demo-field">
          <CheckboxGroup.Parent
            values={toppings.map((t) => t.value)}
            aria-controls={toppings.map((t) => itemId(t.value)).join(" ")}
            className="demo-checkbox"
          />
          All toppings
          <span className="demo-spinner demo-checkbox-group-spinner" aria-hidden />
        </label>
        {toppings.map((topping) => (
          <label key={topping.value} className="demo-field demo-nested">
            <CheckboxGroup.Item
              id={itemId(topping.value)}
              value={topping.value}
              className="demo-checkbox"
            />
            {topping.label}
            <span className="demo-spinner demo-checkbox-group-spinner" aria-hidden />
          </label>
        ))}
      </CheckboxGroup.Root>
      <div className="demo-row demo-options">
        <label className="demo-field">
          <input
            type="checkbox"
            checked={failNextShown}
            onChange={(e) => {
              failNext.current = e.target.checked;
              setFailNextShown(e.target.checked);
            }}
          />
          Make the next save fail
        </label>
      </div>
      <output className="demo-readout">
        saved toppings: <code>{selected.join(", ") || "none"}</code>
        {error && <span className="demo-inline-error"> {error}</span>}
      </output>
    </>
  );
}

import { Component, startTransition, useOptimistic, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Checkbox } from "@funstack/ui/checkbox";
import { Switch } from "@funstack/ui/switch";
import "./switch-checkbox-demo.css";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Fake backend: resolves after 800 ms; rejects when asked to. */
async function fakeSave(label: string, value: unknown, { fail = false } = {}): Promise<void> {
  console.log(`[${label}] saving ${JSON.stringify(value)}`);
  await sleep(800);
  if (fail) throw new Error(`[${label}] the server rejected ${JSON.stringify(value)}`);
  console.log(`[${label}] saved ${JSON.stringify(value)}`);
}

class DemoErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="error-box">
          <p>Error Boundary caught: {this.state.error.message}</p>
          <button type="button" onClick={() => this.setState({ error: null })}>
            Reset
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AutosaveDemo() {
  return (
    <section>
      <h3>Uncontrolled, async save</h3>
      <p>
        The input flips at once (the DOM <code>checked</code> is the optimistic value), shows{" "}
        <code>data-pending</code> for 800 ms, then keeps the value. The switch is the bare input
        styled with <code>appearance: none</code> and <code>::before</code>; the checkbox row uses{" "}
        <code>label:has(:checked)</code>.
      </p>
      <div className="stack">
        <label className="row">
          <Switch
            className="sc-switch"
            defaultChecked
            checkedChangeAction={(next) => fakeSave("notifications", next)}
          />
          Email notifications
        </label>
        <label className="row">
          <Checkbox
            className="sc-checkbox"
            checkedChangeAction={(next) => fakeSave("done", next)}
          />
          Mark the task as done
        </label>
      </div>
    </section>
  );
}

function RejectingDemo() {
  return (
    <section>
      <h3>Rejecting action inside an Error Boundary</h3>
      <p>The save rejects after 800 ms; the boundary around the switch shows the error.</p>
      <DemoErrorBoundary>
        <label className="row">
          <Switch
            className="sc-switch"
            checkedChangeAction={(next) => fakeSave("rejecting", next, { fail: true })}
          />
          Beta features (always fails)
        </label>
      </DemoErrorBoundary>
    </section>
  );
}

function ControlledVetoDemo() {
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saves = useRef(0);
  return (
    <section>
      <h3>Controlled, update on success (veto)</h3>
      <p>
        The parent adopts the value only when the save succeeds. Every second save fails and is
        caught inside the action, so the switch flips back (the DOM follows the rollback) and stays
        mounted with an inline error.
      </p>
      <label className="row">
        <Switch
          className="sc-switch"
          checked={enabled}
          checkedChangeAction={async (next) => {
            setError(null);
            const fail = ++saves.current % 2 === 0;
            try {
              await fakeSave("veto", next, { fail });
              startTransition(() => setEnabled(next));
            } catch (e) {
              startTransition(() => setError(e instanceof Error ? e.message : String(e)));
            }
          }}
        />
        Airplane mode
      </label>
      <output className="readout">
        parent state: <code>{String(enabled)}</code>
        {error && <span className="inline-error"> {error}</span>}
      </output>
    </section>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save"}
    </button>
  );
}

function FormDemo() {
  const [saved, setSaved] = useState<string>("(nothing yet)");
  const [defaults, setDefaults] = useState({ newsletter: false, digest: true, terms: false });
  return (
    <section>
      <h3>
        Native form with <code>&lt;form action&gt;</code>
      </h3>
      <p>
        No change actions: the inputs post <code>name=value</code> with the form. After the action
        succeeds React resets the form; the new <code>defaultChecked</code> values (the saved data)
        are the reset target, so the form shows what was saved. The reset button and React&apos;s
        automatic reset both go through the residual browser path (<code>reason: "platform"</code>
        ).
      </p>
      <form
        className="stack"
        action={async (formData) => {
          await fakeSave("form", [...formData]);
          const next = {
            newsletter: formData.get("newsletter") === "on",
            digest: formData.get("digest") === "weekly",
            terms: formData.get("terms") === "on",
          };
          startTransition(() => {
            setDefaults(next);
            setSaved(JSON.stringify([...formData]));
          });
        }}
      >
        <label className="row">
          <Switch className="sc-switch" name="newsletter" defaultChecked={defaults.newsletter} />
          Newsletter
        </label>
        <label className="row">
          <Switch
            className="sc-switch"
            name="digest"
            value="weekly"
            defaultChecked={defaults.digest}
          />
          Weekly digest
        </label>
        <label className="row">
          <Checkbox className="sc-checkbox" name="terms" required defaultChecked={defaults.terms} />
          I accept the terms (required)
        </label>
        <div className="buttons">
          <SubmitButton />
          <button type="reset">Reset</button>
        </div>
      </form>
      <output className="readout">
        last submitted: <code>{saved}</code>
      </output>
    </section>
  );
}

const rows = [
  { id: "a", title: "Invoice #1001" },
  { id: "b", title: "Invoice #1002" },
  { id: "c", title: "Invoice #1003" },
];

/** One selection change: a row toggled, or "select all" set. */
type SelectionChange = { readonly id: string; readonly next: boolean } | { readonly all: boolean };

function applyChange(selection: ReadonlySet<string>, change: SelectionChange): ReadonlySet<string> {
  if ("all" in change) return new Set(change.all ? rows.map((r) => r.id) : []);
  const s = new Set(selection);
  if (change.next) s.add(change.id);
  else s.delete(change.id);
  return s;
}

function SelectAllDemo() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set(["b"]));
  // Every pending change, applied on top of the committed selection: the parent box derives from
  // what the rows show, so it is never "all" while a row's uncheck is still saving.
  const [optimisticSelected, addOptimistic] = useOptimistic(selected, applyChange);
  const [failNext, setFailNext] = useState(false);
  const failNextRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const all = optimisticSelected.size === rows.length;
  const some = optimisticSelected.size > 0 && !all;

  /**
   * Runs inside the Checkbox's transition: shows the change optimistically, saves it, then adopts
   * it with an updater ("update on success"), so overlapping saves never close over a stale set.
   */
  async function save(change: SelectionChange) {
    addOptimistic(change);
    setError(null);
    const fail = failNextRef.current;
    if (fail) {
      failNextRef.current = false;
      setFailNext(false);
    }
    try {
      await fakeSave("selection", change, { fail });
      startTransition(() => setSelected((prev) => applyChange(prev, change)));
    } catch (e) {
      startTransition(() => setError(e instanceof Error ? e.message : String(e)));
    }
  }

  return (
    <section>
      <h3>Tri-state "select all" (indeterminate, by hand)</h3>
      <p>
        The parent box is controlled: <code>checked</code> when every row is selected,{" "}
        <code>indeterminate</code> when some are, both derived from the rows' optimistic state (
        <code>useOptimistic</code>). Clicking the mixed box selects all. While the save is pending
        the dash is hidden (<code>indeterminate &amp;&amp; !pending</code>); when the save fails the
        selection rolls back and the dash returns.
      </p>
      <label className="row">
        <input
          type="checkbox"
          checked={failNext}
          onChange={(e) => {
            failNextRef.current = e.target.checked;
            setFailNext(e.target.checked);
          }}
        />
        Make the next save fail
      </label>
      <div className="stack select-all">
        <label className="row">
          <Checkbox
            className="sc-checkbox"
            checked={all}
            indeterminate={some}
            checkedChangeAction={(next) => save({ all: next })}
          />
          Select all
        </label>
        {rows.map((row) => (
          <label key={row.id} className="row nested">
            <Checkbox
              className="sc-checkbox"
              checked={optimisticSelected.has(row.id)}
              checkedChangeAction={(next) => save({ id: row.id, next })}
            />
            {row.title}
          </label>
        ))}
      </div>
      <output className="readout">
        selected: <code>{[...selected].join(", ") || "none"}</code>
        {error && <span className="inline-error"> {error}</span>}
      </output>
    </section>
  );
}

function SiblingThumbDemo() {
  return (
    <section>
      <h3>Visually hidden input, sibling track</h3>
      <p>
        No library part for the thumb: the input is clipped (not <code>display: none</code>) and the
        track next to it is styled with <code>.row:has(:checked)</code>,{" "}
        <code>:has([data-pending])</code> and <code>:has(:focus-visible)</code>.
      </p>
      <label className="row thumb-row">
        <Switch className="sr-only-input" checkedChangeAction={(next) => fakeSave("wifi", next)} />
        <span className="track" aria-hidden>
          <span className="thumb" />
        </span>
        Wi-Fi
      </label>
    </section>
  );
}

export function SwitchCheckboxDemo() {
  return (
    <article className="demo">
      <h2>Switch and Checkbox</h2>
      <AutosaveDemo />
      <RejectingDemo />
      <ControlledVetoDemo />
      <FormDemo />
      <SelectAllDemo />
      <SiblingThumbDemo />
    </article>
  );
}

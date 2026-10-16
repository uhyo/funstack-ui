"use client";
import { startTransition, useOptimistic, useRef, useState } from "react";
import { Checkbox } from "@funstack/ui/checkbox";
import { fakeSave } from "./fake-api.js";

const rows = [
  { id: "1001", title: "Invoice #1001" },
  { id: "1002", title: "Invoice #1002" },
  { id: "1003", title: "Invoice #1003" },
];

/** One selection change: a row toggled, or "select all" set. */
type Change = { readonly id: string; readonly next: boolean } | { readonly all: boolean };

function apply(selection: ReadonlySet<string>, change: Change): ReadonlySet<string> {
  if ("all" in change) return new Set(change.all ? rows.map((r) => r.id) : []);
  const s = new Set(selection);
  if (change.next) s.add(change.id);
  else s.delete(change.id);
  return s;
}

// A tri-state "select all" built from plain Checkboxes. `indeterminate` is controlled-only: the
// parent derives it (and `checked`) from the rows. Both come from the rows' optimistic selection,
// so the parent box agrees with what the rows show while a save is in flight. Clicking the mixed
// box selects every row. While its own save is pending the dash is hidden (the library renders
// `indeterminate && !pending`); when a save fails the selection rolls back and the dash returns.
export function CheckboxSelectAll() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set(["1002"]));
  const [optimistic, addChange] = useOptimistic(selected, apply);
  // The "fail" switch is read from a ref: state set inside a pending transition would not be
  // visible to a second click until the first save settles.
  const failNext = useRef(false);
  const [failNextShown, setFailNextShown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const all = optimistic.size === rows.length;
  const some = optimistic.size > 0 && !all;

  // Runs inside the Checkbox's transition. "Update on success": adopt the change only after the
  // save resolves, with an updater so overlapping saves never close over a stale set.
  async function save(change: Change) {
    addChange(change);
    setError(null);
    const fail = failNext.current;
    failNext.current = false;
    if (fail) setFailNextShown(false);
    try {
      await fakeSave("the selection", { fail });
      startTransition(() => setSelected((prev) => apply(prev, change)));
    } catch (e) {
      startTransition(() => setError(e instanceof Error ? e.message : String(e)));
    }
  }

  return (
    <>
      <div className="demo-stack">
        <label className="demo-field">
          <Checkbox
            className="demo-checkbox"
            checked={all}
            indeterminate={some}
            checkedChangeAction={(next) => save({ all: next })}
          />
          Select all
        </label>
        {rows.map((row) => (
          <label key={row.id} className="demo-field demo-nested">
            <Checkbox
              className="demo-checkbox"
              checked={optimistic.has(row.id)}
              checkedChangeAction={(next) => save({ id: row.id, next })}
            />
            {row.title}
          </label>
        ))}
      </div>
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
        saved selection: <code>{[...selected].join(", ") || "none"}</code>
        {error && <span className="demo-inline-error"> {error}</span>}
      </output>
    </>
  );
}

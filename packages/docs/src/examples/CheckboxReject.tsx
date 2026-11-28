"use client";
import { startTransition, useRef, useState } from "react";
import { Checkbox } from "@funstack/ui/checkbox";
import { fakeSave } from "./fake-api.js";

const tasks = [
  { id: "t1", title: "Write the release notes", done: true },
  { id: "t2", title: "Review the docs build", done: false },
];

// Uncontrolled checkboxes that handle a failed save themselves: the action catches the error,
// shows its own message and calls `details.reject()`. The box rolls back as if the action had
// rejected, but nothing reaches an Error Boundary.
export function CheckboxReject() {
  const [error, setError] = useState<string | null>(null);
  // Read from a ref: state set inside a pending transition is not visible to a second click.
  const failNext = useRef(false);
  const [failNextShown, setFailNextShown] = useState(false);
  return (
    <>
      <div className="demo-stack">
        {tasks.map((task) => (
          <label key={task.id} className="demo-field">
            <Checkbox
              className="demo-checkbox"
              defaultChecked={task.done}
              checkedChangeAction={async (_next, details) => {
                setError(null);
                const fail = failNext.current;
                failNext.current = false;
                if (fail) setFailNextShown(false);
                try {
                  await fakeSave(`"${task.title}"`, { fail });
                } catch (e) {
                  startTransition(() => setError(e instanceof Error ? e.message : String(e)));
                  details.reject(); // roll back; no Error Boundary
                }
              }}
            />
            {task.title}
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
      {error && (
        <p className="demo-inline-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

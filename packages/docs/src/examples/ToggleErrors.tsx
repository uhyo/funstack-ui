"use client";
import { startTransition, useRef, useState } from "react";
import { Toggle } from "@funstack/ui/toggle";
import { DemoErrorBoundary } from "./DemoErrorBoundary.js";
import { fakeSave } from "./fake-api.js";

// Two ways to handle a failing action.
export function ToggleErrors() {
  return (
    <div className="demo-row">
      <ControlledWithInlineError />
      <DemoErrorBoundary>
        <Toggle
          className="demo-toggle"
          pressedChangeAction={(next) => fakeSave(`notify=${next}`, { fail: true })}
        >
          {({ pending }) => (
            <>{pending && <span className="demo-spinner" aria-hidden />}Notify me</>
          )}
        </Toggle>
      </DemoErrorBoundary>
    </div>
  );
}

// Controlled, "update on success": the parent adopts the value only after the save succeeds.
// Every second save fails; the error is caught inside the action, so the Toggle snaps back.
function ControlledWithInlineError() {
  const [pinned, setPinned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saves = useRef(0);
  return (
    <span>
      <Toggle
        className="demo-toggle"
        pressed={pinned}
        pressedChangeAction={async (next) => {
          setError(null); // sync prefix: already a Transition update
          try {
            await fakeSave(`pinned=${next}`, { fail: ++saves.current % 2 === 0 });
            // After an await, wrap state updates in startTransition yourself.
            startTransition(() => setPinned(next));
          } catch (e) {
            startTransition(() => setError(e instanceof Error ? e.message : String(e)));
          }
        }}
      >
        {({ pending }) => <>{pending && <span className="demo-spinner" aria-hidden />}Pin</>}
      </Toggle>
      {error && <span className="demo-inline-error"> {error}</span>}
    </span>
  );
}

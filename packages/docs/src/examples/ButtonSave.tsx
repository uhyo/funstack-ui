"use client";
import { startTransition, useState } from "react";
import { Button } from "@funstack/ui/button";
import { toast } from "@funstack/ui/toast";
import { DemoErrorBoundary } from "./DemoErrorBoundary.js";
import { fakeSave } from "./fake-api.js";

// Three Buttons with a 1.2 s fake save. Click Save several times quickly: the action runs once
// (the call counter), because a Button ignores activation while its own action is pending. The
// second Button rejects into the Error Boundary; the third catches inside and shows a toast.
export function ButtonSave() {
  const [calls, setCalls] = useState(0);
  const [saved, setSaved] = useState(0);

  return (
    <div className="demo-stack">
      <div className="demo-row">
        <Button
          className="demo-btn"
          action={async () => {
            startTransition(() => setCalls((c) => c + 1));
            await fakeSave("the draft", { ms: 1200 });
            startTransition(() => setSaved((s) => s + 1));
          }}
        >
          {({ pending }) => (
            <>
              {pending && <span className="demo-spinner" aria-hidden />}
              {pending ? "Saving…" : "Save"}
            </>
          )}
        </Button>
        <output className="demo-readout">
          Action calls: {calls}. Saves: {saved}.
        </output>
      </div>

      <DemoErrorBoundary>
        <Button
          className="demo-btn"
          action={() => fakeSave("the deletion", { ms: 1200, fail: true })}
        >
          {({ pending }) => (pending ? "Deleting…" : "Delete (rejects)")}
        </Button>
      </DemoErrorBoundary>

      <Button
        className="demo-btn"
        action={async () => {
          try {
            await fakeSave("the copy", { ms: 1200, fail: true });
            toast({ title: "Copied" });
          } catch (error) {
            // Caught inside: the library counts this as success, so pending simply ends.
            toast({ title: "Copy failed", description: String(error), type: "error" });
          }
        }}
      >
        {({ pending }) => (pending ? "Copying…" : "Copy (fails, caught)")}
      </Button>
    </div>
  );
}

"use client";
import { startTransition, useState } from "react";
import { Collapsible } from "@funstack/ui/collapsible";
import { DemoErrorBoundary } from "./DemoErrorBoundary.js";
import { fakeSave } from "./fake-api.js";

// Library mode with an async action: every toggle saves the preference first (0.8 s) and the
// panel opens or closes when the save resolves. Meanwhile the chevron already shows the
// optimistic state (`data-open`) and the trigger is `data-pending`. Tick "fail" to see a
// rejected save: `data-open` reverts and the error goes to the nearest Error Boundary.
export function CollapsibleFilters() {
  const [fail, setFail] = useState(false);
  const [saved, setSaved] = useState<boolean | null>(null);
  return (
    <>
      <DemoErrorBoundary>
        <Collapsible.Root
          className="demo-collapsible"
          openChangeAction={async (open) => {
            await fakeSave("the preference", { fail });
            startTransition(() => setSaved(open)); // after an await: re-wrap (React limitation)
          }}
        >
          <Collapsible.Trigger className="demo-collapsible-trigger">Filters</Collapsible.Trigger>
          <Collapsible.Panel className="demo-collapsible-panel">
            <p>Price, brand and rating filters would go here.</p>
          </Collapsible.Panel>
        </Collapsible.Root>
      </DemoErrorBoundary>
      <label className="demo-readout">
        <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} /> fail
        the next save
      </label>
      <output className="demo-readout">
        saved: <code>{saved === null ? "nothing yet" : saved ? "open" : "closed"}</code>
      </output>
    </>
  );
}

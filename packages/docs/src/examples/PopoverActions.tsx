"use client";
import { startTransition, use, useState } from "react";
import { Popover } from "@funstack/ui/popover";
import type { PopoverOpenChangeDetails } from "@funstack/ui/popover";
import { sleep } from "./fake-api.js";

// Cache the promises so `use()` sees the same one on every render.
const cache = new Map<string, Promise<readonly string[]>>();
function loadPermissions(id: string): Promise<readonly string[]> {
  let promise = cache.get(id);
  if (promise === undefined) {
    promise = sleep(1000).then(() => (id === "notes" ? ["Rename"] : ["Rename", "Archive"]));
    cache.set(id, promise);
  }
  return promise;
}

function RowActions({ id, archive }: { id: string; archive: () => Promise<void> }) {
  const permissions = use(loadPermissions(id));
  return (
    <div className="demo-popover-actions">
      <Popover.Close className="demo-button" action={() => sleep(400)}>
        {({ pending }) => (pending ? "Renaming…" : "Rename")}
      </Popover.Close>
      {permissions.includes("Archive") && (
        <Popover.Close className="demo-button demo-danger" action={archive}>
          {({ pending }) => (pending ? "Archiving…" : "Archive")}
        </Popover.Close>
      )}
    </div>
  );
}

// Library mode: `defaultOpen={false}` (or any action prop) hands the open to the library. The
// Popup's children render from committed state, so <RowActions> mounts inside the opening
// transition and suspends: the popup stays hidden and the Trigger carries data-pending until the
// permissions are loaded, then it opens once, complete. A Close with an `action` runs it with its
// own pending state, then closes through the Root: the commit hides the popup, and
// `transition="pop"` animates that exit with a view transition, Firefox included. Escape and
// clicks outside are the browser's (reason "dismiss") and use the CSS fade.
export function PopoverActions() {
  const [archived, setArchived] = useState<readonly string[]>([]);
  const [last, setLast] = useState("(none yet)");
  const record = (open: boolean, { reason }: PopoverOpenChangeDetails) => {
    // The synchronous part of an action: this setState is a transition update.
    setLast(`open=${open} reason="${reason}"`);
  };
  const rows = [
    { id: "report", name: "Quarterly report" },
    { id: "notes", name: "Offsite notes" },
  ];
  return (
    <>
      <ul className="demo-list">
        {rows.map(({ id, name }) => (
          <li key={id} className="demo-row" data-archived={archived.includes(id) ? "" : undefined}>
            <span>{name}</span>
            <Popover.Root defaultOpen={false} openChangeAction={record}>
              <Popover.Trigger className="demo-button" aria-label={`Actions for ${name}`}>
                {({ pending }) => (pending ? <span className="demo-spinner" aria-hidden /> : "⋯")}
              </Popover.Trigger>
              <Popover.Popup className="demo-popover demo-popover-vt" align="end" transition="pop">
                <Popover.Title>{name}</Popover.Title>
                <RowActions
                  id={id}
                  archive={async () => {
                    await sleep(800);
                    // After an await: wrap the update in startTransition (React limitation).
                    startTransition(() => setArchived((ids) => [...ids, id]));
                  }}
                />
              </Popover.Popup>
            </Popover.Root>
          </li>
        ))}
      </ul>
      <div className="demo-row">
        <button type="button" className="demo-button" onClick={() => cache.clear()}>
          Clear the cache
        </button>
      </div>
      <output className="demo-readout">
        last openChangeAction: <code>{last}</code>
      </output>
    </>
  );
}

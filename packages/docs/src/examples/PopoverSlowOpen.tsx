"use client";
import { startTransition, useState } from "react";
import { Popover } from "@funstack/ui/popover";
import type { PopoverOpenChangeDetails } from "@funstack/ui/popover";
import { sleep } from "./fake-api.js";

// A slow `openChangeAction`: a pretend server call of 2 seconds for every open and close.
// Opening: the Trigger gets data-open and data-pending at once, the popup is shown when the
// action settles. Closing with the Trigger or the Close: the popup stays shown until the action
// settles. Escape and a click outside are the browser's: the popup hides at once and the action
// only hears about it (the Trigger is pending meanwhile). The browser exposes the Trigger as
// expanded exactly while the popup is shown. The readout is plain text, not a live region.
export function PopoverSlowOpen() {
  const [log, setLog] = useState("(none yet)");
  const slow = async (open: boolean, { reason }: PopoverOpenChangeDetails) => {
    const call = `openChangeAction(${open}, "${reason}")`;
    setLog(`${call}: running…`);
    await sleep(2000);
    // After an await: wrap the update in startTransition (React limitation).
    startTransition(() => setLog(`${call}: settled`));
  };
  return (
    <div className="demo-stack">
      <Popover.Root openChangeAction={slow}>
        <Popover.Trigger className="demo-button">
          {({ open, pending }) => (
            <>
              Filters{pending && <span className="demo-spinner" aria-hidden />}
              <span aria-hidden>{open ? " ▴" : " ▾"}</span>
            </>
          )}
        </Popover.Trigger>
        <Popover.Popup className="demo-popover">
          <Popover.Title>Filters</Popover.Title>
          <p>Saved filters for this list.</p>
          <Popover.Close className="demo-button">Close</Popover.Close>
        </Popover.Popup>
      </Popover.Root>
      <p className="demo-readout">
        Last: <code>{log}</code>
      </p>
    </div>
  );
}

"use client";
import { startTransition, useState } from "react";
import { Combobox } from "@funstack/ui/combobox";
import type { ComboboxOpenChangeDetails } from "@funstack/ui/combobox";
import { sleep } from "./fake-api.js";

const FRUITS = ["Apple", "Banana", "Cherry", "Grape", "Lemon", "Mango", "Orange", "Pear"];

// A slow `openChangeAction`: a pretend server call of 2 seconds for every request. Opening
// (typing, ArrowDown or the Trigger): the Input and the Trigger get data-open and data-pending at
// once, the listbox is shown when the action settles. Accepting an option or pressing the Trigger
// again closes it when the close's action settles. Escape, a click outside and focus leaving are
// the browser's, a fact: the listbox hides at once, nothing is pending and the action is not
// called; `onOpenChange` reports it. The Input's `aria-expanded` and the state the browser
// exposes on the Trigger follow the shown listbox. The readout is plain text, not a live region.
export function ComboboxSlowOpen() {
  const [log, setLog] = useState("(none yet)");
  const slow = async (open: boolean, { reason }: ComboboxOpenChangeDetails) => {
    const call = `openChangeAction(${open}, "${reason}")`;
    setLog(`${call}: running…`);
    await sleep(2000);
    // After an await: wrap the update in startTransition (React limitation).
    startTransition(() => setLog(`${call}: settled`));
  };
  // A fact: called in the browser's event, not awaited. A plain setState here is urgent.
  const dismissed = (open: boolean, { reason }: ComboboxOpenChangeDetails) => {
    setLog(`onOpenChange(${open}, "${reason}")`);
  };
  return (
    <div className="demo-stack">
      <Combobox.Root openChangeAction={slow} onOpenChange={dismissed}>
        <Combobox.Label>Fruit</Combobox.Label>
        <div className="demo-combobox-field">
          <Combobox.Input className="demo-combobox-input" placeholder="Type or press ArrowDown" />
          <Combobox.Trigger className="demo-combobox-icon" aria-label="Show fruits">
            {({ pending }) => (pending ? <span className="demo-spinner" aria-hidden /> : "▾")}
          </Combobox.Trigger>
          <Combobox.Popup className="demo-combobox-popup">
            <Combobox.List>
              {({ query }) =>
                FRUITS.filter((f) => f.toLowerCase().includes(query.toLowerCase())).map((f) => (
                  <Combobox.Option key={f} value={f}>
                    {f}
                  </Combobox.Option>
                ))
              }
            </Combobox.List>
            <Combobox.Empty className="demo-combobox-status">No fruit matches.</Combobox.Empty>
          </Combobox.Popup>
        </div>
      </Combobox.Root>
      <p className="demo-readout">
        Last: <code>{log}</code>
      </p>
    </div>
  );
}

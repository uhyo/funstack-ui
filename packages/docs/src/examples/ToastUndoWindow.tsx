"use client";
import { startTransition, useState } from "react";
import { toast } from "@funstack/ui/toast";
import { sleep } from "./fake-api.js";

const initial = ["Groceries", "Dentist", "Call Ada"];

// "Do later, unless undone": the item leaves the list at once (local state), and the toast is the
// grace period. `closeAction` runs when the toast leaves, with the reason: "activate" when Undo
// was used, otherwise ("timeout", or "dismiss" through Close, Escape or toast.dismiss()) the
// deletion is committed. Hover or focus the toast to pause its 6 second timer.
export function ToastUndoWindow() {
  const [items, setItems] = useState(initial);
  const [log, setLog] = useState<readonly string[]>([]);
  const note = (line: string) => startTransition(() => setLog((l) => [line, ...l].slice(0, 3)));

  const remove = (name: string) => {
    setItems((list) => list.filter((item) => item !== name));
    toast({
      title: `Deleted “${name}”`,
      duration: 6000,
      action: {
        label: "Undo",
        action: () => startTransition(() => setItems((list) => [...list, name])),
      },
      closeAction: async ({ reason }) => {
        if (reason === "activate") {
          note(`Restored ${name}`);
          return;
        }
        await sleep(300); // the real delete request
        note(`Deleted ${name} for good (${reason})`);
      },
    });
  };

  return (
    <div className="demo-stack">
      <ul className="demo-toast-list">
        {items.map((name) => (
          <li key={name}>
            <span>{name}</span>
            <button type="button" className="demo-button" onClick={() => remove(name)}>
              Delete
            </button>
          </li>
        ))}
        {items.length === 0 && (
          <li>
            <button type="button" className="demo-button" onClick={() => setItems(initial)}>
              Reset list
            </button>
          </li>
        )}
      </ul>
      <ul className="demo-readout">
        {log.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

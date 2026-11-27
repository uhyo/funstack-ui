"use client";
import { startTransition, useState } from "react";
import { Button } from "@funstack/ui/button";
import { TextField } from "@funstack/ui/text-field";
import { sleep } from "./fake-api.js";

// Keep the text: write some notes and leave the field (a textarea commits on blur; Enter is a new
// line). With "Make the save fail" on, the notes stay as typed, marked "Not saved", with a retry.
export function TextFieldNotes() {
  const [fail, setFail] = useState(false);
  const [notes, setNotes] = useState("Call the printer about the cover.");
  const [unsaved, setUnsaved] = useState(false);

  async function save(_next: string): Promise<boolean> {
    await sleep(800);
    return !fail;
  }

  return (
    <div className="demo-stack">
      <label className="demo-field">
        <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} />
        Make the save fail
      </label>
      <label htmlFor="notes" className="demo-text-label">
        Notes
      </label>
      <TextField
        id="notes"
        aria-describedby="notes-status"
        className="demo-text-notes"
        render={<textarea rows={4} />}
        value={notes}
        valueCommitAction={async (next) => {
          const ok = await save(next);
          // Adopt the text either way: nothing the user typed is lost.
          startTransition(() => {
            setNotes(next);
            setUnsaved(!ok);
          });
        }}
      />
      <p id="notes-status" role="status" className="demo-text-status">
        {unsaved ? "Not saved." : ""}
      </p>
      {unsaved && (
        <Button
          className="demo-button"
          action={async () => {
            const ok = await save(notes);
            startTransition(() => setUnsaved(!ok));
          }}
        >
          Try again
        </Button>
      )}
    </div>
  );
}

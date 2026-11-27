"use client";
import { startTransition, useState } from "react";
import { TextField } from "@funstack/ui/text-field";
import { sleep } from "./fake-api.js";

// A pretend rename. The server refuses an empty title and one that ends in "!": it resolves with
// a message (a refusal is not an error).
async function rename(title: string): Promise<{ ok: true } | { ok: false; message: string }> {
  await sleep(800);
  if (title.trim() === "") return { ok: false, message: "A document needs a title." };
  if (title.endsWith("!")) return { ok: false, message: "Titles cannot end with “!”." };
  return { ok: true };
}

// Roll back: edit the title, then Tab away or press Enter. The field pends while the save runs
// (dimmed), and the heading follows when it succeeds. End the title with "!" to see a refusal:
// the saved title comes back and the message says why. Escape while editing puts it back too.
export function TextFieldRename() {
  const [title, setTitle] = useState("Quarterly report");
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="demo-stack">
      <h4 className="demo-text-heading">{title}</h4>
      <TextField
        aria-label="Title"
        aria-describedby="rename-error"
        className="demo-text-title"
        value={title}
        valueCommitAction={async (next) => {
          const result = await rename(next);
          // After an await: re-wrap the update in a transition.
          if (result.ok) startTransition(() => setTitle(next));
          else startTransition(() => setError(result.message));
        }}
        onInput={() => setError(null)}
      />
      <p id="rename-error" role="alert" className="demo-text-error">
        {error}
      </p>
    </div>
  );
}

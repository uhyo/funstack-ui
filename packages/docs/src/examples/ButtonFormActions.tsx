"use client";
import { startTransition, useState } from "react";
import { Button } from "@funstack/ui/button";
import { Form } from "@funstack/ui/form";
import { fakeSave } from "./fake-api.js";

// One form, three submitters. Form.Submit runs the form's own action and is pending for every
// submission of the form (the form channel). Each Button formAction runs its own function instead
// and is pending for its own submissions only; a second click on a pending one is ignored.
export function ButtonFormActions() {
  const [log, setLog] = useState<string[]>([]);
  const record = (line: string) => startTransition(() => setLog((l) => [line, ...l].slice(0, 4)));

  return (
    <div className="demo-stack">
      <Form.Root
        className="demo-stack"
        action={async (data: FormData) => {
          await fakeSave("the post", { ms: 1500 });
          record(`Published “${String(data.get("title"))}”.`);
        }}
      >
        <label className="demo-field">
          Title <input name="title" defaultValue="Hello, world" required />
        </label>
        <div className="demo-row">
          <Form.Submit className="demo-btn demo-btn-primary">
            {({ pending }) => (pending ? "Working…" : "Publish")}
          </Form.Submit>
          <Button
            className="demo-btn"
            formAction={async (data: FormData) => {
              await fakeSave("the draft", { ms: 1500 });
              record(`Saved a draft of “${String(data.get("title"))}”.`);
            }}
          >
            {({ pending }) => (pending ? "Saving draft…" : "Save draft")}
          </Button>
          <Button
            className="demo-btn"
            formAction={async () => {
              await fakeSave("the discard", { ms: 2500 });
              record("Discarded.");
            }}
          >
            {({ pending }) => (pending ? "Discarding…" : "Discard")}
          </Button>
        </div>
      </Form.Root>
      <ul className="demo-readout">
        {log.length === 0 ? <li>Nothing yet.</li> : log.map((line, i) => <li key={i}>{line}</li>)}
      </ul>
    </div>
  );
}

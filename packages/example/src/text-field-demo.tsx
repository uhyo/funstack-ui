import { startTransition, useState } from "react";
import { Dialog } from "@funstack/ui/dialog";
import { Field } from "@funstack/ui/field";
import { Form } from "@funstack/ui/form";
import { TextField } from "@funstack/ui/text-field";
import { Demo } from "./shared/Demo.js";
import { DemoErrorBoundary } from "./shared/DemoErrorBoundary.js";
import { fakeSave } from "./shared/fake-backend.js";
import "./text-field-demo.css";

/** Uncontrolled: the save throws when asked to, and the boundary replaces the field. */
function Uncontrolled() {
  const [fail, setFail] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  return (
    <section>
      <h3>Uncontrolled (a rejection reaches the boundary)</h3>
      <label>
        <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} /> Make
        the save fail
      </label>
      <DemoErrorBoundary>
        <TextField
          aria-label="Document title"
          className="text-field title"
          defaultValue="Quarterly report"
          valueCommitAction={async (next, details) => {
            setLog((l) => [...l.slice(-4), `valueCommitAction("${next}", ${details.reason})`]);
            await fakeSave("text-field", next, { fail });
          }}
        />
      </DemoErrorBoundary>
      <pre className="log">{log.join("\n")}</pre>
    </section>
  );
}

/** Controlled, update on success: a refused save rolls the text back with a message. */
function RollBack() {
  const [title, setTitle] = useState("Plan");
  const [error, setError] = useState("");
  return (
    <section>
      <h3>Controlled, roll back (end the title with “!” to be refused)</h3>
      <p>
        Saved title: <strong>{title}</strong>
      </p>
      <TextField
        aria-label="Title"
        aria-describedby="text-field-error"
        className="text-field title"
        value={title}
        valueCommitAction={async (next) => {
          try {
            await fakeSave("text-field", next, { fail: next.endsWith("!") });
            startTransition(() => {
              setTitle(next);
              setError("");
            });
          } catch {
            startTransition(() => setError("Titles cannot end with “!”."));
          }
        }}
      />
      <p id="text-field-error" role="alert" className="error">
        {error}
      </p>
    </section>
  );
}

/** A textarea that keeps the text after a failure. */
function Notes() {
  const [fail, setFail] = useState(false);
  const [notes, setNotes] = useState("");
  const [unsaved, setUnsaved] = useState(false);
  return (
    <section>
      <h3>Textarea, keep the text (blur commits, Enter is a new line)</h3>
      <label>
        <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} /> Make
        the save fail
      </label>
      <TextField
        aria-label="Notes"
        aria-describedby="text-field-notes-status"
        className="text-field notes"
        render={<textarea rows={3} />}
        value={notes}
        valueCommitAction={async (next) => {
          let ok = true;
          try {
            await fakeSave("text-field notes", next, { fail });
          } catch {
            ok = false;
          }
          startTransition(() => {
            setNotes(next);
            setUnsaved(!ok);
          });
        }}
      />
      <p id="text-field-notes-status" role="status">
        {unsaved ? "Not saved." : ""}
      </p>
    </section>
  );
}

/** Inside a Field and a Form, and inside a Dialog (Escape reverts, then closes). */
function InFieldAndDialog() {
  return (
    <section>
      <h3>Field, Form and Dialog</h3>
      <Form.Root action={async (data) => fakeSave("text-field form", data.get("displayName"))}>
        <Field.Root name="displayName" required>
          <Field.Label>Display name</Field.Label>
          <TextField
            className="text-field"
            defaultValue="Ada"
            maxLength={20}
            valueCommitAction={(next) => fakeSave("text-field display name", next)}
          />
          <Field.Error />
        </Field.Root>
        <Form.Submit>Submit</Form.Submit>
      </Form.Root>
      <Dialog.Root>
        <Dialog.Trigger>Rename in a dialog</Dialog.Trigger>
        <Dialog.Popup aria-label="Rename">
          <p>Type, then Escape: the text reverts and the dialog stays. Escape again closes it.</p>
          <TextField
            aria-label="Name"
            className="text-field"
            defaultValue="Untitled"
            valueCommitAction={(next) => fakeSave("text-field dialog", next)}
          />
        </Dialog.Popup>
      </Dialog.Root>
    </section>
  );
}

export function TextFieldDemo() {
  return (
    <Demo title="TextField">
      <Uncontrolled />
      <RollBack />
      <Notes />
      <InFieldAndDialog />
    </Demo>
  );
}

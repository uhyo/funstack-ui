"use client";
import { startTransition, useState } from "react";
import { useFormStatus } from "react-dom";
import { Dialog } from "@funstack/ui/dialog";
import { DemoErrorBoundary } from "./DemoErrorBoundary.js";
import { sleep } from "./fake-api.js";

function SaveButton() {
  // React's form channel. The Form part only observes it; nothing in the library reports it as
  // its own pending state.
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="demo-button demo-primary" value="save">
      {pending && <span className="demo-spinner" aria-hidden />}
      Save
    </button>
  );
}

// Dialog.Form with a function `action` renders <form action> (React's form action, passed
// through unwrapped, so a Server Function keeps progressive enhancement) and closes the dialog
// once the action's transition has settled, with the submitter's value as returnValue. A name
// containing "fail" makes the save reject: the Error Boundary inside the dialog shows the error
// and the dialog stays open.
export function DialogProfile() {
  const [name, setName] = useState("Ada Lovelace");
  return (
    <>
      <Dialog.Root defaultOpen={false}>
        <Dialog.Trigger className="demo-button">Edit profile</Dialog.Trigger>
        <Dialog.Popup className="demo-dialog" initialFocus="[name=name]">
          <Dialog.Title>Edit profile</Dialog.Title>
          <Dialog.Description>
            Type a name containing &quot;fail&quot; to see a rejected save.
          </Dialog.Description>
          <DemoErrorBoundary>
            <Dialog.Form
              className="demo-dialog-form"
              action={async (formData) => {
                const next = String(formData.get("name") ?? "");
                await sleep(900);
                if (next.toLowerCase().includes("fail")) {
                  throw new Error(`The server rejected the name "${next}".`);
                }
                // After an await: wrap the update yourself (React limitation).
                startTransition(() => setName(next));
              }}
            >
              <label>
                Name <input name="name" defaultValue={name} />
              </label>
              <div className="demo-dialog-actions">
                <Dialog.Close className="demo-button" value="cancel">
                  Cancel
                </Dialog.Close>
                <SaveButton />
              </div>
            </Dialog.Form>
          </DemoErrorBoundary>
        </Dialog.Popup>
      </Dialog.Root>
      <output className="demo-readout">
        saved name: <strong>{name}</strong>
      </output>
    </>
  );
}

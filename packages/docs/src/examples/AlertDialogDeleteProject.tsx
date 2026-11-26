"use client";
import { startTransition, useState } from "react";
import { AlertDialog } from "@funstack/ui/alert-dialog";
import { DemoErrorBoundary } from "./DemoErrorBoundary.js";
import { fakeSave } from "./fake-api.js";

// The confirmed work is the Action's `action`: it runs in the Delete button's own transition
// (data-pending, "Deleting…"), and the dialog closes only when it resolves. With "Make the
// server fail" checked it rejects: the Error Boundary inside the dialog shows the error and the
// dialog stays open (Reset brings the buttons back; Escape still leaves). The dialog opens with
// focus on Cancel, the answer that destroys nothing, and a click on the backdrop does nothing.
export function AlertDialogDeleteProject() {
  const [deleted, setDeleted] = useState(false);
  const [fail, setFail] = useState(false);

  if (deleted) {
    return (
      <div className="demo-row">
        <output className="demo-readout">Project "Atlas" deleted.</output>
        <button type="button" className="demo-button" onClick={() => setDeleted(false)}>
          Restore
        </button>
      </div>
    );
  }

  return (
    <div className="demo-row">
      <AlertDialog.Root defaultOpen={false}>
        <AlertDialog.Trigger className="demo-button demo-danger">
          Delete project…
        </AlertDialog.Trigger>
        <AlertDialog.Popup className="demo-dialog">
          <AlertDialog.Title>Delete "Atlas"?</AlertDialog.Title>
          <AlertDialog.Description>
            The project and its 12 documents are removed for everyone. This cannot be undone.
          </AlertDialog.Description>
          <DemoErrorBoundary>
            <div className="demo-dialog-actions">
              <AlertDialog.Cancel className="demo-button">Cancel</AlertDialog.Cancel>
              <AlertDialog.Action
                className="demo-button demo-danger"
                action={async () => {
                  await fakeSave('"Atlas"', { ms: 1000, fail });
                  // After an await: wrap the update yourself (React limitation).
                  startTransition(() => setDeleted(true));
                }}
              >
                {({ pending }) => (
                  <>
                    {pending && <span className="demo-spinner" aria-hidden />}
                    {pending ? "Deleting…" : "Delete"}
                  </>
                )}
              </AlertDialog.Action>
            </div>
          </DemoErrorBoundary>
        </AlertDialog.Popup>
      </AlertDialog.Root>
      <label className="demo-label">
        <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} /> Make
        the server fail
      </label>
    </div>
  );
}

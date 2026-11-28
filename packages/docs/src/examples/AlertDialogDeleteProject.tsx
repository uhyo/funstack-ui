"use client";
import { startTransition, useState } from "react";
import { AlertDialog } from "@funstack/ui/alert-dialog";
import { fakeSave } from "./fake-api.js";

// The confirmed work is the Action's `action`: it runs in the Delete button's own transition
// (data-pending, "Deleting…"), and the dialog closes only when it resolves. With "Make the
// server fail" checked the save fails: the action catches the error, shows it in the dialog and
// calls `details.reject()`, so the dialog stays open with Cancel and Delete usable (Delete is
// then a retry; Escape still leaves). The dialog opens with focus on Cancel, the answer that
// destroys nothing, and a click on the backdrop does nothing.
export function AlertDialogDeleteProject() {
  const [deleted, setDeleted] = useState(false);
  const [fail, setFail] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (deleted) {
    return (
      <div className="demo-row">
        <output className="demo-readout">Project "Atlas" deleted.</output>
        {/* The dialog and its Trigger are gone: put focus on the next thing to do. */}
        <button type="button" className="demo-button" autoFocus onClick={() => setDeleted(false)}>
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
          {failure !== null && (
            <p className="demo-inline-error" role="alert">
              {failure}
            </p>
          )}
          <div className="demo-dialog-actions">
            {/* Clicked while Delete runs, it shows data-pending until the dialog closes. */}
            <AlertDialog.Cancel className="demo-button demo-cancel">Cancel</AlertDialog.Cancel>
            <AlertDialog.Action
              className="demo-button demo-danger"
              action={async (details) => {
                setFailure(null);
                try {
                  await fakeSave('"Atlas"', { ms: 1000, fail });
                } catch (e) {
                  // After an await: wrap the update yourself (React limitation).
                  startTransition(() => setFailure(e instanceof Error ? e.message : String(e)));
                  details.reject(); // the dialog stays open; no Error Boundary
                  return;
                }
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
        </AlertDialog.Popup>
      </AlertDialog.Root>
      <label className="demo-label">
        <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} /> Make
        the server fail
      </label>
    </div>
  );
}

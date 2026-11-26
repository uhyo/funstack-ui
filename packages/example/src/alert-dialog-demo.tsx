import { startTransition, useOptimistic, useState } from "react";
import { AlertDialog } from "@funstack/ui/alert-dialog";
import type { AlertDialogOpenChangeDetails } from "@funstack/ui/alert-dialog";
import { fakeSave } from "./shared/fake-backend.js";
import { DemoErrorBoundary } from "./shared/DemoErrorBoundary.js";
import { Spinner } from "./shared/Spinner.js";
import { Demo } from "./shared/Demo.js";
// AlertDialog shares Dialog's styling surface: the Dialog demo's stylesheet styles it.
import "./dialog-demo.css";

function log(label: string, channel: string) {
  return (open: boolean, { reason, returnValue }: AlertDialogOpenChangeDetails) => {
    console.log(
      `[${label}] ${channel} open=${open} reason=${reason} returnValue=${JSON.stringify(returnValue)}`,
    );
  };
}

/* 1. The async confirm ------------------------------------------------------------------- */

function AsyncConfirm() {
  const [fail, setFail] = useState(false);
  const [count, setCount] = useState(3);
  return (
    <section>
      <h3>Async confirm</h3>
      <p>
        The Delete button is <code>AlertDialog.Action</code>: its <code>action</code> runs in its
        own transition (<code>data-pending</code>), and the dialog closes when it resolves. Check
        "fail" to see a rejection reach the Error Boundary inside the dialog, which stays open. The
        dialog opens with focus on Cancel; a backdrop click does nothing; Escape closes it.
      </p>
      <label className="dlg-flags">
        <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} /> fail
      </label>
      <AlertDialog.Root
        defaultOpen={false}
        openChangeAction={log("async", "openChangeAction")}
        onOpenChange={log("async", "onOpenChange")}
      >
        <AlertDialog.Trigger className="dlg-btn dlg-danger" disabled={count === 0}>
          Delete a file ({count} left)
        </AlertDialog.Trigger>
        <AlertDialog.Popup className="dlg">
          <AlertDialog.Title>Delete "report-{count}.pdf"?</AlertDialog.Title>
          <AlertDialog.Description>It is removed for everyone.</AlertDialog.Description>
          <DemoErrorBoundary className="dlg-error">
            <div className="dlg-actions">
              <AlertDialog.Cancel className="dlg-btn">Cancel</AlertDialog.Cancel>
              <AlertDialog.Action
                className="dlg-btn dlg-danger"
                value="delete"
                action={async () => {
                  await fakeSave("async", `report-${count}.pdf`, { ms: 1200, fail });
                  startTransition(() => setCount((c) => c - 1));
                }}
              >
                {({ pending }) => (
                  <>
                    {pending && <Spinner />}
                    {pending ? "Deleting…" : "Delete"}
                  </>
                )}
              </AlertDialog.Action>
            </div>
          </DemoErrorBoundary>
        </AlertDialog.Popup>
      </AlertDialog.Root>
    </section>
  );
}

/* 2. JS-free, with a form ---------------------------------------------------------------- */

function JsFreeForm() {
  return (
    <section>
      <h3>JS-free confirm with a form</h3>
      <p>
        No open-state props: the Trigger and Cancel are Invoker Commands, Cancel carries{" "}
        <code>autofocus</code>, and Delete submits <code>AlertDialog.Form</code> (here{" "}
        <code>method="dialog"</code>; in an app, a Server Function).
      </p>
      <AlertDialog.Root>
        <AlertDialog.Trigger className="dlg-btn">Discard draft…</AlertDialog.Trigger>
        <AlertDialog.Popup className="dlg">
          <AlertDialog.Title>Discard this draft?</AlertDialog.Title>
          <AlertDialog.Description>Your changes are lost.</AlertDialog.Description>
          <AlertDialog.Form className="dlg-actions">
            <AlertDialog.Cancel className="dlg-btn">Keep editing</AlertDialog.Cancel>
            <button type="submit" className="dlg-btn dlg-danger" value="discard">
              Discard
            </button>
          </AlertDialog.Form>
        </AlertDialog.Popup>
      </AlertDialog.Root>
    </section>
  );
}

/* 3. Cancel unavailable while the confirm runs ------------------------------------------- */

function OptimisticCancel() {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useOptimistic(false);
  return (
    <section>
      <h3>Controlled, Cancel disabled while deleting</h3>
      <p>
        A controlled Root opened by a plain button. The Cancel is disabled with the consumer's own{" "}
        <code>useOptimistic</code> while the Action runs (the library keeps Cancel active by
        default); Escape still closes the dialog, and the action finishes in the background.
      </p>
      <button type="button" className="dlg-btn" onClick={() => setOpen(true)}>
        Empty trash…
      </button>
      <AlertDialog.Root
        open={open}
        openChangeAction={(next) => startTransition(() => setOpen(next))}
        onOpenChange={setOpen}
      >
        <AlertDialog.Popup className="dlg">
          <AlertDialog.Title>Empty the trash?</AlertDialog.Title>
          <AlertDialog.Description>24 items are deleted permanently.</AlertDialog.Description>
          <div className="dlg-actions">
            <AlertDialog.Cancel className="dlg-btn" disabled={deleting}>
              Cancel
            </AlertDialog.Cancel>
            <AlertDialog.Action
              className="dlg-btn dlg-danger"
              action={async () => {
                setDeleting(true);
                await fakeSave("trash", "empty", { ms: 1500 });
              }}
            >
              {({ pending }) => (
                <>
                  {pending && <Spinner />}
                  Empty trash
                </>
              )}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Root>
    </section>
  );
}

export function AlertDialogDemo() {
  return (
    <Demo title="AlertDialog">
      <p>
        A Dialog with alert defaults: <code>role="alertdialog"</code>, always modal, no light
        dismiss, focus on Cancel. The same stylesheet as the Dialog demo.
      </p>
      <AsyncConfirm />
      <JsFreeForm />
      <OptimisticCancel />
    </Demo>
  );
}

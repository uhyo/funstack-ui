// No "use client": this file is a Server Component. The Dialog.Root has no `open`, `defaultOpen`
// or `openChangeAction`, so it runs in JS-free mode: the Trigger is a native
// `command="show-modal"` invoker, Cancel is a `command="request-close"` button and Delete submits
// a `<form method="dialog">`. The browser opens, focuses, closes on Escape and returns focus,
// before hydration and with JavaScript off.
import { Dialog } from "@funstack/ui/dialog";

export function DialogConfirm() {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="demo-button">Delete draft…</Dialog.Trigger>
      <Dialog.Popup className="demo-dialog" role="alertdialog">
        <Dialog.Title>Delete this draft?</Dialog.Title>
        <Dialog.Description>This cannot be undone.</Dialog.Description>
        <Dialog.Form className="demo-dialog-actions">
          <Dialog.Close className="demo-button" value="cancel">
            Cancel
          </Dialog.Close>
          <button type="submit" className="demo-button demo-danger" value="delete">
            Delete
          </button>
        </Dialog.Form>
      </Dialog.Popup>
    </Dialog.Root>
  );
}

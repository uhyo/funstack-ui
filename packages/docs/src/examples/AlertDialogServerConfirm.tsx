// No "use client": this file is a Server Component. The AlertDialog.Root has none of `open`,
// `defaultOpen`, `openChangeAction` or `onOpenChange`, so it runs in JS-free mode: the Trigger is
// a native `command="show-modal"` invoker, Cancel is a `command="request-close"` button that
// carries `autofocus` in the server HTML, and Delete submits the AlertDialog.Form. The browser
// opens, focuses Cancel, closes on Escape (not on a backdrop click) and returns focus, before
// hydration and with JavaScript off.
//
// This site is static, so the form has no Server Function and closes the dialog
// (`method="dialog"`). In an app with a server, pass yours, `action={deleteProject}`, and keep
// everything else: the form then posts before hydration and runs the action after it.
import { AlertDialog } from "@funstack/ui/alert-dialog";

export function AlertDialogServerConfirm() {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger className="demo-button demo-danger">Delete project…</AlertDialog.Trigger>
      <AlertDialog.Popup className="demo-dialog">
        <AlertDialog.Title>Delete "Atlas"?</AlertDialog.Title>
        <AlertDialog.Description>This cannot be undone.</AlertDialog.Description>
        <AlertDialog.Form className="demo-dialog-actions">
          <input type="hidden" name="id" value="atlas" />
          <AlertDialog.Cancel className="demo-button">Cancel</AlertDialog.Cancel>
          <button type="submit" className="demo-button demo-danger" value="delete">
            Delete
          </button>
        </AlertDialog.Form>
      </AlertDialog.Popup>
    </AlertDialog.Root>
  );
}

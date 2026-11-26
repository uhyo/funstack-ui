"use client";
import { useDialogForm } from "../dialog/dialog-form.js";
import type { DialogFormProps, DialogFormState } from "../dialog/dialog-form.js";

/** State of `AlertDialog.Form`: Dialog's (`useFormStatus().pending` of this form). */
export type AlertDialogFormState = DialogFormState;

/**
 * Props of `AlertDialog.Form`: `Dialog.Form`'s.
 *
 * @see https://ui.funstack.work/components/alert-dialog
 */
export type AlertDialogFormProps = DialogFormProps;

/**
 * The confirm that works without JavaScript (design 6): `Dialog.Form`, unchanged. With a
 * function `action` (a Server Function) and a plain submit button, the form posts before
 * hydration through React's progressive enhancement; after hydration React runs the action and
 * the dialog closes when its transition settles (`closeOnSettle`). Without `action`:
 * `method="dialog"`.
 *
 * Owned keys (conventions 1.2): `method` (except with a string `action`), `action`.
 *
 * @see https://ui.funstack.work/components/alert-dialog
 */
export function AlertDialogForm(props: AlertDialogFormProps) {
  return useDialogForm(props, "AlertDialog");
}

AlertDialogForm.displayName = "AlertDialogForm";

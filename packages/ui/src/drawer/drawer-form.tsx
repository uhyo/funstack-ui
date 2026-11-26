"use client";
import { useDialogForm } from "../dialog/dialog-form.js";
import type { DialogFormProps, DialogFormState } from "../dialog/dialog-form.js";

/** State of `Drawer.Form`: Dialog's (`useFormStatus().pending` of this form). */
export type DrawerFormState = DialogFormState;

/**
 * Props of `Drawer.Form`: `Dialog.Form`'s.
 *
 * @see https://ui.funstack.work/components/drawer
 */
export type DrawerFormProps = DialogFormProps;

/**
 * A form whose submission closes the drawer: exactly `Dialog.Form` (`method="dialog"` without
 * `action`; with a function `action`, the drawer closes when its transition settles).
 *
 * Owned keys (conventions 1.2): `method` (except with a string `action`), `action`.
 *
 * @see https://ui.funstack.work/components/drawer
 */
export function DrawerForm(props: DrawerFormProps) {
  return useDialogForm(props, "Drawer");
}

DrawerForm.displayName = "DrawerForm";

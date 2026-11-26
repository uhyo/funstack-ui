"use client";
import { useDialogDescription } from "../dialog/dialog-description.js";
import type {
  DialogDescriptionProps,
  DialogDescriptionState,
} from "../dialog/dialog-description.js";

/** State of `AlertDialog.Description`: the Popup's state. */
export type AlertDialogDescriptionState = DialogDescriptionState;

/**
 * Props of `AlertDialog.Description`: `Dialog.Description`'s.
 *
 * @see https://ui.funstack.work/components/alert-dialog
 */
export type AlertDialogDescriptionProps = DialogDescriptionProps;

/**
 * The alert message: a `<p>` whose id the Popup references with `aria-describedby`. A screen
 * reader announces an alert dialog by its name and this description; without one, development
 * warns (design 2.2).
 *
 * Owned key (conventions 1.2): `id`.
 *
 * @see https://ui.funstack.work/components/alert-dialog
 */
export function AlertDialogDescription(props: AlertDialogDescriptionProps) {
  return useDialogDescription(props, "AlertDialog");
}

AlertDialogDescription.displayName = "AlertDialogDescription";

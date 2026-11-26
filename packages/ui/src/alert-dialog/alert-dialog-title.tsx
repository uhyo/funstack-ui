"use client";
import { useDialogTitle } from "../dialog/dialog-title.js";
import type { DialogTitleProps, DialogTitleState } from "../dialog/dialog-title.js";

/** State of `AlertDialog.Title`: the Popup's state. */
export type AlertDialogTitleState = DialogTitleState;

/**
 * Props of `AlertDialog.Title`: `Dialog.Title`'s.
 *
 * @see https://ui.funstack.work/components/alert-dialog
 */
export type AlertDialogTitleProps = DialogTitleProps;

/**
 * The alert dialog's name: an `<h2>` whose id the Popup references with `aria-labelledby`.
 *
 * Owned key (conventions 1.2): `id`.
 *
 * @see https://ui.funstack.work/components/alert-dialog
 */
export function AlertDialogTitle(props: AlertDialogTitleProps) {
  return useDialogTitle(props, "AlertDialog");
}

AlertDialogTitle.displayName = "AlertDialogTitle";

"use client";
import { useDialogTrigger } from "../dialog/dialog-trigger.js";
import type { DialogTriggerProps, DialogTriggerState } from "../dialog/dialog-trigger.js";

/** State of `AlertDialog.Trigger`: Dialog's. */
export type AlertDialogTriggerState = DialogTriggerState;

/**
 * Props of `AlertDialog.Trigger`: `Dialog.Trigger`'s.
 *
 * @see https://ui.funstack.work/components/alert-dialog
 */
export type AlertDialogTriggerProps = DialogTriggerProps;

/**
 * The opener: `<button type="button" commandfor command="show-modal">`, exactly
 * `Dialog.Trigger`. JS-free mode: the browser runs the command. Library mode: the click is a
 * request through the Root (`data-pending` until the dialog has opened).
 *
 * @see https://ui.funstack.work/components/alert-dialog
 */
export function AlertDialogTrigger(props: AlertDialogTriggerProps) {
  return useDialogTrigger(props, "AlertDialog");
}

AlertDialogTrigger.displayName = "AlertDialogTrigger";

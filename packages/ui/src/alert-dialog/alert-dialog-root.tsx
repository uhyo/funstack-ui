"use client";
import { useDialogRoot } from "../dialog/dialog-root.js";
import type {
  DialogOpenChangeDetails,
  DialogRootProps,
  DialogRootState,
} from "../dialog/dialog-root.js";

/**
 * Details passed as the second argument of `openChangeAction` and `onOpenChange`: Dialog's.
 * `reason` is `"activate"` for the Trigger, a Cancel, an Action or a Form; `"dismiss"` for
 * Escape, Android back or an assistive-technology dismiss (there is no light dismiss).
 */
export type AlertDialogOpenChangeDetails = DialogOpenChangeDetails;

/** State of `AlertDialog.Root`: Dialog's, with `modal` always `true`. */
export type AlertDialogRootState = DialogRootState;

/**
 * Props of `AlertDialog.Root`: `Dialog.Root`'s without `modal` (an alert dialog is always
 * modal). Without `open`, `defaultOpen`, `openChangeAction` and `onOpenChange` it is JS-free.
 *
 * @see https://ui.funstack.work/components/alert-dialog
 */
export type AlertDialogRootProps = Omit<DialogRootProps, "modal">;

/**
 * `Dialog.Root` with `modal` fixed to `true` (design 2.1). Owns the ids, the mode and the open
 * state; renders no DOM. The confirmed work belongs in `AlertDialog.Action`'s `action`;
 * `openChangeAction` hears the Trigger, Cancel, Action and Form requests, `onOpenChange` the
 * dismissals (Escape: a fact, it means "cancel").
 *
 * @see https://ui.funstack.work/components/alert-dialog
 */
export function AlertDialogRoot(props: AlertDialogRootProps) {
  // `useDialogRoot` reads only the open-state props and `children`: an untyped `modal` is
  // dropped.
  return useDialogRoot(props, { namespace: "AlertDialog", modal: true });
}

AlertDialogRoot.displayName = "AlertDialogRoot";

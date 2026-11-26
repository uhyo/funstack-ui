"use client";
import { use, useCallback } from "react";
import { useDialogClose } from "../dialog/dialog-close.js";
import type {
  DialogCloseDetails,
  DialogCloseProps,
  DialogCloseState,
} from "../dialog/dialog-close.js";
import { useDialogContext } from "../dialog/dialog-context.js";
import { useMergedRefs } from "../internal/use-merged-refs.js";
import { AlertDialogCancelContext } from "./alert-dialog-context.js";

/** State of `AlertDialog.Cancel`: Dialog.Close's. */
export type AlertDialogCancelState = DialogCloseState;

/** Details passed to `AlertDialog.Cancel`'s `action`: Dialog.Close's. */
export type AlertDialogCancelDetails = DialogCloseDetails;

/**
 * Props of `AlertDialog.Cancel`: `Dialog.Close`'s (`value` defaults to `""`, what Escape
 * leaves in `returnValue`).
 *
 * @see https://ui.funstack.work/components/alert-dialog
 */
export type AlertDialogCancelProps = DialogCloseProps;

/**
 * The safe answer: `Dialog.Close` under another name (`<button type="button" commandfor
 * command="request-close">` in JS-free mode, a close through the Root in library mode), and the
 * default initial focus target (design 3.4): when the Popup has no `initialFocus`, the dialog
 * opens with focus on the first enabled Cancel. In JS-free mode it renders `autofocus`, in the
 * server HTML too, so the focus is right before hydration.
 *
 * Owned keys (conventions 1.2): Dialog.Close's, and `autoFocus` while it is the default target in
 * JS-free mode.
 *
 * @see https://ui.funstack.work/components/alert-dialog
 */
export function AlertDialogCancel({ disabled, ref, ...rest }: AlertDialogCancelProps) {
  const ctx = useDialogContext("AlertDialog.Cancel");
  const cancels = use(AlertDialogCancelContext);
  const register = cancels?.register;
  // JS-free mode: the browser opens the dialog itself, so the attribute has to be on the element
  // already (design 3.4). React renders `autoFocus` in the server HTML but does not write it on
  // a client render; the ref writes it there. Not on a disabled Cancel: the rule is the first
  // enabled one.
  const autofocus =
    ctx.mode !== "library" && cancels !== null && cancels.defaultFocus && disabled !== true;

  const attach = useCallback(
    (element: HTMLElement | null) => {
      if (element === null) return;
      const unregister = register?.(element);
      // Owned while it is the target: removed when it stops being one (disabled, or an
      // `initialFocus` given), the server-rendered attribute included.
      if (autofocus) element.setAttribute("autofocus", "");
      return () => {
        unregister?.();
        if (autofocus) element.removeAttribute("autofocus");
      };
    },
    [register, autofocus],
  );
  const mergedRef = useMergedRefs<HTMLButtonElement | null>(attach, ref);

  return useDialogClose(
    { ...rest, disabled, ref: mergedRef },
    { part: "AlertDialog.Cancel", ownProps: autofocus ? { autoFocus: true } : undefined },
  );
}

AlertDialogCancel.displayName = "AlertDialogCancel";

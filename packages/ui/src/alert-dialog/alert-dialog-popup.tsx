"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { useDialogContext } from "../dialog/dialog-context.js";
import { useDialogPopup } from "../dialog/dialog-popup.js";
import type { DialogPopupProps, DialogPopupState } from "../dialog/dialog-popup.js";
import { AlertDialogCancelContext, firstEnabledCancel } from "./alert-dialog-context.js";
import type { AlertDialogCancelContextValue } from "./alert-dialog-context.js";

const isDev = process.env.NODE_ENV !== "production";

/** State of `AlertDialog.Popup`: Dialog's, with `modal` always `true`. */
export type AlertDialogPopupState = DialogPopupState;

/**
 * Props of `AlertDialog.Popup`: `Dialog.Popup`'s without `role` (owned: `alertdialog`),
 * `lightDismiss` and `experimental_closedBy` (a click on the backdrop never closes an alert
 * dialog).
 *
 * @see https://ui.funstack.work/components/alert-dialog
 */
export interface AlertDialogPopupProps extends Omit<
  DialogPopupProps,
  "role" | "lightDismiss" | "experimental_closedBy"
> {
  /**
   * Element to focus when the dialog opens: a ref, or a selector resolved inside the dialog.
   * With it, no Cancel renders `autofocus`. Point it at the Title with `tabIndex={-1}` for a
   * long message, so that it is read from the top (APG).
   *
   * @defaultValue the first enabled `AlertDialog.Cancel`; without one, the platform's choice
   * (the first focusable element)
   */
  initialFocus?: RefObject<HTMLElement | null> | string;
}

/**
 * The alert dialog: `Dialog.Popup` rendering `<dialog role="alertdialog">`, always opened with
 * `showModal()`, without light dismiss (a modal `<dialog>` without `closedby` closes on Escape and
 * not on a backdrop click, in every engine and before hydration). Escape closes it: the
 * platform's close request, reported to `onOpenChange(false, { reason: "dismiss" })`; there is no
 * prop to turn it off. Opens with focus on the first enabled `AlertDialog.Cancel` unless
 * `initialFocus` is given.
 *
 * Owned keys (conventions 1.2): Dialog.Popup's (`id`, `open`, `closedby`, `aria-labelledby` and
 * `aria-describedby` token-merged, `data-modal`, `suppressHydrationWarning`) and `role`.
 *
 * @see https://ui.funstack.work/components/alert-dialog
 */
export function AlertDialogPopup(props: AlertDialogPopupProps) {
  const ctx = useDialogContext("AlertDialog.Popup");
  const [cancels] = useState(() => new Set<HTMLElement>());
  const defaultFocus = props.initialFocus === undefined;
  const cancelContext = useMemo<AlertDialogCancelContextValue>(
    () => ({
      defaultFocus,
      register: (element) => {
        cancels.add(element);
        return () => cancels.delete(element);
      },
    }),
    [defaultFocus, cancels],
  );

  // Development check (design 2.2): the APG asks for the alert message as the description. Once
  // per instance, when the dialog is (or can be) shown: a mounted Description, or a consumer
  // `aria-describedby` naming an element in the document.
  const warned = useRef(false);
  const shown = ctx.mode !== "library" || ctx.committed;
  const { popupRef } = ctx;
  useEffect(() => {
    if (!isDev || !shown || warned.current) return;
    const dialog = popupRef.current;
    if (dialog === null) return;
    const doc = dialog.ownerDocument;
    const ids = (dialog.getAttribute("aria-describedby") ?? "").split(/\s+/);
    if (ids.some((id) => id !== "" && doc.getElementById(id) !== null)) return;
    warned.current = true;
    console.error(
      isDev &&
        "AlertDialog.Popup: the alert dialog has no description. Render an " +
          "AlertDialog.Description with the message (or give the Popup an `aria-describedby`): a " +
          "screen reader announces an alert dialog by its name and description.",
    );
  }, [shown, popupRef]);

  return useDialogPopup(
    // An untyped `lightDismiss` / `experimental_closedBy` is overridden: no light dismiss, no
    // `closedby` (design 2.3).
    { ...props, lightDismiss: false, experimental_closedBy: false },
    {
      namespace: "AlertDialog",
      role: "alertdialog",
      defaultInitialFocus: (dialog) => firstEnabledCancel(dialog, cancels),
      wrapChildren: (children: ReactNode) => (
        <AlertDialogCancelContext value={cancelContext}>{children}</AlertDialogCancelContext>
      ),
    },
  );
}

AlertDialogPopup.displayName = "AlertDialogPopup";

"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { useDialogClose } from "../dialog/dialog-close.js";
import type { DialogCloseDetails, DialogCloseState } from "../dialog/dialog-close.js";
import type { Action, RenderProp, StateValue, WhilePending } from "../internal/types.js";

/** State of `AlertDialog.Action`, passed to the function forms of `className`, `style`, `children` and `render`. */
export type AlertDialogActionState = DialogCloseState;

/** Details passed to `AlertDialog.Action`'s `action`. */
export type AlertDialogActionDetails = DialogCloseDetails;

/**
 * Props of `AlertDialog.Action`.
 *
 * @see https://ui.funstack.work/components/alert-dialog
 */
export interface AlertDialogActionProps extends Omit<
  ComponentPropsWithRef<"button">,
  "onClick" | "value" | "className" | "style" | "children"
> {
  /**
   * The confirmed work. Runs inside this part's own transition (`data-pending` on the button),
   * then closes the dialog with `value` as `returnValue`: in library mode through the Root
   * (`openChangeAction(false)` awaited, view transition if set), in JS-free mode with
   * `close(value)`. A rejection reaches the nearest Error Boundary above this part and leaves
   * the dialog open. If the dialog was dismissed and opened again while the action ran, the
   * close is dropped. Escape or a Cancel while it runs closes the dialog; the action keeps
   * running (it is hidden, not aborted).
   *
   * With `action` the button is no native close invoker (no `commandfor` / `command`): a click
   * before hydration does nothing, rather than closing the dialog as if the work had been done.
   * The confirm that works before hydration is `AlertDialog.Form`. Without `action` the button
   * only closes the dialog (read `returnValue` in `openChangeAction`).
   */
  action?: Action<[details: AlertDialogActionDetails]>;
  /**
   * What a click does while the `action` is pending. `"ignore"`: nothing (the click is
   * cancelled, `aria-disabled="true"` meanwhile). `"run"`: the action runs again; the dialog
   * closes once, after the last run and only if the latest one resolved. No effect without
   * `action`: the part then shows `data-pending` while the Root's close waits, without
   * `aria-disabled`.
   *
   * @defaultValue `"ignore"`
   */
  whilePending?: WhilePending;
  /** Becomes `dialog.returnValue` (and `details.returnValue` of the close request). */
  value?: string;
  /**
   * Never runs or closes. Native `disabled` on a `<button>`; owned. With a link or component
   * `render`, `aria-disabled="true"` instead.
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, AlertDialogActionState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, AlertDialogActionState>;
  /** Content, or a function of the part's state (`pending ? "Deleting…" : "Delete"`). */
  children?: StateValue<ReactNode, AlertDialogActionState>;
  /** Replace the default `<button>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"button">, AlertDialogActionState>;
}

/**
 * The confirm button: `Dialog.Close` with an `action` (design 3.2). The action runs in this
 * part's own transition (`data-pending` and, by default, `aria-disabled` on the button), then
 * the dialog closes; a rejection leaves it open. Unlike `Dialog.Close`, an Action with `action`
 * renders no `commandfor` / `command`.
 *
 * Owned keys (conventions 1.2): `type` (on a `<button>` only), `disabled`, `commandfor`,
 * `command`, `value`, `onClick` (library mode, or with `action`), `aria-disabled`,
 * `data-pending`, `data-disabled`.
 *
 * @see https://ui.funstack.work/components/alert-dialog
 */
export function AlertDialogAction(props: AlertDialogActionProps) {
  // With `action` no native command, as every Close part (#182).
  return useDialogClose(props, { part: "AlertDialog.Action" });
}

AlertDialogAction.displayName = "AlertDialogAction";

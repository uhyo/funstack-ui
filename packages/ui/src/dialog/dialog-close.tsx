"use client";
import { useCallback } from "react";
import type { ComponentPropsWithRef, CSSProperties, MouseEvent, ReactNode } from "react";
import { createActionDetails } from "../internal/action-details.js";
import { dataAttr } from "../internal/data-attr.js";
import type { Action, ActionDetails, RenderProp, StateValue } from "../internal/types.js";
import { useActionTrigger } from "../internal/use-action-trigger.js";
import { isHostButton, rendersButton, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { useDialogContext } from "./dialog-context.js";

export interface DialogCloseState {
  /** The `action` is in flight. */
  readonly pending: boolean;
  readonly disabled: boolean;
}

/** Details passed to `Dialog.Close`'s `action`. */
export interface DialogCloseDetails extends ActionDetails {
  /** The `value` the dialog closes with (`dialog.returnValue`); `""` without `value`. */
  readonly returnValue: string;
}

export interface DialogCloseProps extends Omit<
  ComponentPropsWithRef<"button">,
  "onClick" | "value" | "className" | "style" | "children"
> {
  /**
   * Runs inside this part's own transition (`data-pending` on the button), then closes the
   * dialog with `value` as `returnValue`: in library mode through the Root
   * (`openChangeAction(false)` awaited, view transition if set), in JS-free mode with
   * `close(value)`. A rejection reaches the nearest Error Boundary above the Close part and
   * leaves the dialog open. If the dialog was dismissed and opened again while the action ran,
   * the close is dropped: it belonged to the earlier open. Without `action` in JS-free mode the
   * button is a native `command="request-close"` invoker.
   */
  action?: Action<[details: DialogCloseDetails]>;
  /** Becomes `dialog.returnValue` (and `details.returnValue` of `openChangeAction(false)`). */
  value?: string;
  /**
   * Never closes. Native `disabled` on a `<button>`; owned, so a `render` element cannot
   * re-enable it. With a link or component `render` whose click this part handles (library mode,
   * or with `action`), `aria-disabled="true"` instead: the element stays focusable.
   */
  disabled?: boolean;
  className?: StateValue<string | undefined, DialogCloseState>;
  style?: StateValue<CSSProperties | undefined, DialogCloseState>;
  children?: StateValue<ReactNode, DialogCloseState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, DialogCloseState>;
}

const isDev = process.env.NODE_ENV !== "production";

/**
 * A close button: `<button type="button" commandfor command="request-close">`. In JS-free mode
 * without `action` the browser closes the dialog (a close request: `cancel`, then `close`), with
 * `value` as the `returnValue`. In library mode the click is always cancelled and the close goes
 * through the Root (`openChangeAction(false)` awaited, then `close(value)` in the commit, inside
 * the view transition if the Popup's `transition` is set). With `action` the action runs first in
 * this part's own transition (`data-pending` and `aria-disabled` on the button; a second click
 * meanwhile is ignored); a rejection leaves the dialog open.
 *
 * Owned keys (conventions 1.2): `type` (on a `<button>` only), `disabled`, `commandfor`,
 * `command`, `value`, `onClick` (library mode, or with `action`), `aria-disabled`, `data-pending`,
 * `data-disabled`.
 */
export function DialogClose({
  action,
  value,
  disabled = false,
  className,
  style,
  children,
  render,
  ...rest
}: DialogCloseProps) {
  const ctx = useDialogContext("Dialog.Close");
  // The open-generation guard: a close from a previous opening must not close a new one.
  const { pending, run } = useActionTrigger({ openGeneration: ctx.openGeneration });
  const { ids, dialogRef, recordCloseIntent } = ctx;
  const isLibrary = ctx.mode === "library";
  const hasAction = action !== undefined;
  const installClick = isLibrary || hasAction;
  // A link or component render whose click this part handles: `aria-disabled`, enforced by the
  // handler (#83). JS-free mode without `action` is the browser's `request-close` command,
  // which only native `disabled` stops.
  const focusable = installClick && !isHostButton(render);
  // Disabled in the `aria-disabled` branch: no `commandfor` / `command` either. Without native
  // `disabled` the element would still be a live invoker before hydration (a component render
  // spreading onto a real <button>), and the command would run (wave 9 review M1).
  const noInvoker = focusable && disabled;

  const state: DialogCloseState = { pending, disabled };

  const devRef = useCallback(
    (element: HTMLElement) => {
      if (isDev && !installClick && element.tagName !== "BUTTON") {
        console.error(
          `Dialog.Close: rendered a <${element.tagName.toLowerCase()}> in JS-free mode without ` +
            '`action`. Only a <button> runs `command="request-close"`; this element will not ' +
            "close the dialog.",
        );
      }
      // A cleanup, so the merged ref never calls back with `null`.
      return () => {};
    },
    [installClick],
  );

  const close = (event: Event, returnValue: string): void => {
    if (isLibrary) {
      // A library-owned close (design 2.3): awaited, then `close(returnValue)` in the commit. A
      // no-op when `false` is already intended (a repeated click, or a dismissal meanwhile).
      ctx.requestClose(event, "activate", returnValue);
      return;
    }
    // JS-free mode with `action`: a browser-owned close; there is no Root state to go through.
    const dialog = dialogRef.current;
    if (dialog === null || !dialog.open) return;
    recordCloseIntent({ reason: "activate", event });
    dialog.close(returnValue);
  };

  const onClick = (event: MouseEvent<HTMLElement>) => {
    // Cancelling the click cancels the command.
    event.preventDefault();
    if (disabled) return;
    const native = event.nativeEvent;
    const returnValue = value ?? "";
    if (action === undefined) {
      close(native, returnValue);
      return;
    }
    const details = createActionDetails(native, { returnValue });
    // A second activation while this Close's own run is in flight starts nothing (the hook's
    // guard; the click is already cancelled above, #81). A close whose open was superseded by a
    // newer one (dismissed and re-opened meanwhile) is dropped by the hook.
    run(
      () => action(details),
      () => close(native, returnValue),
    );
  };

  const libraryProps: ComponentPropsWithRef<"button"> & DataAttributes = {
    ...(rendersButton(render) && { type: "button" as const }),
    // Owned: a render element must not re-enable a disabled Close. Absent in the focusable branch.
    disabled: focusable ? undefined : disabled,
    commandfor: noInvoker ? undefined : ids.dialog,
    command: noInvoker ? undefined : "request-close",
    value,
    ...(installClick && { onClick }),
    // Exactly while `data-pending` (#81): a Close that will not act is unavailable to AT. Owned,
    // so an idle Close removes a render element's own `aria-disabled`.
    "aria-disabled": pending || (focusable && disabled) ? true : undefined,
    "data-pending": dataAttr(pending),
    "data-disabled": dataAttr(disabled),
  };

  return useRender<ComponentPropsWithRef<"button">, DialogCloseState>({
    defaultElement: "button",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps,
    ref: devRef,
  });
}

DialogClose.displayName = "DialogClose";

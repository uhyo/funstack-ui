"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { createActionDetails } from "../internal/action-details.js";
import type { Action, ActionDetails, RenderProp, StateValue } from "../internal/types.js";
import { useOverlayClose } from "../internal/use-overlay-close.js";
import { useDialogContext } from "./dialog-context.js";

/**
 * State of `Dialog.Close`, passed to the function forms of `className`, `style`, `children` and
 * `render`.
 */
export interface DialogCloseState {
  /** The `action` is in flight. */
  readonly pending: boolean;
  /** The `disabled` prop. */
  readonly disabled: boolean;
}

/** Details passed to `Dialog.Close`'s `action`. */
export interface DialogCloseDetails extends ActionDetails {
  /** The `value` the dialog closes with (`dialog.returnValue`); `""` without `value`. */
  readonly returnValue: string;
}

/**
 * Props of `Dialog.Close`.
 *
 * @see https://ui.funstack.work/components/dialog
 */
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
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, DialogCloseState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, DialogCloseState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, DialogCloseState>;
  /** Replace the default `<button>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"button">, DialogCloseState>;
}

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
 *
 * @see https://ui.funstack.work/components/dialog
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
  const { popupRef, recordCloseIntent } = ctx;
  const isLibrary = ctx.mode === "library";
  return useOverlayClose({
    part: "Dialog.Close",
    noun: "dialog",
    isLibrary,
    popupId: ctx.ids.popup,
    command: "request-close",
    openGeneration: ctx.openGeneration,
    action,
    details: (event) => createActionDetails(event, { returnValue: value ?? "" }),
    close: (event) => {
      const returnValue = value ?? "";
      if (isLibrary) {
        // A library-owned close (design 2.3): awaited, then `close(returnValue)` in the commit. A
        // no-op when `false` is already intended (a repeated click, or a dismissal meanwhile).
        ctx.requestClose(event, "activate", returnValue);
        return;
      }
      // JS-free mode with `action`: a browser-owned close; there is no Root state to go through.
      const dialog = popupRef.current;
      if (dialog === null || !dialog.open) return;
      recordCloseIntent({ reason: "activate", event });
      dialog.close(returnValue);
    },
    ownProps: { value },
    disabled,
    className,
    style,
    children,
    render,
    rest,
  });
}

DialogClose.displayName = "DialogClose";

"use client";
import { useCallback, useTransition } from "react";
import type { ComponentPropsWithRef, CSSProperties, MouseEvent, ReactNode } from "react";
import { createActionDetails } from "../internal/action-details.js";
import { dataAttr } from "../internal/data-attr.js";
import type { Action, ActionDetails, RenderProp, StateValue } from "../internal/types.js";
import { rendersButton, useRender } from "../internal/use-render.js";
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
   * Runs inside this part's own transition, then closes the dialog with `close(value)`. A
   * rejection reaches the nearest Error Boundary above the Close part and leaves the dialog open.
   * Without `action` the button is a native `command="request-close"` invoker (JS-free).
   */
  action?: Action<[details: DialogCloseDetails]>;
  /** Becomes `dialog.returnValue` (and `details.returnValue` of the close notification). */
  value?: string;
  disabled?: boolean;
  className?: StateValue<string | undefined, DialogCloseState>;
  style?: StateValue<CSSProperties | undefined, DialogCloseState>;
  children?: StateValue<ReactNode, DialogCloseState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, DialogCloseState>;
}

const isDev = process.env.NODE_ENV !== "production";

/**
 * A close button: `<button type="button" commandfor command="request-close">`. Without `action`
 * the browser closes the dialog (a close request: `cancel`, then `close`), with `value` as the
 * `returnValue`. With `action` the click is cancelled, the action runs in this part's own
 * transition (`data-pending` on the button) and the dialog closes with `close(value)` once it
 * resolves; a rejection leaves the dialog open.
 *
 * Owned keys (conventions 1.2): `type` (on a `<button>` only), `disabled`, `commandfor`,
 * `command`, `value`, `onClick` (with `action`), `data-pending`, `data-disabled`.
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
  const [pending, startOwnTransition] = useTransition();
  const { ids, dialogRef, recordCloseIntent } = ctx;
  const hasAction = action !== undefined;

  const state: DialogCloseState = { pending, disabled };

  const devRef = useCallback(
    (element: HTMLElement) => {
      if (isDev && !hasAction && element.tagName !== "BUTTON") {
        console.error(
          `Dialog.Close: rendered a <${element.tagName.toLowerCase()}> without \`action\`. Only a ` +
            '<button> runs `command="request-close"`; this element will not close the dialog.',
        );
      }
      // A cleanup, so the merged ref never calls back with `null`.
      return () => {};
    },
    [hasAction],
  );

  const onClick = (event: MouseEvent<HTMLElement>) => {
    if (action === undefined) return;
    // Cancelling the click cancels the command.
    event.preventDefault();
    if (disabled) return;
    const native = event.nativeEvent;
    const returnValue = value ?? "";
    const details = createActionDetails(native, { returnValue });
    startOwnTransition(async () => {
      await action(details);
      // Repeated clicks re-run the action; the first `close()` wins (design 3.4).
      const dialog = dialogRef.current;
      if (dialog === null || !dialog.open) return;
      recordCloseIntent({ reason: "activate", event: native });
      dialog.close(returnValue);
    });
  };

  const libraryProps: ComponentPropsWithRef<"button"> & DataAttributes = {
    ...(rendersButton(render) && { type: "button" as const }),
    // Owned: a render element must not re-enable a disabled Close.
    disabled,
    commandfor: ids.dialog,
    command: "request-close",
    value,
    ...(hasAction && { onClick }),
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

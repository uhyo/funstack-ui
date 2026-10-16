"use client";
import { useCallback, useEffect } from "react";
import type { ComponentPropsWithRef, CSSProperties, MouseEvent, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { rendersButton, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { useDialogContext } from "./dialog-context.js";

export interface DialogTriggerState {
  /** Optimistic open state (library mode); `false` in JS-free mode. */
  readonly open: boolean;
  /**
   * The Root's transition is pending: an open in flight, a close notification in flight, or a
   * re-open requested while a close notification is still settling.
   */
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface DialogTriggerProps extends Omit<
  ComponentPropsWithRef<"button">,
  "onClick" | "className" | "style" | "children"
> {
  /** Native `disabled`: a disabled button is not a valid invoker and never dispatches. */
  disabled?: boolean;
  className?: StateValue<string | undefined, DialogTriggerState>;
  style?: StateValue<CSSProperties | undefined, DialogTriggerState>;
  /** Rendered from optimistic state; must not suspend. */
  children?: StateValue<ReactNode, DialogTriggerState>;
  /** Should render a `<button>`; another element works only in library mode (click handler). */
  render?: RenderProp<ComponentPropsWithRef<"button">, DialogTriggerState>;
}

const isDev = process.env.NODE_ENV !== "production";

/**
 * The opener: `<button type="button" commandfor command="show-modal">`. In JS-free mode the
 * browser runs the command. In library mode the click is cancelled (so the command does not run)
 * and dispatched through the Root's transition; the button shows optimistic `data-open` and
 * `data-pending` until the dialog has opened. Non-modal dialogs have no command and always use a
 * click handler (`show()`).
 *
 * Owned keys (conventions 1.2): `type` (on a `<button>` only), `disabled`, `commandfor`,
 * `command`, `onClick`, `data-open`, `data-pending`, `data-disabled`.
 */
export function DialogTrigger({
  disabled = false,
  className,
  style,
  children,
  render,
  ...rest
}: DialogTriggerProps) {
  const ctx = useDialogContext("Dialog.Trigger");
  const isLibrary = ctx.mode === "library";
  const { modal, ids, triggerRef, dialogRef } = ctx;

  const state: DialogTriggerState = {
    open: ctx.optimistic,
    // Every Root dispatch is an open or a close notification and both belong to the Trigger
    // (design 4.2). Not `optimistic !== committed`: a re-open while a close notification is
    // still settling has both `true` (the close never committed) and is pending all the same.
    pending: ctx.pending,
    disabled,
  };

  const libraryRef = useCallback(
    (element: HTMLElement) => {
      if (isDev && !isLibrary && modal && element.tagName !== "BUTTON") {
        console.error(
          `Dialog.Trigger: rendered a <${element.tagName.toLowerCase()}> in JS-free mode. Only a ` +
            '<button> runs `command="show-modal"`; this trigger will not open the dialog. Render ' +
            "a <button>, or put the Dialog in library mode (`defaultOpen={false}`).",
        );
      }
      triggerRef.current = element;
      return () => {
        if (triggerRef.current === element) triggerRef.current = null;
      };
    },
    [isLibrary, modal, triggerRef],
  );

  // A Trigger without a Popup opens nothing (design 14, dev warnings).
  useEffect(() => {
    if (!isDev) return;
    if (document.getElementById(ids.dialog) === null) {
      console.error(
        "Dialog.Trigger: no Dialog.Popup is rendered for this Dialog.Root; the trigger opens nothing.",
      );
    }
  }, [ids.dialog]);

  // Library mode (both modal and non-modal) and non-modal JS-free mode need a click handler;
  // modal JS-free mode is the browser's command.
  const installClick = isLibrary || !modal;
  const onClick = (event: MouseEvent<HTMLElement>) => {
    if (isLibrary) {
      // Cancelling the click cancels the command (it runs as the button's activation
      // behaviour, only if the click was not cancelled).
      event.preventDefault();
      if (disabled) return;
      ctx.requestOpen(event.nativeEvent, "activate");
      return;
    }
    if (disabled) return;
    const dialog = dialogRef.current;
    if (dialog !== null && !dialog.open && dialog.isConnected) dialog.show();
  };

  const libraryProps: ComponentPropsWithRef<"button"> & DataAttributes = {
    // `type` only applies to a <button>; on any other element the key is not owned.
    ...(rendersButton(render) && { type: "button" as const }),
    // Owned: a render element must not re-enable a disabled Trigger (in JS-free mode the
    // browser would run its command).
    disabled,
    commandfor: modal ? ids.dialog : undefined,
    command: modal ? "show-modal" : undefined,
    // Only owned when installed, so a render element keeps its own `onClick` in modal JS-free
    // mode (Accordion's rule).
    ...(installClick && { onClick }),
    "data-open": dataAttr(state.open),
    "data-pending": dataAttr(state.pending),
    "data-disabled": dataAttr(isLibrary && disabled),
  };

  return useRender<ComponentPropsWithRef<"button">, DialogTriggerState>({
    defaultElement: "button",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps,
    ref: libraryRef,
  });
}

DialogTrigger.displayName = "DialogTrigger";

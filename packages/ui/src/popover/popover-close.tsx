"use client";
import { useCallback } from "react";
import type { ComponentPropsWithRef, CSSProperties, MouseEvent, ReactNode } from "react";
import { createActionDetails } from "../internal/action-details.js";
import { dataAttr } from "../internal/data-attr.js";
import type { Action, ActionDetails, RenderProp, StateValue } from "../internal/types.js";
import { useActionTrigger } from "../internal/use-action-trigger.js";
import { rendersButton, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { usePopoverContext } from "./popover-context.js";

export interface PopoverCloseState {
  /** The `action` is in flight. */
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface PopoverCloseProps extends Omit<
  ComponentPropsWithRef<"button">,
  "onClick" | "className" | "style" | "children"
> {
  /**
   * Runs inside this part's own transition (`data-pending` on the button), then closes the
   * popover: in library mode through the Root (`openChangeAction(false)` awaited, view
   * transition if set), in JS-free mode with `hidePopover()`. A rejection reaches the nearest
   * Error Boundary above the Close part and leaves the popover open. If the popover was
   * dismissed and opened again while the action ran, the close is dropped. Without `action` in JS-free
   * mode the button is a native `command="hide-popover"` invoker.
   */
  action?: Action<[details: ActionDetails]>;
  /** Native `disabled`; owned, so a `render` element cannot re-enable the button. */
  disabled?: boolean;
  className?: StateValue<string | undefined, PopoverCloseState>;
  style?: StateValue<CSSProperties | undefined, PopoverCloseState>;
  children?: StateValue<ReactNode, PopoverCloseState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, PopoverCloseState>;
}

const isDev = process.env.NODE_ENV !== "production";

function isPopoverOpen(element: Element): boolean {
  try {
    return element.matches(":popover-open");
  } catch {
    return false;
  }
}

/**
 * A close button: `<button type="button" commandfor command="hide-popover">`. In JS-free mode
 * without `action` the browser hides the popover. In library mode the click is always cancelled
 * and the close goes through the Root (`openChangeAction(false)` awaited, `hidePopover()` in the
 * commit). With `action` the action runs first in this part's own transition (`data-pending` on
 * the button, with `aria-disabled`; a second click meanwhile is ignored); a rejection leaves the
 * popover open.
 *
 * Owned keys (conventions 1.2): `type` (on a `<button>` only), `disabled`, `commandfor`,
 * `command`, `onClick` (library mode, or with `action`), `aria-disabled`, `data-pending`,
 * `data-disabled`.
 */
export function PopoverClose({
  action,
  disabled = false,
  className,
  style,
  children,
  render,
  ...rest
}: PopoverCloseProps) {
  const ctx = usePopoverContext("Popover.Close");
  const { ids, popupRef, recordCloseIntent, openGeneration } = ctx;
  const { pending, run } = useActionTrigger({ openGeneration });
  const isLibrary = ctx.mode === "library";
  const hasAction = action !== undefined;
  const installClick = isLibrary || hasAction;

  const state: PopoverCloseState = { pending, disabled };

  const devRef = useCallback(
    (element: HTMLElement) => {
      if (isDev && !installClick && element.tagName !== "BUTTON") {
        console.error(
          `Popover.Close: rendered a <${element.tagName.toLowerCase()}> in JS-free mode without ` +
            '`action`. Only a <button> runs `command="hide-popover"`; this element will not ' +
            "close the popover.",
        );
      }
      // A cleanup, so the merged ref never calls back with `null`.
      return () => {};
    },
    [installClick],
  );

  const close = (event: Event): void => {
    if (isLibrary) {
      // A library-owned close (design 2.3): awaited, then hidden in the commit.
      ctx.requestClose(event, "activate");
      return;
    }
    // JS-free mode with `action`: a browser-owned close; there is no Root state to notify.
    const popup = popupRef.current;
    if (popup === null || !popup.isConnected || !isPopoverOpen(popup)) return;
    recordCloseIntent({ reason: "activate", event });
    popup.hidePopover();
  };

  const onClick = (event: MouseEvent<HTMLElement>) => {
    // Cancelling the click cancels the command.
    event.preventDefault();
    if (disabled) return;
    const native = event.nativeEvent;
    if (action === undefined) {
      close(native);
      return;
    }
    const details = createActionDetails(native, {});
    // A second activation while this Close's own run is in flight starts nothing (the hook's
    // guard; the click is already cancelled above, #81). A close whose open was superseded by a
    // newer one (dismissed and re-opened meanwhile) is dropped by the hook.
    run(
      () => action(details),
      () => close(native),
    );
  };

  const libraryProps: ComponentPropsWithRef<"button"> & DataAttributes = {
    ...(rendersButton(render) && { type: "button" as const }),
    // Owned: a render element must not re-enable a disabled Close.
    disabled,
    commandfor: ids.popup,
    command: "hide-popover",
    ...(installClick && { onClick }),
    // Exactly while `data-pending` (#81): a Close that will not act is unavailable to AT. Owned,
    // so an idle Close removes a render element's own `aria-disabled`.
    "aria-disabled": pending ? true : undefined,
    "data-pending": dataAttr(pending),
    "data-disabled": dataAttr(disabled),
  };

  return useRender<ComponentPropsWithRef<"button">, PopoverCloseState>({
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

PopoverClose.displayName = "PopoverClose";

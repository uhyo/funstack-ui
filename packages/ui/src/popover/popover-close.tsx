"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { createActionDetails } from "../internal/action-details.js";
import { isPopoverOpen } from "../internal/popover-open.js";
import type { Action, ActionDetails, RenderProp, StateValue } from "../internal/types.js";
import { useOverlayClose } from "../internal/use-overlay-close.js";
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
  /**
   * Never closes. Native `disabled` on a `<button>`; owned, so a `render` element cannot
   * re-enable it. With a link or component `render` whose click this part handles (library mode,
   * or with `action`), `aria-disabled="true"` instead: the element stays focusable.
   */
  disabled?: boolean;
  className?: StateValue<string | undefined, PopoverCloseState>;
  style?: StateValue<CSSProperties | undefined, PopoverCloseState>;
  children?: StateValue<ReactNode, PopoverCloseState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, PopoverCloseState>;
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
  const { popupRef, recordCloseIntent } = ctx;
  const isLibrary = ctx.mode === "library";
  return useOverlayClose({
    part: "Popover.Close",
    noun: "popover",
    isLibrary,
    popupId: ctx.ids.popup,
    command: "hide-popover",
    openGeneration: ctx.openGeneration,
    action,
    details: (event) => createActionDetails(event, {}),
    close: (event) => {
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
    },
    disabled,
    className,
    style,
    children,
    render,
    rest,
  });
}

PopoverClose.displayName = "PopoverClose";

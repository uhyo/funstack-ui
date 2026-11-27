"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { createActionDetails } from "../internal/action/action-details.js";
import { isPopoverOpen } from "../internal/overlay/popover-open.js";
import type {
  Action,
  ActionDetails,
  RenderProp,
  StateValue,
  WhilePending,
} from "../internal/types.js";
import { useOverlayClose } from "../internal/overlay/use-overlay-close.js";
import { usePopoverContext } from "./popover-context.js";

/**
 * State of `Popover.Close`, passed to the function forms of `className`, `style`, `children` and
 * `render`.
 */
export interface PopoverCloseState {
  /**
   * From the click until the close this part asked for has committed: the `action` in flight,
   * then the Root's close (an awaited `openChangeAction(false)`, or another pending action the
   * close is entangled with). Also without `action`, in library mode.
   */
  readonly pending: boolean;
  /** The `disabled` prop. */
  readonly disabled: boolean;
}

/**
 * Props of `Popover.Close`.
 *
 * @see https://ui.funstack.work/components/popover
 */
export interface PopoverCloseProps extends Omit<
  ComponentPropsWithRef<"button">,
  "onClick" | "className" | "style" | "children"
> {
  /**
   * Runs inside this part's own transition (`data-pending` on the button), then closes the
   * popover: in library mode through the Root (`openChangeAction(false)` awaited, view
   * transition if set), in JS-free mode with `hidePopover()`. A rejection reaches the nearest
   * Error Boundary above the Close part and leaves the popover open. If the popover was
   * dismissed and opened again while the action ran, the close is dropped. With `action` the
   * button is no native close invoker (no `commandfor` / `command`), so a click before hydration
   * does nothing instead of hiding the popover without running the action. Without `action` in
   * JS-free mode the button is a native `command="hide-popover"` invoker.
   */
  action?: Action<[details: ActionDetails]>;
  /**
   * What a click does while this part's `action` is pending. `"ignore"`: nothing (the click is
   * cancelled, `aria-disabled="true"` meanwhile). `"run"`: the action runs again (`data-pending`
   * until every run has settled); the popover closes once, when the last run settles and only
   * if the latest run resolved (a rejection leaves it open, as in `"ignore"` mode). No effect
   * without `action`: the part then shows `data-pending` while the Root's close waits, without
   * `aria-disabled`.
   *
   * @defaultValue `"ignore"`
   */
  whilePending?: WhilePending;
  /**
   * Never closes. Native `disabled` on a `<button>`; owned, so a `render` element cannot
   * re-enable it. With a link or component `render` whose click this part handles (library mode,
   * or with `action`), `aria-disabled="true"` instead: the element stays focusable.
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, PopoverCloseState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, PopoverCloseState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, PopoverCloseState>;
  /** Replace the default `<button>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"button">, PopoverCloseState>;
}

/**
 * A close button: `<button type="button" commandfor command="hide-popover">`, or a plain
 * `<button type="button">` with `action` (it does nothing before hydration). In JS-free mode
 * without `action` the browser hides the popover. In library mode the click is always cancelled
 * and the close goes through the Root (`openChangeAction(false)` awaited, `hidePopover()` in the
 * commit). With `action` the action runs first in this part's own transition (`data-pending` on
 * the button, with `aria-disabled`; a second click meanwhile is ignored unless
 * `whilePending="run"`); a rejection leaves the
 * popover open. With or without `action`, the button has `data-pending` until the close it
 * asked for has committed. It keeps `commandfor` where the Trigger has `popovertarget`: an invoker
 * inside its own popover exposes no state either way, and the `command` event tells the Popup a
 * foreign hide's reason.
 *
 * Owned keys (conventions 1.2): `type` (on a `<button>` only), `disabled`, `commandfor`,
 * `command` (neither rendered with `action`), `onClick` (library mode, or with `action`), `aria-disabled`, `data-pending`,
 * `data-disabled`.
 *
 * @see https://ui.funstack.work/components/popover
 */
export function PopoverClose({
  action,
  whilePending,
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
    whilePending,
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

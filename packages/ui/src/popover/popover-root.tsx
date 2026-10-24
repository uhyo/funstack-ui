"use client";
import type { ReactNode } from "react";
import type { ActionDetails, ChangeAction, ChangeReason, StateValue } from "../internal/types.js";
import { popoverDetails, useOverlayRoot } from "../internal/use-overlay-root.js";
import { resolveStateValue } from "../internal/use-render.js";
import { PopoverContext } from "./popover-context.js";

/** Details passed as the second argument of `openChangeAction`. */
export interface PopoverOpenChangeDetails extends ActionDetails {
  /**
   * `"activate"`: the user acted on a part: Trigger (open or close), Close, or a foreign invoker
   * (`details.event` is a `CommandEvent` / `ToggleEvent` then).
   * `"dismiss"`: the user closed the popover without a part: Escape, Android back, an assistive-
   * technology dismiss gesture, a click outside; or script / another top-layer element hid it.
   * `"platform"`: the popover was found open on mount (opened before hydration); `event` is
   * `undefined`.
   */
  readonly reason: ChangeReason;
}

export interface PopoverRootState {
  /** Optimistic open state (`false` in JS-free mode). Content rendered from it must not suspend. */
  readonly open: boolean;
  /** An `openChangeAction` dispatched through this Popover is in flight (library mode only). */
  readonly pending: boolean;
}

export interface PopoverRootProps {
  /**
   * Controlled open state. `undefined` means uncontrolled (and, with `defaultOpen` and
   * `openChangeAction` also absent, JS-free mode).
   */
  open?: boolean;
  /**
   * Initial open state in uncontrolled library mode. Opens after hydration, never in the server
   * HTML.
   */
  defaultOpen?: boolean;
  /**
   * Awaited for `true` (the popover opens when it resolves and the content has rendered) and for
   * a `false` the user asked a part for (Trigger, Close: the popover hides when it resolves, with
   * a view transition if `transition` is set; a controlled parent that keeps `open` vetoes it).
   * A notification for a dismissal (Escape, click outside: the popover is already hidden; the
   * action runs inside the Root's transition, and a controlled parent that keeps `open` gets it
   * re-opened, which is not a veto). May be a Server Function. Rejections reach the nearest
   * Error Boundary above Root.
   *
   * A `setState` placed after your own `await` is not a Transition update; wrap it in
   * `startTransition` (React limitation).
   */
  openChangeAction?: ChangeAction<boolean, PopoverOpenChangeDetails>;
  children?: StateValue<ReactNode, PopoverRootState>;
}

/**
 * Owns the ids, the mode, the open state and the context. Renders no DOM, so it has no `ref`,
 * `className` or `style`; `pending` is exposed through `children(state)` and the Trigger.
 *
 * Without `open`, `defaultOpen` and `openChangeAction` the Popover runs in **JS-free mode**: the
 * Trigger is a native `popovertarget` invoker and the browser owns everything. With any
 * of them it runs in **library mode**: opening and the closes the user asks a part for are
 * transitions (the Trigger shows `data-pending`, content renders from committed state,
 * `showPopover()` / `hidePopover()` run when the change has committed); dismissals are the
 * browser's and `openChangeAction(false)` is a notification.
 */
export function PopoverRoot({ open, defaultOpen, openChangeAction, children }: PopoverRootProps) {
  const context = useOverlayRoot<PopoverOpenChangeDetails>({
    component: "popover",
    part: "Popover.Root",
    open,
    defaultOpen,
    openChangeAction,
    details: popoverDetails,
  });

  const state: PopoverRootState = { open: context.optimistic, pending: context.pending };

  return <PopoverContext value={context}>{resolveStateValue(children, state)}</PopoverContext>;
}

PopoverRoot.displayName = "PopoverRoot";

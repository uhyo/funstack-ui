"use client";
import { useMemo } from "react";
import type { ReactNode } from "react";
import type {
  ActionDetails,
  ChangeAction,
  ChangeReason,
  StateValue,
  UrgentChangeHandler,
} from "../internal/types.js";
import { popoverDetails, usePopoverRoot } from "../internal/overlay/use-overlay-root.js";
import { resolveStateValue } from "../internal/use-render.js";
import { useTitleDescriptionPresence } from "../internal/use-title-description.js";
import { PopoverContext } from "./popover-context.js";
import type { PopoverContextValue } from "./popover-context.js";

/** Details passed as the second argument of `openChangeAction` and `onOpenChange`. */
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

/** State of `Popover.Root`, passed to the function forms of `children`. */
export interface PopoverRootState {
  /** Optimistic open state (`false` in JS-free mode). Content rendered from it must not suspend. */
  readonly open: boolean;
  /** An `openChangeAction` dispatched through this Popover is in flight (library mode only). */
  readonly pending: boolean;
}

/**
 * Props of `Popover.Root`.
 *
 * @see https://ui.funstack.work/components/popover
 */
export interface PopoverRootProps {
  /**
   * Controlled open state. `undefined` means uncontrolled (and, with `defaultOpen`,
   * `openChangeAction` and `onOpenChange` also absent, JS-free mode). A controlled Root needs
   * `onOpenChange` too: the browser closes the popover without asking (development warns).
   */
  open?: boolean;
  /**
   * Initial open state in uncontrolled library mode. Opens after hydration, never in the server
   * HTML.
   */
  defaultOpen?: boolean;
  /**
   * Requests only. Awaited for `true` (the popover opens when it resolves and the content has
   * rendered) and for a `false` the user asked a part for (Trigger, Close: the popover hides
   * when it resolves, with a view transition if `transition` is set; a controlled parent that
   * keeps `open` vetoes it). Never called for a dismissal: that goes to `onOpenChange`. May be a
   * Server Function. Rejections reach the nearest Error Boundary above Root.
   *
   * A `setState` placed after your own `await` is not a Transition update; wrap it in
   * `startTransition` (React limitation).
   */
  openChangeAction?: ChangeAction<boolean, PopoverOpenChangeDetails>;
  /**
   * Facts only: the popover was closed without the library closing it (Escape, a click outside,
   * Android back, another top-layer element, script `hidePopover()`, a foreign invoker button,
   * lost interest). Always `false`. Called synchronously in the platform's `toggle` event,
   * outside any Transition, and not awaited: nothing is pending and no view transition runs; the
   * popover is already hidden and its committed state is already `false` (uncontrolled).
   *
   * Controlled: set your state **directly** here (`onOpenChange={setOpen}`), not in
   * `startTransition` and not after an `await`; a parent that keeps `open={true}` gets the
   * popover re-opened at once. May return a promise (a Server Function); a rejection or a throw
   * goes to `reportError`.
   */
  onOpenChange?: UrgentChangeHandler<boolean, PopoverOpenChangeDetails>;
  /** The parts. The function form receives the optimistic state and must not suspend. */
  children?: StateValue<ReactNode, PopoverRootState>;
}

/**
 * Owns the ids, the mode, the open state and the context. Renders no DOM, so it has no `ref`,
 * `className` or `style`; `pending` is exposed through `children(state)` and the Trigger.
 *
 * Without `open`, `defaultOpen`, `openChangeAction` and `onOpenChange` the Popover runs in
 * **JS-free mode**: the Trigger is a native `popovertarget` invoker and the browser owns
 * everything. With any of them it runs in **library mode**: opening and the closes the user asks
 * a part for are requests, transitions through `openChangeAction` (the Trigger shows
 * `data-pending`, content renders from committed state, `showPopover()` / `hidePopover()` run
 * when the change has committed); dismissals are the browser's facts, reported to
 * `onOpenChange`.
 *
 * @see https://ui.funstack.work/components/popover
 */
export function PopoverRoot({
  open,
  defaultOpen,
  openChangeAction,
  onOpenChange,
  children,
}: PopoverRootProps) {
  const root = usePopoverRoot<PopoverOpenChangeDetails>({
    component: "popover",
    part: "Popover.Root",
    open,
    defaultOpen,
    openChangeAction,
    onOpenChange,
    details: popoverDetails,
  });
  // The Popup names a Title and a Description only while they are mounted (conventions 1.1.1, #218).
  const parts = useTitleDescriptionPresence(root.ids);
  const context = useMemo<PopoverContextValue>(() => ({ ...root, parts }), [root, parts]);

  const state: PopoverRootState = { open: context.optimistic, pending: context.pending };

  return <PopoverContext value={context}>{resolveStateValue(children, state)}</PopoverContext>;
}

PopoverRoot.displayName = "PopoverRoot";

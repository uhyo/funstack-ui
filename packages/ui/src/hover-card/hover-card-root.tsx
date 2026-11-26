"use client";
import { useMemo, useRef, useState } from "react";
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
import { HoverCardContext } from "./hover-card-context.js";
import type { HoverCardContextValue } from "./hover-card-context.js";
import { useHoverCardInterest } from "./use-hover-card-interest.js";

/** Details passed as the second argument of `openChangeAction` and `onOpenChange`. */
export interface HoverCardOpenChangeDetails extends ActionDetails {
  /**
   * `"activate"`: the user showed interest in the Trigger (hover or keyboard focus held for
   * `delay`), or something else opened the card (`details.event` is a `ToggleEvent` then).
   * `"dismiss"`: every close: lost interest, Escape, a press outside the card (the Trigger
   * included).
   * `"platform"`: the card was found open on mount; `event` is `undefined`.
   */
  readonly reason: ChangeReason;
}

/** State of `HoverCard.Root`, passed to the function forms of `children`. */
export interface HoverCardRootState {
  /** Optimistic open state. Content rendered from it must not suspend. */
  readonly open: boolean;
  /** A request (`openChangeAction`) dispatched through this HoverCard is in flight. */
  readonly pending: boolean;
  /** The `disabled` prop. */
  readonly disabled: boolean;
}

/**
 * Props of `HoverCard.Root`.
 *
 * @see https://ui.funstack.work/components/hover-card
 */
export interface HoverCardRootProps {
  /**
   * Controlled open state. A controlled Root needs `onOpenChange` too: every close the user
   * causes is a fact (development warns without it).
   */
  open?: boolean;
  /** Initial open state when uncontrolled. Shown after hydration, never in the server HTML. */
  defaultOpen?: boolean;
  /**
   * Requests only. Awaited for `true` when the user shows interest: the card appears when it
   * resolves and the content has rendered. Called with `false` only to cancel an open that has
   * not appeared yet (the user moved on). Never called for the close of a shown card: that goes
   * to `onOpenChange`. May be a Server Function. Rejections reach the nearest Error Boundary
   * above Root, which takes the Trigger with it: catch inside the action, or load in the content
   * with an Error Boundary inside the Popup.
   *
   * A `setState` placed after your own `await` is not a Transition update; wrap it in
   * `startTransition` (React limitation).
   */
  openChangeAction?: ChangeAction<boolean, HoverCardOpenChangeDetails>;
  /**
   * Facts only: the card was closed (lost interest, Escape, a press outside). Always `false`.
   * Called synchronously, outside any Transition, not awaited. A controlled Root adopts it
   * directly (`onOpenChange={setOpen}`); a parent that keeps `open={true}` gets the card
   * re-shown. May return a promise; a rejection or a throw goes to `reportError`.
   */
  onOpenChange?: UrgentChangeHandler<boolean, HoverCardOpenChangeDetails>;
  /**
   * Milliseconds of interest (hover or keyboard focus) before the open is requested.
   *
   * @defaultValue `600`
   */
  delay?: number;
  /**
   * Milliseconds from losing interest to the close.
   *
   * @defaultValue `300`
   */
  closeDelay?: number;
  /**
   * When true, interest never opens the card, and a shown card is closed (a dismissal). Does not
   * disable the Trigger: a link still navigates. A controlled `open={true}` still shows the card.
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
  /** The parts. The function form receives the optimistic state and must not suspend. */
  children?: StateValue<ReactNode, HoverCardRootState>;
}

/**
 * Owns the ids, the open state (Popover's library mode: opening is a request, every close the
 * user causes is a fact), `delay` / `closeDelay` / `disabled`, and the interest effect. Renders
 * no DOM, so it has no `ref`, `className` or `style`; `pending` is exposed through
 * `children(state)` and the Trigger.
 *
 * Render `HoverCard.Popup` immediately after `HoverCard.Trigger` in DOM order: Tab from the
 * Trigger then enters the open card in every engine.
 *
 * @see https://ui.funstack.work/components/hover-card
 */
export function HoverCardRoot({
  open,
  defaultOpen,
  openChangeAction,
  onOpenChange,
  delay = 600,
  closeDelay = 300,
  disabled = false,
  children,
}: HoverCardRootProps) {
  const popover = usePopoverRoot<HoverCardOpenChangeDetails>({
    component: "hover-card",
    part: "HoverCard.Root",
    // One mode: no JS-free mode (design 2.5, conventions 3.9.11).
    mode: "library",
    open,
    defaultOpen,
    openChangeAction,
    onOpenChange,
    details: popoverDetails,
  });

  const [trigger, setTriggerElement] = useState<HTMLElement | null>(null);
  const [popup, setPopupElement] = useState<HTMLElement | null>(null);
  const [interestForRequested, setInterestForRequested] = useState(false);
  const suppressed = useRef(false);

  useHoverCardInterest(popover, trigger, popup, {
    delay,
    closeDelay,
    disabled,
    interestForRequested,
    suppressed,
    active: popover.optimistic || popover.committed,
  });

  const context = useMemo<HoverCardContextValue>(
    () => ({
      ...popover,
      disabled,
      delay,
      closeDelay,
      suppressed,
      setTriggerElement,
      setPopupElement,
      setInterestForRequested,
    }),
    [popover, disabled, delay, closeDelay],
  );

  const state: HoverCardRootState = {
    open: popover.optimistic,
    pending: popover.pending,
    disabled,
  };

  return <HoverCardContext value={context}>{resolveStateValue(children, state)}</HoverCardContext>;
}

HoverCardRoot.displayName = "HoverCardRoot";

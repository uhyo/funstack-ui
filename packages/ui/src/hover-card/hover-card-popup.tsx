"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode, ViewTransitionClass } from "react";
import type { AnchorAlign, AnchorSide } from "../internal/overlay/anchor-position.js";
import { eventSource } from "../internal/overlay/invokers.js";
import { usePopoverPopup } from "../internal/overlay/use-popover-popup.js";
import { useAnchoredPlacement } from "../internal/overlay/use-resolved-placement.js";
import { useTransitionBoundary } from "../internal/transition-boundary.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useMergedRefs } from "../internal/use-merged-refs.js";
import { useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { resolveStateValue } from "../internal/use-render.js";
import { useHoverCardContext } from "./hover-card-context.js";
import { blurFocusInside } from "./use-hover-card-interest.js";

/** `inline-start` / `inline-end` follow the popup's `direction` (conventions 13.1). */
export type HoverCardSide = AnchorSide;
/**
 * Alignment of the Popup along its side: inline-relative on a top / bottom side, the top / bottom
 * edges on the others.
 */
export type HoverCardAlign = AnchorAlign;

/**
 * State of `HoverCard.Popup`, passed to the function forms of `className`, `style`, `children`
 * and `render`.
 */
export interface HoverCardPopupState {
  /** Committed open state. Read `:popover-open` for the DOM truth. */
  readonly open: boolean;
  /**
   * While shown: the physical side the browser placed the card on (after any fallback flip;
   * conventions 13.2). Otherwise the `side` prop. `null` with `side={null}`.
   */
  readonly side: HoverCardSide | null;
  /** While shown: the resolved alignment; otherwise the `align` prop. */
  readonly align: HoverCardAlign;
}

/**
 * Props of `HoverCard.Popup`.
 *
 * @see https://ui.funstack.work/components/hover-card
 */
export interface HoverCardPopupProps extends Omit<
  ComponentPropsWithRef<"div">,
  "id" | "popover" | "onToggle" | "onBeforeToggle" | "className" | "style" | "children"
> {
  /**
   * Placement relative to the Trigger through inline `position-area`, with
   * `position-try-fallbacks` flipping it when it does not fit. `null` emits no inline positioning
   * (and no `data-side` / `data-align`), so a stylesheet owns placement.
   *
   * @defaultValue `"bottom"`
   */
  side?: HoverCardSide | null;
  /**
   * Alignment along the side. Ignored when `side` is `null`.
   *
   * @defaultValue `"center"`
   */
  align?: HoverCardAlign;
  /**
   * What happens to the children while the card is closed.
   * - `false` (default): not rendered. Mounting them is part of the opening transition, so
   *   content that suspends holds the open (the Trigger is `data-pending`) until it is ready.
   * - `true`: rendered inside `<Activity mode="hidden">`: pre-rendered at low priority, state
   *   kept. Suits a single prominent card, not a list of them.
   *
   * @defaultValue `false`
   */
  keepMounted?: boolean;
  /**
   * Experimental (Chrome 151+, Firefox 153+; Safari 27.2 treats it as `"manual"`). Renders
   * `popover="hint"` instead of `"manual"`: opening the card closes an open Tooltip or other
   * hint, and the browser's light dismiss applies next to the library's.
   *
   * @defaultValue `false`
   */
  experimental_hint?: boolean;
  /**
   * Forwarded to the `<ViewTransition default>` around the popover element. Animates the opening
   * commit, content changes while open (a skeleton swapped for the content) and a controlled
   * close. Every close the user causes is a fact and animates with CSS only.
   *
   * Static: setting or unsetting it remounts the element. Any value, `"none"` included, makes a
   * mount or `<Activity>` reveal of the Popup inside a transition start a document view
   * transition (a ~250 ms page cross-fade that the next transition waits for); a plain open
   * starts none, as the content mounts under the already-mounted popup element. While a view
   * transition runs, the popup's CSS transitions are cut for the moment of the library's own
   * show or hide (an inline `transition: none !important`, restored right after), so only the
   * view transition animates it; a `@keyframes` animation is not cut, and a dismissal, which
   * runs no view transition, keeps its CSS exit.
   */
  transition?: ViewTransitionClass;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, HoverCardPopupState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, HoverCardPopupState>;
  /** Content, or a function of the part's state. Rendered from committed state; may suspend. */
  children?: StateValue<ReactNode, HoverCardPopupState>;
  /** A `<div>` (default) or a `<span>` for a card inside running text (phrasing content only). */
  render?: RenderProp<ComponentPropsWithRef<"div">, HoverCardPopupState>;
}

/** The card may be a `<span>` inside running text (design 1.1). */
const POPUP_ELEMENTS: readonly string[] = ["DIV", "SPAN"];

/**
 * The card: a `<div popover="manual" role="group">` placed against the Trigger with CSS Anchor
 * Positioning. Its children render from committed state, so they mount in the opening transition
 * and content that suspends holds the open; `showPopover({ source: trigger })` runs in the layout
 * effect of the commit that mounted them, always as a no-focus show (the card is `inert` for the
 * call). Every close the user causes (lost interest, Escape, a press outside) is a fact: the
 * native `toggle` makes committed state `false` urgently and calls `onOpenChange(false, { reason:
 * "dismiss" })`.
 *
 * Style it with `:popover-open`; it emits `data-side` / `data-align` (the resolved placement
 * while shown) but no `data-open`.
 *
 * Owned keys (conventions 1.2): `id`, `popover`, and `data-side` / `data-align` unless `side` is
 * `null`. `role` is a default (`"group"`) the consumer may override.
 *
 * @see https://ui.funstack.work/components/hover-card
 */
export function HoverCardPopup({
  side: sideProp = "bottom",
  align: alignProp = "center",
  keepMounted,
  experimental_hint = false,
  transition,
  className,
  style,
  children,
  render,
  ...rest
}: HoverCardPopupProps) {
  const ctx = useHoverCardContext("HoverCard.Popup");
  const { ids, suppressed, triggerRef } = ctx;

  const { setElement, renderContent } = usePopoverPopup(ctx, {
    part: "HoverCard.Popup",
    keepMounted,
    transition,
    // Opening never moves focus (design 6.2).
    quietShow: true,
    // No open until fresh interest (design 2.4): the flagged path's interest show after Escape,
    // a press on the Trigger or the library's focus return is cancelled and dispatches nothing.
    allowOpen: (event) => !(suppressed.current && eventSource(event) === triggerRef.current),
    elements: POPUP_ELEMENTS,
    // The flagged path's lost-interest hide returns no focus to the Trigger (design 6.2): with
    // `hint` the platform would restore it there, and that focus is interest again.
    beforeInterestHide: blurFocusInside,
    // Escape and a press outside work from the dispatch of a routed open (design 2.2).
    onRoutedOpen: () => ctx.listenDocumentNow(),
  });

  const placement = useAnchoredPlacement({ side: sideProp, align: alignProp });
  const { side, align } = placement;
  const ref = useMergedRefs(setElement, placement.ref, ctx.setPopupElement);

  const state: HoverCardPopupState = { open: ctx.committed, side, align };

  const libraryProps: ComponentPropsWithRef<"div"> & DataAttributes = {
    id: ids.popup,
    popover: experimental_hint ? "hint" : "manual",
    ...placement.dataAttributes,
  };

  const element = useRender<ComponentPropsWithRef<"div">, HoverCardPopupState>({
    defaultElement: "div",
    render,
    state,
    className,
    // The consumer's style wins over the inline placement.
    style: placement.style(style),
    children: (s: HoverCardPopupState) => renderContent(() => resolveStateValue(children, s)),
    // `role` is a default the consumer's `rest` overrides (design 7): HTML-AAM's minimum role for
    // a popover, which WebKit does not apply by itself.
    props: { role: "group", ...rest },
    libraryProps,
    ref,
  });

  return useTransitionBoundary("HoverCard.Popup", transition, element);
}

HoverCardPopup.displayName = "HoverCardPopup";

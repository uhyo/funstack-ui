"use client";
import { useEffect, useRef } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode, ViewTransitionClass } from "react";
import type { AnchorAlign, AnchorSide } from "../internal/overlay/anchor-position.js";
import { listenInvokerPresses } from "../internal/overlay/invokers.js";
import { useJsFreePropWarnings } from "../internal/overlay/overlay-popup.js";
import { usePopoverPopup } from "../internal/overlay/use-popover-popup.js";
import { useAnchoredPlacement } from "../internal/overlay/use-resolved-placement.js";
import { useTransitionBoundary } from "../internal/transition-boundary.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useElementCheck } from "../internal/use-element-check.js";
import { useMergedRefs } from "../internal/use-merged-refs.js";
import { resolveStateValue, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import {
  NavigationMenuPopupContext,
  useNavigationMenuItemContext,
} from "./navigation-menu-context.js";

const isDev = process.env.NODE_ENV !== "production";

/** `inline-start` / `inline-end` follow the panel's `direction` (conventions 13.1). */
export type NavigationMenuSide = AnchorSide;
/**
 * Alignment of the panel along its side: inline-relative on a top / bottom side, the top /
 * bottom edges on the others.
 */
export type NavigationMenuAlign = AnchorAlign;

/**
 * State of `NavigationMenu.Popup`, passed to the function forms of `className`, `style`,
 * `children` and `render`.
 */
export interface NavigationMenuPopupState {
  /**
   * Committed open state (library mode); `false` in JS-free mode. Read `:popover-open` for the
   * DOM truth.
   */
  readonly open: boolean;
  /**
   * While shown: the physical side the browser placed the panel on (after any fallback flip;
   * conventions 13.2). Otherwise the `side` prop. `null` with `side={null}`.
   */
  readonly side: NavigationMenuSide | null;
  /** While shown: the resolved alignment; otherwise the `align` prop. */
  readonly align: NavigationMenuAlign;
}

/**
 * Props of `NavigationMenu.Popup`.
 *
 * @see https://ui.funstack.work/components/navigation-menu
 */
export interface NavigationMenuPopupProps extends Omit<
  ComponentPropsWithRef<"div">,
  "id" | "popover" | "onToggle" | "onBeforeToggle" | "className" | "style" | "children"
> {
  /**
   * Placement relative to the Trigger through inline `position-area`, with
   * `position-try-fallbacks` flipping it when it does not fit. `null` emits no inline positioning
   * (and no `data-side` / `data-align`), so a stylesheet owns placement (a full-width panel).
   *
   * @defaultValue `"bottom"`
   */
  side?: NavigationMenuSide | null;
  /**
   * Alignment along the side. On a top / bottom side `start` / `end` are inline-relative
   * (mirrored under `direction: rtl`). Ignored when `side` is `null`.
   *
   * @defaultValue `"start"`
   */
  align?: NavigationMenuAlign;
  /**
   * Library mode: what happens to the children while the panel is closed.
   * - `false` (default): not rendered. Mounting them is part of the opening transition, so
   *   content that suspends holds the open (the Trigger is `data-pending`) until it is ready.
   * - `true`: rendered inside `<Activity mode="hidden">`: DOM and state preserved, effects
   *   stopped. Not in the server HTML.
   *
   * Ignored in JS-free mode (always mounted, in the server HTML).
   *
   * @defaultValue `false`
   */
  keepMounted?: boolean;
  /**
   * Library mode only. Forwarded to the `<ViewTransition default>` around the popover element.
   * Animates library-driven opens and closes (the Trigger, a followed Link, controlled changes);
   * dismissals animate with CSS only. Ignored (dev warning) in JS-free mode.
   *
   * Static: setting or unsetting it remounts the element.
   */
  transition?: ViewTransitionClass;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, NavigationMenuPopupState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, NavigationMenuPopupState>;
  /** The panel's links, or a function of the part's state. Library mode: may suspend. */
  children?: StateValue<ReactNode, NavigationMenuPopupState>;
  /** Replace the default `<div>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"div">, NavigationMenuPopupState>;
}

/** The panel is a `<div>` (design 1). */
const POPUP_ELEMENTS: readonly string[] = ["DIV"];

/**
 * The panel: a `<div popover="auto">` with no role (the disclosure pattern), placed against the
 * Trigger with CSS Anchor Positioning. Render it **immediately after** the Trigger in the same
 * Item: every engine then puts the panel's links right after the Trigger in the Tab order
 * (development warning otherwise). Sibling `auto` popovers close each other, so one panel is
 * open at a time.
 *
 * JS-free mode: the children are always mounted (in the server HTML). Library mode: they render
 * from committed state, so content that suspends holds the open with `data-pending` on the
 * Trigger; `showPopover({ source: trigger })` runs in the commit that mounted them. Style it with
 * `:popover-open`; it emits `data-side` / `data-align` but no `data-open`.
 *
 * Owned keys (conventions 1.2): `id`, `popover`, and `data-side` / `data-align` unless `side` is
 * `null`.
 *
 * @see https://ui.funstack.work/components/navigation-menu
 */
export function NavigationMenuPopup({
  side: sideProp = "bottom",
  align: alignProp = "start",
  keepMounted,
  transition,
  className,
  style,
  children,
  render,
  ...rest
}: NavigationMenuPopupProps) {
  const ctx = useNavigationMenuItemContext("NavigationMenu.Popup");
  const isLibrary = ctx.mode === "library";
  const { ids, popupRef, triggerRef } = ctx;

  useJsFreePropWarnings("NavigationMenu.Popup", "panel", isLibrary, transition, keepMounted);

  const { setElement, renderContent } = usePopoverPopup(ctx, {
    part: "NavigationMenu.Popup",
    keepMounted,
    transition: isLibrary ? transition : undefined,
    elements: POPUP_ELEMENTS,
    // While shown, a primary press on any `popovertarget` / `commandfor` invoker of the panel
    // moves no focus: a foreign one outside the Item (the focus-leave close would otherwise hide
    // the panel before the invoker's own toggle), and the panel's own Trigger as well. The latter
    // is harmless and intended: focus is already inside the Item, and the hide returns it.
    whileShown: listenInvokerPresses,
  });

  // Development checks (design 7): one Popup per Item, directly after its Trigger. Runs before
  // `setElement`, which registers this element.
  const checkSecond = useElementCheck(
    isDev &&
      ((element) =>
        popupRef.current !== null && popupRef.current !== element
          ? "NavigationMenu.Popup: a second NavigationMenu.Popup mounted in the same Item. An " +
            "Item has one Trigger and one Popup; give each panel its own NavigationMenu.Item."
          : null),
  );
  const self = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!isDev) return;
    const element = self.current;
    const trigger = triggerRef.current;
    if (element === null || trigger === null || element.previousElementSibling === trigger) return;
    console.error(
      "NavigationMenu.Popup: the Popup does not directly follow its NavigationMenu.Trigger. " +
        "Render the Popup immediately after the Trigger: Safari puts a popover's content after " +
        "its invoker in the Tab order only when the two are adjacent.",
    );
  }, [triggerRef]);

  const placement = useAnchoredPlacement({ side: sideProp, align: alignProp });
  const { side, align } = placement;
  const ref = useMergedRefs<HTMLElement>(checkSecond, setElement, placement.ref, self);

  const state: NavigationMenuPopupState = { open: ctx.committed, side, align };

  const content = (s: NavigationMenuPopupState): ReactNode => (
    <NavigationMenuPopupContext value={ctx}>
      {renderContent(() => resolveStateValue(children, s))}
    </NavigationMenuPopupContext>
  );

  const libraryProps: ComponentPropsWithRef<"div"> & DataAttributes = {
    id: ids.popup,
    popover: "auto",
    // Not owned with `side={null}`: the stylesheet (or a render element) may set them.
    ...placement.dataAttributes,
  };

  const element = useRender<ComponentPropsWithRef<"div">, NavigationMenuPopupState>({
    defaultElement: "div",
    render,
    state,
    className,
    // The consumer's style wins over the inline placement.
    style: placement.style(style),
    children: content,
    props: rest,
    libraryProps,
    ref,
  });

  return useTransitionBoundary("NavigationMenu.Popup", isLibrary ? transition : undefined, element);
}

NavigationMenuPopup.displayName = "NavigationMenuPopup";

"use client";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  ReactNode,
  RefObject,
  ViewTransitionClass,
} from "react";
import type { AnchorAlign, AnchorSide } from "../internal/anchor-position.js";
import { useTransitionBoundary } from "../internal/transition-boundary.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useJsFreePropWarnings } from "../internal/overlay-popup.js";
import { useMergedRefs } from "../internal/use-merged-refs.js";
import { usePopoverPopup } from "../internal/use-popover-popup.js";
import { useAnchoredPlacement } from "../internal/use-resolved-placement.js";
import { resolveStateValue, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { PopoverPopupContext, usePopoverContext } from "./popover-context.js";

/** `inline-start` / `inline-end` follow the popup's `direction` (conventions 13.1). */
export type PopoverSide = AnchorSide;
export type PopoverAlign = AnchorAlign;

export interface PopoverPopupState {
  /**
   * Committed open state (library mode); `false` in JS-free mode. Read `:popover-open` for the
   * DOM truth.
   */
  readonly open: boolean;
  /**
   * While shown: the physical side the browser placed the popup on (after any fallback flip;
   * conventions 13.2). Otherwise the `side` prop. `null` with `side={null}`.
   */
  readonly side: PopoverSide | null;
  /** While shown: the resolved alignment; otherwise the `align` prop. */
  readonly align: PopoverAlign;
}

export interface PopoverPopupProps extends Omit<
  ComponentPropsWithRef<"dialog">,
  | "id"
  | "popover"
  | "open"
  | "aria-modal"
  | "onToggle"
  | "onBeforeToggle"
  | "className"
  | "style"
  | "children"
> {
  /**
   * Placement relative to the Trigger through inline `position-area`, with
   * `position-try-fallbacks` flipping it when it does not fit. Default `"bottom"`.
   * `"inline-start"` / `"inline-end"` follow the popup's direction. `null` emits no inline
   * positioning (and no `data-side` / `data-align`), so a stylesheet owns placement.
   */
  side?: PopoverSide | null;
  /**
   * Alignment along the side. Default `"center"`. On a top / bottom side `start` / `end` are
   * inline-relative (mirrored under `direction: rtl`); on the other sides the top / bottom
   * edges. Ignored when `side` is `null`.
   */
  align?: PopoverAlign;
  /**
   * Library mode: what happens to the children while the popover is closed.
   * - `false` (default): not rendered. Mounting them is part of the opening transition, so
   *   content that suspends holds the open until it is ready. Unmount waits for the popover's
   *   exit animation (CSS), or happens in the close commit when `transition` is set.
   * - `true`: rendered inside `<Activity mode="hidden">`: DOM and state preserved, effects
   *   stopped, pre-rendered at low priority. Not in the server HTML.
   *
   * Ignored in JS-free mode (always mounted).
   */
  keepMounted?: boolean;
  /**
   * Element to focus when the popover opens: a ref, or a selector resolved inside the popup.
   * The library writes `autofocus` on it right before `showPopover()` and the platform focuses
   * it. Default: the platform's choice for a `<dialog>` (first focusable descendant; the popup
   * itself if none); for `render={<div />}` focus stays on the Trigger.
   *
   * In JS-free mode the browser opens the popover itself, so the attribute is written after
   * hydration and kept while mounted; before hydration only `autoFocus` in the markup works.
   */
  initialFocus?: RefObject<HTMLElement | null> | string;
  /**
   * Library mode only. Forwarded to the `<ViewTransition default>` around the popover element
   * itself. Animates the opening commit, content changes while open, and every library-driven
   * close (Trigger, Close, controlled `open={false}`), in all engines; dismissals (Escape,
   * click outside) are the browser's and animate with CSS only. Ignored (dev warning) in JS-free
   * mode.
   *
   * Static: setting or unsetting it remounts the element. Any value, `"none"` included, makes a
   * mount or `<Activity>` reveal inside a transition start a document view transition (a ~250 ms
   * page cross-fade that the next transition waits for).
   * A plain open starts none: the children mount under the already-mounted popover element.
   */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, PopoverPopupState>;
  style?: StateValue<CSSProperties | undefined, PopoverPopupState>;
  children?: StateValue<ReactNode, PopoverPopupState>;
  /** A `<dialog>` (default) or a `<div>` (focus stays on the Trigger). */
  render?: RenderProp<ComponentPropsWithRef<"dialog">, PopoverPopupState>;
}

/**
 * The popover itself: a `<dialog popover="auto" aria-modal="false" role="dialog">` with the id
 * the Trigger's `popovertarget` names, placed against the Trigger with CSS Anchor Positioning and
 * wired to Title and Description through `aria-labelledby` / `aria-describedby`. Style it with
 * `:popover-open`; it emits `data-side` / `data-align` but no `data-open`. While shown, those are
 * where the browser placed it (the applied `position-try-fallbacks` option; conventions 13.2),
 * in both modes; otherwise the requested values.
 *
 * In library mode the children render from committed state, so content that suspends keeps the
 * popover closed (and the Trigger pending) until it is ready; `showPopover({ source: trigger })`
 * runs in the layout effect of the commit that mounted them, and a library-driven close runs
 * `hidePopover()` in the commit that ends it. Dismissals are the browser's: the native `toggle`
 * event becomes `openChangeAction(false, { reason: "dismiss" })`.
 *
 * Owned keys (conventions 1.2): `id`, `popover`, `open`, `aria-modal`, `aria-labelledby` and
 * `aria-describedby` (token-merged), and `data-side` / `data-align` unless `side` is `null`.
 * `role` is a default (`"dialog"`) the consumer may override.
 */
export function PopoverPopup({
  side: sideProp = "bottom",
  align: alignProp = "center",
  keepMounted,
  initialFocus,
  transition,
  className,
  style,
  children,
  render,
  ...rest
}: PopoverPopupProps) {
  const ctx = usePopoverContext("Popover.Popup");
  const isLibrary = ctx.mode === "library";
  const { ids } = ctx;

  useJsFreePropWarnings("Popover.Popup", "popover", isLibrary, transition, keepMounted);

  const { setElement, renderContent } = usePopoverPopup(ctx, {
    part: "Popover.Popup",
    initialFocus,
    keepMounted,
    transition: isLibrary ? transition : undefined,
  });

  // Resolved while shown, in library and JS-free mode alike (it hangs off the element's ref and
  // the platform's `toggle`, not off library state).
  const placement = useAnchoredPlacement({ side: sideProp, align: alignProp });
  const { side, align } = placement;
  const ref = useMergedRefs(setElement, placement.ref);

  const state: PopoverPopupState = { open: ctx.committed, side, align };

  const content = (s: PopoverPopupState): ReactNode => (
    <PopoverPopupContext value={s}>
      {renderContent(() => resolveStateValue(children, s))}
    </PopoverPopupContext>
  );

  const libraryProps: ComponentPropsWithRef<"dialog"> & DataAttributes = {
    id: ids.popup,
    popover: "auto",
    // Never rendered: `showPopover()` does not set it, and an `open` attribute would show the
    // <dialog> outside the top layer. Owned so a `render` element cannot add it.
    open: undefined,
    // Chromium exposes a <dialog popover> as modal without it (design, Decisions 4).
    "aria-modal": "false",
    "aria-labelledby": ids.title,
    "aria-describedby": ids.description,
    // Not owned with `side={null}`: the stylesheet (or a render element) may set them.
    ...placement.dataAttributes,
  };

  const element = useRender<ComponentPropsWithRef<"dialog">, PopoverPopupState>({
    defaultElement: "dialog",
    render,
    state,
    className,
    // The consumer's style wins over the inline placement (design 8).
    style: placement.style(style),
    children: content,
    // `role` is a default the consumer's `rest` overrides (design 3.3): WebKit implements no
    // minimum role for `[popover]`, and a `<div>` popup needs it.
    props: { role: "dialog", ...rest },
    libraryProps,
    ref,
  });

  return useTransitionBoundary("Popover.Popup", isLibrary ? transition : undefined, element);
}

PopoverPopup.displayName = "PopoverPopup";

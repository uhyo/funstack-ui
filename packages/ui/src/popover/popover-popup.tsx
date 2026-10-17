"use client";
import { Activity } from "react";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  ReactNode,
  RefObject,
  ViewTransitionClass,
} from "react";
import { POSITION_TRY_FALLBACKS, positionArea } from "../internal/anchor-position.js";
import { useTransitionBoundary } from "../internal/transition-boundary.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { usePopoverPopup } from "../internal/use-popover-popup.js";
import { resolveStateValue, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { PopoverPopupContext, usePopoverContext } from "./popover-context.js";

export type PopoverSide = "top" | "bottom" | "left" | "right";
export type PopoverAlign = "start" | "center" | "end";

export interface PopoverPopupState {
  /** Committed open state (library mode); `false` in JS-free mode. Read `:popover-open` for the DOM truth. */
  readonly open: boolean;
  readonly side: PopoverSide | null;
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
   * `position-try-fallbacks` flipping it when it does not fit. Default `"bottom"`. `null` emits
   * no inline positioning (and no `data-side` / `data-align`), so a stylesheet owns placement.
   */
  side?: PopoverSide | null;
  /** Alignment along the side. Default `"center"`. Ignored when `side` is `null`. */
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
   * Static: without `transition` the part renders no `<ViewTransition>`; changing it between
   * `undefined` and a value remounts the element. A Root inserted by a transition with
   * `transition` set on its Popup pays the page cross-fade (issue #35); a plain open does not,
   * because the children mount under the already-mounted popover element.
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
 * the Trigger's `commandfor` names, placed against the Trigger with CSS Anchor Positioning and
 * wired to Title and Description through `aria-labelledby` / `aria-describedby`. Style it with
 * `:popover-open`; it emits `data-side` / `data-align` but no `data-open`.
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
  side = "bottom",
  align = "center",
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

  useDevWarning(
    !isLibrary && transition !== undefined,
    "Popover.Popup: `transition` has no effect in JS-free mode; the browser opens and closes the " +
      "popover outside any React transition. Animate it with CSS (`@starting-style`).",
  );
  useDevWarning(
    !isLibrary && keepMounted === false,
    "Popover.Popup: `keepMounted={false}` cannot be honoured in JS-free mode; the content is " +
      "always mounted so that the server HTML is complete.",
  );

  const { setElement, visible, wrapContent } = usePopoverPopup(ctx, {
    part: "Popover.Popup",
    initialFocus,
    keepMounted,
    transition: isLibrary ? transition : undefined,
  });

  const state: PopoverPopupState = { open: ctx.committed, side, align };

  const content = (s: PopoverPopupState): ReactNode => {
    let node: ReactNode;
    if (!isLibrary) {
      node = resolveStateValue(children, s);
    } else if (keepMounted === true) {
      // The mode changes with committed state, inside the Root's transition (conventions 5.5);
      // it stays visible while an exit animation runs.
      node = (
        <Activity mode={visible ? "visible" : "hidden"}>
          {wrapContent(resolveStateValue(children, s))}
        </Activity>
      );
    } else {
      node = visible ? wrapContent(resolveStateValue(children, s)) : null;
    }
    return <PopoverPopupContext value={s}>{node}</PopoverPopupContext>;
  };

  const libraryProps: ComponentPropsWithRef<"dialog"> & DataAttributes = {
    id: ids.popup,
    popover: "auto",
    // Never rendered: `showPopover()` does not set it, and an `open` attribute would show the
    // <dialog> outside the top layer. Owned so a `render` element cannot add it.
    open: undefined,
    // Chromium exposes a <dialog popover> as modal without it (research; issue #44).
    "aria-modal": "false",
    "aria-labelledby": ids.title,
    "aria-describedby": ids.description,
    // Not owned with `side={null}`: the stylesheet (or a render element) may set them.
    ...(side !== null && { "data-side": side, "data-align": align }),
  };

  const element = useRender<ComponentPropsWithRef<"dialog">, PopoverPopupState>({
    defaultElement: "dialog",
    render,
    state,
    className,
    // The inline placement sits under the consumer's style: the consumer wins (design 8).
    style:
      side === null
        ? style
        : (s) => ({
            positionArea: positionArea(side, align),
            positionTryFallbacks: POSITION_TRY_FALLBACKS,
            ...resolveStateValue(style, s),
          }),
    children: content,
    // `role` is a default the consumer's `rest` overrides (design 3.3): WebKit implements no
    // minimum role for `[popover]`, and a `<div>` popup needs it.
    props: { role: "dialog", ...rest },
    libraryProps,
    ref: setElement,
  });

  return useTransitionBoundary("Popover.Popup", isLibrary ? transition : undefined, element);
}

PopoverPopup.displayName = "PopoverPopup";

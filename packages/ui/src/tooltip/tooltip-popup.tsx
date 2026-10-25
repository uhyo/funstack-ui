"use client";
import { useMemo } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useMergedRefs } from "../internal/use-merged-refs.js";
import { useAnchoredPlacement } from "../internal/use-resolved-placement.js";
import { useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { TooltipPopupContext, useTooltipContext } from "./tooltip-context.js";
import type { TooltipAlign, TooltipPopupContextValue, TooltipSide } from "./tooltip-context.js";

export type { TooltipAlign, TooltipSide } from "./tooltip-context.js";

/**
 * State of `Tooltip.Popup`, passed to the function forms of `className`, `style`, `children` and
 * `render`.
 */
export interface TooltipPopupState {
  /** The Root's `disabled`. */
  readonly disabled: boolean;
  /**
   * While shown: the physical side the browser placed the popup on (`"top"` / `"bottom"` /
   * `"left"` / `"right"`, after any fallback flip). Otherwise the `side` prop. `null` with
   * `side={null}`.
   */
  readonly side: TooltipSide | null;
  /** While shown: the resolved alignment; otherwise the `align` prop. */
  readonly align: TooltipAlign;
}

/**
 * Props of `Tooltip.Popup`.
 *
 * @see https://ui.funstack.work/components/tooltip
 */
export interface TooltipPopupProps extends Omit<
  ComponentPropsWithRef<"div">,
  "id" | "popover" | "role" | "className" | "style" | "children"
> {
  /**
   * Placement relative to the trigger through inline `position-area`, with
   * `position-try-fallbacks` flipping it when it does not fit. `"inline-start"` /
   * `"inline-end"` follow the popup's direction. `null` emits no inline positioning (and no
   * `data-side` / `data-align`), so a stylesheet owns placement.
   *
   * @defaultValue `"top"`
   */
  side?: TooltipSide | null;
  /**
   * Alignment along the side. On a top / bottom side `start` / `end` are
   * inline-relative (mirrored under `direction: rtl`); on the other sides they are the top /
   * bottom edges. Ignored when `side` is `null`.
   *
   * @defaultValue `"center"`
   */
  align?: TooltipAlign;
  /**
   * Experimental (Chrome 151+, Firefox 153+; Safari 27.0 treats it as `"manual"`). Renders
   * `popover="hint"` instead of `popover="manual"`: native light dismiss, and the tooltip can
   * open over an `auto` popover (a menu) without closing it. The JS Escape / pointerdown handling
   * stays in place for engines that do not know `hint`.
   *
   * @defaultValue `false`
   */
  experimental_hint?: boolean;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, TooltipPopupState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, TooltipPopupState>;
  /**
   * Rendered at mount (hidden by the popover's `display: none`), not at open time. Tooltip
   * content should be static; if it must suspend, put the `<Suspense>` boundary inside the Popup.
   */
  children?: StateValue<ReactNode, TooltipPopupState>;
  /** Replace the default `<div>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"div">, TooltipPopupState>;
}

/**
 * The tooltip content: a `div` with `popover` and `role="tooltip"`, shown in the top layer and
 * anchored to the trigger implicitly (`interestfor` or `showPopover({ source })`). Open state is
 * browser-owned: style it with `:popover-open` and animate it with `@starting-style` in CSS.
 *
 * `data-side` / `data-align` are where the browser placed the popup while it is shown (the
 * `position-try-fallbacks` option it applied, read from the computed `position-area`;
 * conventions 13.2) and the requested values otherwise; `Tooltip.Arrow` echoes them.
 *
 * `data-instant` is present while the tooltip is shown by an open that began while another
 * `[role="tooltip"]:popover-open` existed (a warm open, skip-delay), so
 * `[data-instant] { transition: none }` skips its entry animation. Not rendered by this part: the
 * Root's effect writes it on the element from the popup's `beforetoggle` (on both paths), before
 * the open's first style recalc, and removes it at the close's. No `state` counterpart.
 *
 * Owned keys (conventions 1.2): `id`, `popover`, `role`, `data-disabled`, and `data-side` /
 * `data-align` unless `side` is `null`.
 *
 * @see https://ui.funstack.work/components/tooltip
 */
export function TooltipPopup({
  side: sideProp = "top",
  align: alignProp = "center",
  experimental_hint = false,
  className,
  style,
  children,
  render,
  ...rest
}: TooltipPopupProps) {
  const ctx = useTooltipContext("Tooltip.Popup");
  const placement = useAnchoredPlacement({ side: sideProp, align: alignProp });
  const { side, align } = placement;
  const state: TooltipPopupState = { disabled: ctx.disabled, side, align };
  const arrow = useMemo<TooltipPopupContextValue>(() => ({ side, align }), [side, align]);
  const ref = useMergedRefs(ctx.setPopupElement, placement.ref);

  const libraryProps: ComponentPropsWithRef<"div"> & DataAttributes = {
    id: ctx.popupId,
    popover: experimental_hint ? "hint" : "manual",
    role: "tooltip",
    "data-disabled": dataAttr(ctx.disabled),
    // Not owned with `side={null}`: the stylesheet (or a render element) may set them.
    ...placement.dataAttributes,
  };

  const element = useRender<ComponentPropsWithRef<"div">, TooltipPopupState>({
    defaultElement: "div",
    render,
    state,
    className,
    // The consumer's style wins over the inline placement (design 3).
    style: placement.style(style),
    children,
    props: rest,
    libraryProps,
    ref,
  });

  return <TooltipPopupContext value={arrow}>{element}</TooltipPopupContext>;
}

TooltipPopup.displayName = "TooltipPopup";

"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { resolveStateValue, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { useTooltipContext } from "./tooltip-context.js";

export type TooltipSide = "top" | "bottom" | "left" | "right";
export type TooltipAlign = "start" | "center" | "end";

export interface TooltipPopupState {
  readonly disabled: boolean;
  readonly side: TooltipSide | null;
  readonly align: TooltipAlign;
}

export interface TooltipPopupProps extends Omit<
  ComponentPropsWithRef<"div">,
  "id" | "popover" | "role" | "className" | "style" | "children"
> {
  /**
   * Placement relative to the trigger through inline `position-area`, with
   * `position-try-fallbacks` flipping it when it does not fit. Default `"top"`. `null` emits no
   * inline positioning (and no `data-side` / `data-align`), so a stylesheet owns placement.
   */
  side?: TooltipSide | null;
  /** Alignment along the side. Default `"center"`. Ignored when `side` is `null`. */
  align?: TooltipAlign;
  /**
   * Experimental (Chrome 151+, Firefox 153+; Safari 27.0 treats it as `"manual"`). Renders
   * `popover="hint"` instead of `popover="manual"`: native light dismiss, and the tooltip can
   * open over an `auto` popover (a menu) without closing it. The JS Escape / pointerdown handling
   * stays in place for engines that do not know `hint`. Default `false`.
   */
  experimental_hint?: boolean;
  className?: StateValue<string | undefined, TooltipPopupState>;
  style?: StateValue<CSSProperties | undefined, TooltipPopupState>;
  /**
   * Rendered at mount (hidden by the popover's `display: none`), not at open time. Tooltip
   * content should be static; if it must suspend, put the `<Suspense>` boundary inside the Popup.
   */
  children?: StateValue<ReactNode, TooltipPopupState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, TooltipPopupState>;
}

const FALLBACKS = "flip-block, flip-inline, flip-block flip-inline";

/** Design section 7.1: the `position-area` for each side and alignment. */
function positionArea(side: TooltipSide, align: TooltipAlign): string {
  if (align === "center") return side;
  const vertical = side === "top" || side === "bottom";
  const span = vertical
    ? align === "start"
      ? "span-right"
      : "span-left"
    : align === "start"
      ? "span-bottom"
      : "span-top";
  return `${side} ${span}`;
}

/**
 * The tooltip content: a `div` with `popover` and `role="tooltip"`, shown in the top layer and
 * anchored to the trigger implicitly (`interestfor` or `showPopover({ source })`). Open state is
 * browser-owned: style it with `:popover-open` and animate it with `@starting-style` in CSS.
 *
 * Owned keys (conventions 1.2): `id`, `popover`, `role`, `data-disabled`, and `data-side` /
 * `data-align` unless `side` is `null`.
 */
export function TooltipPopup({
  side = "top",
  align = "center",
  experimental_hint = false,
  className,
  style,
  children,
  render,
  ...rest
}: TooltipPopupProps) {
  const ctx = useTooltipContext("Tooltip.Popup");
  const state: TooltipPopupState = { disabled: ctx.disabled, side, align };

  const libraryProps: ComponentPropsWithRef<"div"> & DataAttributes = {
    id: ctx.popupId,
    popover: experimental_hint ? "hint" : "manual",
    role: "tooltip",
    "data-disabled": dataAttr(ctx.disabled),
    // Not owned with `side={null}`: the stylesheet (or a render element) may set them.
    ...(side !== null && { "data-side": side, "data-align": align }),
  };

  return useRender<ComponentPropsWithRef<"div">, TooltipPopupState>({
    defaultElement: "div",
    render,
    state,
    className,
    // The inline placement sits under the consumer's style: the consumer wins (design 3).
    style:
      side === null
        ? style
        : (s) => ({
            positionArea: positionArea(side, align),
            positionTryFallbacks: FALLBACKS,
            ...resolveStateValue(style, s),
          }),
    children,
    props: rest,
    libraryProps,
    ref: ctx.setPopupElement,
  });
}

TooltipPopup.displayName = "TooltipPopup";

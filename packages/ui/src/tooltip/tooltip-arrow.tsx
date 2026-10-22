"use client";
import { use } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { TooltipPopupContext } from "./tooltip-context.js";
import type { TooltipAlign, TooltipSide } from "./tooltip-context.js";

export interface TooltipArrowState {
  /** The Popup's side: resolved while shown (after any flip), requested otherwise. */
  readonly side: TooltipSide | null;
  readonly align: TooltipAlign;
}

export interface TooltipArrowProps extends Omit<
  ComponentPropsWithRef<"span">,
  "aria-hidden" | "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, TooltipArrowState>;
  style?: StateValue<CSSProperties | undefined, TooltipArrowState>;
  children?: StateValue<ReactNode, TooltipArrowState>;
  render?: RenderProp<ComponentPropsWithRef<"span">, TooltipArrowState>;
}

/**
 * A decorative `<span aria-hidden="true">` inside `Tooltip.Popup` that draws nothing itself: it
 * echoes the Popup's `data-side` / `data-align`, which are the **resolved** placement while the
 * tooltip is shown (design 7.4), so CSS keyed on `[data-side]` puts it on the edge that faces the
 * trigger, after a `position-try-fallbacks` flip as well.
 *
 * Owned keys (conventions 1.2): `aria-hidden`, and `data-side` / `data-align` unless the Popup's
 * `side` is `null`.
 */
export function TooltipArrow({ className, style, children, render, ...rest }: TooltipArrowProps) {
  const placement = use(TooltipPopupContext);
  if (placement === null) {
    throw new Error("Tooltip.Arrow must be rendered inside a Tooltip.Popup.");
  }
  const { side, align } = placement;
  const state: TooltipArrowState = { side, align };

  const libraryProps: ComponentPropsWithRef<"span"> & DataAttributes = {
    "aria-hidden": true,
    ...(side !== null && { "data-side": side, "data-align": align }),
  };

  return useRender<ComponentPropsWithRef<"span">, TooltipArrowState>({
    defaultElement: "span",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps,
  });
}

TooltipArrow.displayName = "TooltipArrow";

"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { usePopoverContext, usePopoverPopupState } from "./popover-context.js";
import type { PopoverPopupState } from "./popover-popup.js";

export type PopoverTitleState = PopoverPopupState;

export interface PopoverTitleProps extends Omit<
  ComponentPropsWithRef<"h2">,
  "id" | "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, PopoverTitleState>;
  style?: StateValue<CSSProperties | undefined, PopoverTitleState>;
  children?: StateValue<ReactNode, PopoverTitleState>;
  /** `render={<h3 />}` changes the heading level. */
  render?: RenderProp<ComponentPropsWithRef<"h2">, PopoverTitleState>;
}

/**
 * The popover's name: an `<h2>` whose id the Popup references with `aria-labelledby`.
 *
 * Owned key (conventions 1.2): `id`.
 */
export function PopoverTitle({ className, style, children, render, ...rest }: PopoverTitleProps) {
  const ctx = usePopoverContext("Popover.Title");
  const state = usePopoverPopupState(ctx);
  return useRender<ComponentPropsWithRef<"h2">, PopoverTitleState>({
    defaultElement: "h2",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: { id: ctx.ids.title },
  });
}

PopoverTitle.displayName = "PopoverTitle";

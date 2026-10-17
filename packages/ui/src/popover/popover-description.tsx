"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { usePopoverContext, usePopoverPopupState } from "./popover-context.js";
import type { PopoverPopupState } from "./popover-popup.js";

export type PopoverDescriptionState = PopoverPopupState;

export interface PopoverDescriptionProps extends Omit<
  ComponentPropsWithRef<"p">,
  "id" | "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, PopoverDescriptionState>;
  style?: StateValue<CSSProperties | undefined, PopoverDescriptionState>;
  children?: StateValue<ReactNode, PopoverDescriptionState>;
  render?: RenderProp<ComponentPropsWithRef<"p">, PopoverDescriptionState>;
}

/**
 * The popover's description: a `<p>` whose id the Popup references with `aria-describedby`.
 *
 * Owned key (conventions 1.2): `id`.
 */
export function PopoverDescription({
  className,
  style,
  children,
  render,
  ...rest
}: PopoverDescriptionProps) {
  const ctx = usePopoverContext("Popover.Description");
  const state = usePopoverPopupState(ctx);
  return useRender<ComponentPropsWithRef<"p">, PopoverDescriptionState>({
    defaultElement: "p",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: { id: ctx.ids.description },
  });
}

PopoverDescription.displayName = "PopoverDescription";

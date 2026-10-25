"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { usePopoverContext, usePopoverPopupState } from "./popover-context.js";
import type { PopoverPopupState } from "./popover-popup.js";

/** State of `Popover.Description`: the Popup's state. */
export type PopoverDescriptionState = PopoverPopupState;

/**
 * Props of `Popover.Description`.
 *
 * @see https://ui.funstack.work/components/popover
 */
export interface PopoverDescriptionProps extends Omit<
  ComponentPropsWithRef<"p">,
  "id" | "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, PopoverDescriptionState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, PopoverDescriptionState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, PopoverDescriptionState>;
  /** Replace the default `<p>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"p">, PopoverDescriptionState>;
}

/**
 * The popover's description: a `<p>` whose id the Popup references with `aria-describedby`.
 *
 * Owned key (conventions 1.2): `id`.
 *
 * @see https://ui.funstack.work/components/popover
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

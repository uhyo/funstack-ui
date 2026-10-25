"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useMeterContext } from "./meter-context.js";
import type { MeterState } from "./meter-root.js";

/**
 * Props of `Meter.Label`.
 *
 * @see https://ui.funstack.work/components/meter
 */
export interface MeterLabelProps extends Omit<
  ComponentPropsWithRef<"span">,
  "id" | "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, MeterState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, MeterState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, MeterState>;
  /** Replace the default `<span>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"span">, MeterState>;
}

/**
 * `Meter.Label`: a `span` whose id the Root always references through `aria-labelledby` (the Root is not a labelable element, so a `<label for>` would associate nothing). Owned keys: `id`, `data-region`.
 *
 * @see https://ui.funstack.work/components/meter
 */
export function MeterLabel({ className, style, children, render, ...rest }: MeterLabelProps) {
  const { id, state } = useMeterContext("Meter.Label");
  return useRender<ComponentPropsWithRef<"span">, MeterState>({
    defaultElement: "span",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: {
      id: `${id}-label`,
      "data-region": state.region,
    },
  });
}

MeterLabel.displayName = "MeterLabel";

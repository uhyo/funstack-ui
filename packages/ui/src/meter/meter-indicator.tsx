"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useMeterContext } from "./meter-context.js";
import type { MeterState } from "./meter-root.js";

/**
 * Props of `Meter.Indicator`.
 *
 * @see https://ui.funstack.work/components/meter
 */
export interface MeterIndicatorProps extends Omit<
  ComponentPropsWithRef<"span">,
  "className" | "style" | "children"
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
 * `Meter.Indicator`: the fill. It renders no inline size: the consumer's CSS sizes it from the Root's inherited custom property. Owned keys: `data-region`.
 *
 * @see https://ui.funstack.work/components/meter
 */
export function MeterIndicator({
  className,
  style,
  children,
  render,
  ...rest
}: MeterIndicatorProps) {
  const { state } = useMeterContext("Meter.Indicator");
  return useRender<ComponentPropsWithRef<"span">, MeterState>({
    defaultElement: "span",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: {
      "data-region": state.region,
    },
  });
}

MeterIndicator.displayName = "MeterIndicator";

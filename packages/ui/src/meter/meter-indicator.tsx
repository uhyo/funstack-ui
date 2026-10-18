"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useMeterContext } from "./meter-context.js";
import type { MeterState } from "./meter-root.js";

export interface MeterIndicatorProps extends Omit<
  ComponentPropsWithRef<"span">,
  "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, MeterState>;
  style?: StateValue<CSSProperties | undefined, MeterState>;
  children?: StateValue<ReactNode, MeterState>;
  render?: RenderProp<ComponentPropsWithRef<"span">, MeterState>;
}

/**
 * `Meter.Indicator`: the fill. It renders no inline size: the consumer's CSS sizes it from the Root's inherited custom property. Owned keys: `data-region`.
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

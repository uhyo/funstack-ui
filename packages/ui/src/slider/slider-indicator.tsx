"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useSliderContext } from "./slider-context.js";
import type { SliderTrackState } from "./slider-track.js";

export type SliderIndicatorState = SliderTrackState;

export interface SliderIndicatorProps extends Omit<
  ComponentPropsWithRef<"span">,
  "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, SliderIndicatorState>;
  style?: StateValue<CSSProperties | undefined, SliderIndicatorState>;
  children?: StateValue<ReactNode, SliderIndicatorState>;
  render?: RenderProp<ComponentPropsWithRef<"span">, SliderIndicatorState>;
}

/**
 * The fill between the first and last thumb (from `min` to the value for one thumb). Renders no
 * inline position: the consumer's CSS places it from the Root's inherited `--slider-start` /
 * `--slider-end`. Owned keys: `data-orientation`, `data-disabled`.
 */
export function SliderIndicator({
  className,
  style,
  children,
  render,
  ...rest
}: SliderIndicatorProps) {
  const ctx = useSliderContext("Slider.Indicator");
  const state: SliderIndicatorState = {
    orientation: ctx.orientation,
    dragging: ctx.draggingThumb !== null,
    disabled: ctx.disabled,
  };
  return useRender<ComponentPropsWithRef<"span">, SliderIndicatorState>({
    defaultElement: "span",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: {
      "data-orientation": ctx.orientation,
      "data-disabled": dataAttr(ctx.disabled),
    },
  });
}

SliderIndicator.displayName = "SliderIndicator";

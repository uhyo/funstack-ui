"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useRender } from "../internal/use-render.js";
import { useSliderContext } from "./slider-context.js";
import type { SliderRootState, SliderValue } from "./slider-root.js";

const isDev = process.env.NODE_ENV !== "production";

/**
 * `T` defaults to `SliderValue` (a number or an array): a part is not connected to its Root's
 * value type. Pass it to narrow, `<Slider.Value<number>>`, or read `values`.
 */
export interface SliderValueState<T extends SliderValue = SliderValue> extends SliderRootState<T> {
  /** The `index` prop, or `null`. */
  readonly index: number | null;
}

/**
 * Props of `Slider.Value`.
 *
 * @see https://ui.funstack.work/components/slider
 */
export interface SliderValueProps<T extends SliderValue = SliderValue> extends Omit<
  ComponentPropsWithRef<"span">,
  "className" | "style" | "children"
> {
  /**
   * Show one thumb's value. Without it a single-thumb slider shows its value; a multi-thumb
   * slider needs `children` (dev warning otherwise, renders nothing).
   */
  index?: number;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, SliderValueState<T>>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, SliderValueState<T>>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, SliderValueState<T>>;
  /** Replace the default `<span>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"span">, SliderValueState<T>>;
}

/**
 * Displays the shown value: `children(state)`, or the thumb at `index`, or the single value as
 * text. A plain `span`, not `<output>`: a `status` live region updating on every step would
 * chatter (the slider itself exposes its value). No owned keys.
 *
 * @see https://ui.funstack.work/components/slider
 */
export function SliderValuePart<T extends SliderValue = SliderValue>({
  index,
  className,
  style,
  children,
  render,
  ...rest
}: SliderValueProps<T>) {
  const ctx = useSliderContext("Slider.Value");
  const state: SliderValueState<T> = {
    ...(ctx.state as SliderRootState<T>),
    index: index ?? null,
  };

  const missing = children === undefined && index === undefined && ctx.shown.length > 1;
  useDevWarning(
    missing,
    isDev &&
      "Slider.Value: a multi-thumb slider has no single value to show. Pass `index` to show one " +
        "thumb's value, or `children` (a function of the state) to format them all.",
  );

  let fallback: ReactNode = null;
  if (index !== undefined) {
    const value = ctx.shown[index];
    fallback = value === undefined ? null : String(value);
  } else if (ctx.shown.length === 1) {
    fallback = String(ctx.shown[0]);
  }

  return useRender<ComponentPropsWithRef<"span">, SliderValueState<T>>({
    defaultElement: "span",
    render,
    state,
    className,
    style,
    children: children ?? fallback,
    props: rest,
  });
}

SliderValuePart.displayName = "SliderValue";

"use client";
import { useLayoutEffect } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useElementCheck } from "../internal/use-element-check.js";
import { useRender } from "../internal/use-render.js";
import { useSliderContext } from "./slider-context.js";
import type { SliderRootState, SliderValue } from "./slider-root.js";

/** `T` defaults to `SliderValue`; pass it to narrow the state (`<Slider.Label<number>>`). */
export interface SliderLabelProps<T extends SliderValue = SliderValue> extends Omit<
  ComponentPropsWithRef<"label">,
  "htmlFor" | "id" | "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, SliderRootState<T>>;
  style?: StateValue<CSSProperties | undefined, SliderRootState<T>>;
  children?: StateValue<ReactNode, SliderRootState<T>>;
  /** Must stay a `<label>` when the slider has one thumb (the `for` association). */
  render?: RenderProp<ComponentPropsWithRef<"label">, SliderRootState<T>>;
}

/**
 * The visible name of the slider: `<label for>` naming the only thumb's input, or, with several
 * thumbs, the element whose `id` the Root's `aria-labelledby` (`role="group"`) points at, emitted
 * only while a Label is mounted. Owned keys: `id`, `htmlFor`.
 */
export function SliderLabel<T extends SliderValue = SliderValue>({
  className,
  style,
  children,
  render,
  ...rest
}: SliderLabelProps<T>) {
  const ctx = useSliderContext("Slider.Label");
  const { registerLabel } = ctx;
  useLayoutEffect(registerLabel, [registerLabel]);

  const single = ctx.shown.length === 1;
  const libraryRef = useElementCheck(
    (element) =>
      single && element.tagName !== "LABEL"
        ? `Slider.Label: expected a <label> element but got <${element.tagName.toLowerCase()}>. ` +
          `With one thumb the Label names the input through \`for\`, which only a <label> has.`
        : null,
    [single],
  );

  return useRender<ComponentPropsWithRef<"label">, SliderRootState<T>>({
    defaultElement: "label",
    render,
    state: ctx.state as SliderRootState<T>,
    className,
    style,
    children,
    props: rest,
    ref: libraryRef,
    libraryProps: {
      id: ctx.labelId,
      htmlFor: single ? ctx.thumbId(0) : undefined,
    },
  });
}

SliderLabel.displayName = "SliderLabel";

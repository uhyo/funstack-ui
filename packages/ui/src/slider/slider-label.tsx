"use client";
import { useLayoutEffect } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useElementCheck } from "../internal/use-element-check.js";
import { useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { useSliderContext } from "./slider-context.js";
import type { SliderRootState, SliderValue } from "./slider-root.js";

const isDev = process.env.NODE_ENV !== "production";

/** State of `Slider.Label`: the Root's (conventions 9.4). */
export type SliderLabelState<T extends SliderValue = SliderValue> = SliderRootState<T>;

/**
 * Props of `Slider.Label`. `T` defaults to `SliderValue`; pass it to narrow the state
 * (`<Slider.Label<number>>`).
 *
 * @see https://ui.funstack.work/components/slider
 */
export interface SliderLabelProps<T extends SliderValue = SliderValue> extends Omit<
  ComponentPropsWithRef<"label">,
  "htmlFor" | "id" | "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, SliderLabelState<T>>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, SliderLabelState<T>>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, SliderLabelState<T>>;
  /** Must stay a `<label>` when the slider has one thumb (the `for` association). */
  render?: RenderProp<ComponentPropsWithRef<"label">, SliderLabelState<T>>;
}

/**
 * The visible name of the slider: `<label for>` naming the only thumb's input, or, with several
 * thumbs, the element whose `id` the Root's `aria-labelledby` (`role="group"`) points at, emitted
 * only while a Label is mounted. Owned keys: `id`, `htmlFor`, `data-disabled`, `data-pending`
 * (the Root's, conventions 4.1 rule 4), `data-dragging`, `data-orientation`, `data-invalid` (its
 * state is the Root's, rule 2).
 *
 * @see https://ui.funstack.work/components/slider
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
    isDev &&
      ((element) =>
        single && element.tagName !== "LABEL"
          ? `Slider.Label: expected a <label> element but got <${element.tagName.toLowerCase()}>. ` +
            `With one thumb the Label names the input through \`for\`, which only a <label> has.`
          : null),
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
      "data-disabled": dataAttr(ctx.state.disabled),
      "data-pending": dataAttr(ctx.state.pending),
      "data-dragging": dataAttr(ctx.state.dragging),
      "data-orientation": ctx.state.orientation,
      "data-invalid": dataAttr(ctx.state.invalid),
    } as ComponentPropsWithRef<"label"> & DataAttributes,
  });
}

SliderLabel.displayName = "SliderLabel";

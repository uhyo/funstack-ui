"use client";
import { useLayoutEffect } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useElementCheck } from "../internal/use-element-check.js";
import { useRender } from "../internal/use-render.js";
import { useNumberFieldContext } from "./number-field-context.js";
import type { NumberFieldState } from "./number-field-root.js";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Props of `NumberField.Label`.
 *
 * @see https://ui.funstack.work/components/number-field
 */
export interface NumberFieldLabelProps extends Omit<
  ComponentPropsWithRef<"label">,
  "htmlFor" | "id" | "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, NumberFieldState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, NumberFieldState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, NumberFieldState>;
  /** Must render a `<label>`. */
  render?: RenderProp<ComponentPropsWithRef<"label">, NumberFieldState>;
}

/**
 * The visible name of the field: `<label for>` naming the visible input; its id also names the
 * Root group (`aria-labelledby`, emitted only while a Label is mounted).
 *
 * Owned keys: `id`, `htmlFor`, `data-pending`, `data-disabled`.
 *
 * @see https://ui.funstack.work/components/number-field
 */
export function NumberFieldLabel({
  className,
  style,
  children,
  render,
  ...rest
}: NumberFieldLabelProps) {
  const ctx = useNumberFieldContext("NumberField.Label");
  const { registerLabel } = ctx;
  useLayoutEffect(registerLabel, [registerLabel]);

  const libraryRef = useElementCheck(
    isDev &&
      ((element) =>
        element.tagName !== "LABEL"
          ? `NumberField.Label: expected a <label> element but got <${element.tagName.toLowerCase()}>. ` +
            "The Label names the input through `for`, which only a <label> has."
          : null),
  );

  return useRender<ComponentPropsWithRef<"label">, NumberFieldState>({
    defaultElement: "label",
    render,
    state: ctx.state,
    className,
    style,
    children,
    props: rest,
    ref: libraryRef,
    libraryProps: {
      id: ctx.labelId,
      htmlFor: ctx.inputId,
      "data-pending": dataAttr(ctx.state.pending),
      "data-disabled": dataAttr(ctx.state.disabled),
    },
  });
}

NumberFieldLabel.displayName = "NumberFieldLabel";

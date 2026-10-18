"use client";
import { useCallback, useLayoutEffect, useRef } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useNumberFieldContext } from "./number-field-context.js";
import type { NumberFieldState } from "./number-field-root.js";

const isDev = process.env.NODE_ENV !== "production";

export interface NumberFieldLabelProps extends Omit<
  ComponentPropsWithRef<"label">,
  "htmlFor" | "id" | "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, NumberFieldState>;
  style?: StateValue<CSSProperties | undefined, NumberFieldState>;
  children?: StateValue<ReactNode, NumberFieldState>;
  /** Must render a `<label>`. */
  render?: RenderProp<ComponentPropsWithRef<"label">, NumberFieldState>;
}

/**
 * The visible name of the field: `<label for>` naming the visible input; its id also names the
 * Root group (`aria-labelledby`, emitted only while a Label is mounted).
 *
 * Owned keys: `id`, `htmlFor`, `data-pending`, `data-disabled`.
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

  const warned = useRef(false);
  const libraryRef = useCallback((element: HTMLElement) => {
    if (isDev && !warned.current && element.tagName !== "LABEL") {
      warned.current = true;
      console.error(
        `NumberField.Label: expected a <label> element but got <${element.tagName.toLowerCase()}>. ` +
          "The Label names the input through `for`, which only a <label> has.",
      );
    }
    return () => {};
  }, []);

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

"use client";
import { useLayoutEffect } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { fieldDataAttributes, useFieldContext } from "../internal/field-context.js";
import type { FieldState } from "../internal/field-context.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";

export interface FieldErrorProps extends Omit<
  ComponentPropsWithRef<"div">,
  "id" | "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, FieldState>;
  style?: StateValue<CSSProperties | undefined, FieldState>;
  /**
   * Rendered only while `state.invalid`. Default: `state.messages` joined by a space. A function
   * gets the state: `({ validity, messages }) => validity.valueMissing ? "Enter your email" : messages.join(" ")`.
   * Must not suspend (urgent render, design 2.4).
   */
  children?: StateValue<ReactNode, FieldState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, FieldState>;
}

function defaultChildren(state: FieldState): ReactNode {
  return state.messages.join(" ");
}

/**
 * The field's error message: a `div` rendered only while an error is shown, whose id the control
 * then lists in `aria-describedby`. No role and no live region: the library focuses the first
 * invalid control after a submission attempt, and focus reads the description (design 4.2).
 * Its presence lets the Field cancel the platform's validation bubble.
 *
 * Owned keys (conventions 1.2): `id`, `data-invalid`, `data-disabled`, `data-required`,
 * `data-pending`.
 */
export function FieldError({
  className,
  style,
  children = defaultChildren,
  render,
  ...rest
}: FieldErrorProps) {
  const ctx = useFieldContext("Field.Error");
  const { registerError } = ctx;
  useLayoutEffect(registerError, [registerError]);
  const element = useRender<ComponentPropsWithRef<"div">, FieldState>({
    defaultElement: "div",
    render,
    state: ctx.state,
    className,
    style,
    children,
    props: rest,
    libraryProps: { id: ctx.ids.error, ...fieldDataAttributes(ctx.state) },
  });
  return ctx.state.invalid ? element : null;
}

FieldError.displayName = "FieldError";

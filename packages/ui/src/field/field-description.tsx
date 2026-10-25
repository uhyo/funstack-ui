"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { fieldDataAttributes, useFieldContext } from "../internal/field-context.js";
import type { FieldState } from "../internal/field-context.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";

/**
 * Props of `Field.Description`.
 *
 * @see https://ui.funstack.work/components/field
 */
export interface FieldDescriptionProps extends Omit<
  ComponentPropsWithRef<"p">,
  "id" | "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, FieldState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, FieldState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, FieldState>;
  /** Replace the default `<p>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"p">, FieldState>;
}

/**
 * Help text for the field: a `<p>` whose id the control always lists in `aria-describedby`
 * (a dangling reference when no Description is rendered is skipped by assistive technology, so
 * nothing registers and the server HTML is exact).
 *
 * Owned keys (conventions 1.2): `id`, `data-invalid`, `data-disabled`, `data-required`,
 * `data-pending`.
 *
 * @see https://ui.funstack.work/components/field
 */
export function FieldDescription({
  className,
  style,
  children,
  render,
  ...rest
}: FieldDescriptionProps) {
  const ctx = useFieldContext("Field.Description");
  return useRender<ComponentPropsWithRef<"p">, FieldState>({
    defaultElement: "p",
    render,
    state: ctx.state,
    className,
    style,
    children,
    props: rest,
    libraryProps: { id: ctx.ids.description, ...fieldDataAttributes(ctx.state) },
  });
}

FieldDescription.displayName = "FieldDescription";

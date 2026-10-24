"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { useFieldContext } from "../internal/field-context.js";
import type { FieldState } from "../internal/field-context.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useElementCheck } from "../internal/use-element-check.js";
import { useRender } from "../internal/use-render.js";
import { fieldDataAttributes } from "./field-root.js";

export interface FieldLabelProps extends Omit<
  ComponentPropsWithRef<"label">,
  "htmlFor" | "id" | "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, FieldState>;
  style?: StateValue<CSSProperties | undefined, FieldState>;
  children?: StateValue<ReactNode, FieldState>;
  /** Must render a `<label>`. */
  render?: RenderProp<ComponentPropsWithRef<"label">, FieldState>;
}

/**
 * The field's visible name: `<label for>` pointing at the control. For a group control (a
 * RadioGroup or CheckboxGroup `<fieldset>`) it renders no `for` once the group registered, and
 * the group names itself with `aria-labelledby` → this id (design 4.2).
 *
 * Owned keys (conventions 1.2): `id`, `htmlFor`, `data-invalid`, `data-disabled`,
 * `data-required`, `data-pending`.
 */
export function FieldLabel({ className, style, children, render, ...rest }: FieldLabelProps) {
  const ctx = useFieldContext("Field.Label");
  const ref = useElementCheck((el) =>
    el.tagName !== "LABEL"
      ? `Field.Label: expected to render a <label> element but got <${el.tagName.toLowerCase()}>. ` +
        "Label activation and the control's accessible name need a real <label>."
      : null,
  );
  return useRender<ComponentPropsWithRef<"label">, FieldState>({
    defaultElement: "label",
    render,
    state: ctx.state,
    className,
    style,
    children,
    props: rest,
    libraryProps: {
      id: ctx.ids.label,
      htmlFor: ctx.labelable ? ctx.ids.control : undefined,
      ...fieldDataAttributes(ctx.state),
    },
    ref,
  });
}

FieldLabel.displayName = "FieldLabel";

"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { rootStateAttributes, useSelectContext } from "./select-context.js";
import { useSelectPartRef } from "./select-dom.js";
import type { SelectRootState } from "./select-root.js";

/**
 * Props of `Select.GroupLabel`.
 *
 * @see https://ui.funstack.work/components/select
 */
export interface SelectGroupLabelProps extends Omit<
  ComponentPropsWithRef<"legend">,
  "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, SelectRootState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, SelectRootState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, SelectRootState>;
  /** Replace the rendered element. Must keep a `<legend>`. */
  render?: RenderProp<ComponentPropsWithRef<"legend">, SelectRootState>;
}

const isDev = process.env.NODE_ENV !== "production";

/** Development only: passed behind `isDev`, so the text folds away in production (#161). */
function firstChildOfGroup(el: HTMLLegendElement): string | null {
  const parent = el.parentElement;
  if (parent?.tagName === "OPTGROUP" && parent.firstElementChild === el) return null;
  return "must be the first child of a Select.Group's <optgroup> (HTML content model).";
}

/**
 * The rich label of a `Select.Group`: a `<legend>`, rendered by engines with customizable select.
 * Optional; must be the **first child** of its Group. Keep its text equal to the Group's `label`,
 * which native pickers and assistive technology use. Owned keys: `data-pending`,
 * `data-disabled`, `data-invalid` (the Root's).
 *
 * @see https://ui.funstack.work/components/select
 */
export function SelectGroupLabel({
  className,
  style,
  children,
  render,
  ...rest
}: SelectGroupLabelProps) {
  const ctx = useSelectContext("Select.GroupLabel");
  const state: SelectRootState = {
    value: ctx.optimistic,
    pending: ctx.pending,
    disabled: ctx.disabled,
    readOnly: ctx.readOnly,
    invalid: ctx.invalid,
  };
  const { ref } = useSelectPartRef<HTMLLegendElement>(
    "Select.GroupLabel",
    "legend",
    isDev ? firstChildOfGroup : undefined,
  );
  return useRender<ComponentPropsWithRef<"legend">, SelectRootState>({
    defaultElement: "legend",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: rootStateAttributes(ctx),
    ref,
  });
}

SelectGroupLabel.displayName = "SelectGroupLabel";

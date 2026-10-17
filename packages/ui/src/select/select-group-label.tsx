"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useSelectContext } from "./select-context.js";
import { useSelectPartRef } from "./select-dom.js";
import type { SelectRootState } from "./select-root.js";

export interface SelectGroupLabelProps extends Omit<
  ComponentPropsWithRef<"legend">,
  "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, SelectRootState>;
  style?: StateValue<CSSProperties | undefined, SelectRootState>;
  children?: StateValue<ReactNode, SelectRootState>;
  /** Replace the rendered element. Must keep a `<legend>`. */
  render?: RenderProp<ComponentPropsWithRef<"legend">, SelectRootState>;
}

function firstChildOfGroup(el: HTMLLegendElement): string | null {
  const parent = el.parentElement;
  if (parent?.tagName === "OPTGROUP" && parent.firstElementChild === el) return null;
  return "must be the first child of a Select.Group's <optgroup> (HTML content model).";
}

/**
 * The rich label of a `Select.Group`: a `<legend>`, rendered by engines with customizable select.
 * Optional; must be the **first child** of its Group. Keep its text equal to the Group's `label`,
 * which native pickers and assistive technology use. Owns no keys.
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
  };
  const { ref } = useSelectPartRef<HTMLLegendElement>(
    "Select.GroupLabel",
    "legend",
    firstChildOfGroup,
  );
  return useRender<ComponentPropsWithRef<"legend">, SelectRootState>({
    defaultElement: "legend",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    ref,
  });
}

SelectGroupLabel.displayName = "SelectGroupLabel";

"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useCheckboxGroupContext } from "./checkbox-group-context.js";
import type { CheckboxGroupRootState } from "./checkbox-group-root.js";

/**
 * Props of `CheckboxGroup.Label`.
 *
 * @see https://ui.funstack.work/components/checkbox-group
 */
export interface CheckboxGroupLabelProps extends Omit<
  ComponentPropsWithRef<"legend">,
  "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, CheckboxGroupRootState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, CheckboxGroupRootState>;
  /** Receives the Root's state: a group-level pending indicator goes here. */
  children?: StateValue<ReactNode, CheckboxGroupRootState>;
  /** Replace the default `<legend>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"legend">, CheckboxGroupRootState>;
}

/**
 * The group's `<legend>`, which names the fieldset natively. Optional; must be the **first child**
 * of `CheckboxGroup.Root` (HTML content model). Its state is the Root's state. Owns no keys.
 *
 * @see https://ui.funstack.work/components/checkbox-group
 */
export function CheckboxGroupLabel({
  className,
  style,
  children,
  render,
  ...rest
}: CheckboxGroupLabelProps) {
  const { state } = useCheckboxGroupContext("CheckboxGroup.Label");
  return useRender<ComponentPropsWithRef<"legend">, CheckboxGroupRootState>({
    defaultElement: "legend",
    render,
    state,
    className,
    style,
    children,
    props: rest,
  });
}

CheckboxGroupLabel.displayName = "CheckboxGroupLabel";

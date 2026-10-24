"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useCheckboxGroupContext } from "./checkbox-group-context.js";
import type { CheckboxGroupRootState } from "./checkbox-group-root.js";

export interface CheckboxGroupLabelProps extends Omit<
  ComponentPropsWithRef<"legend">,
  "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, CheckboxGroupRootState>;
  style?: StateValue<CSSProperties | undefined, CheckboxGroupRootState>;
  /** Receives the Root's state: a group-level pending indicator goes here. */
  children?: StateValue<ReactNode, CheckboxGroupRootState>;
  render?: RenderProp<ComponentPropsWithRef<"legend">, CheckboxGroupRootState>;
}

/**
 * The group's `<legend>`, which names the fieldset natively. Optional; must be the **first child**
 * of `CheckboxGroup.Root` (HTML content model). Its state is the Root's state. Owns no keys.
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

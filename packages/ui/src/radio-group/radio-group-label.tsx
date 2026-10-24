"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useRadioGroupContext } from "./radio-group-context.js";
import type { RadioGroupRootState } from "./radio-group-root.js";

export interface RadioGroupLabelProps extends Omit<
  ComponentPropsWithRef<"legend">,
  "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, RadioGroupRootState>;
  style?: StateValue<CSSProperties | undefined, RadioGroupRootState>;
  /** Receives the Root's state: a group-level pending indicator goes here. */
  children?: StateValue<ReactNode, RadioGroupRootState>;
  render?: RenderProp<ComponentPropsWithRef<"legend">, RadioGroupRootState>;
}

/**
 * The group's `<legend>`, which names the fieldset natively. Optional; must be the **first child**
 * of `RadioGroup.Root` (HTML content model). Its state is the Root's state. Owns no keys.
 */
export function RadioGroupLabel({
  className,
  style,
  children,
  render,
  ...rest
}: RadioGroupLabelProps) {
  const { state } = useRadioGroupContext("RadioGroup.Label");
  return useRender<ComponentPropsWithRef<"legend">, RadioGroupRootState>({
    defaultElement: "legend",
    render,
    state,
    className,
    style,
    children,
    props: rest,
  });
}

RadioGroupLabel.displayName = "RadioGroupLabel";

"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useRadioGroupContext } from "./radio-group-context.js";
import type { RadioGroupRootState } from "./radio-group-root.js";

/**
 * Props of `RadioGroup.Label`.
 *
 * @see https://ui.funstack.work/components/radio-group
 */
export interface RadioGroupLabelProps extends Omit<
  ComponentPropsWithRef<"legend">,
  "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, RadioGroupRootState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, RadioGroupRootState>;
  /** Receives the Root's state: a group-level pending indicator goes here. */
  children?: StateValue<ReactNode, RadioGroupRootState>;
  /** Replace the default `<legend>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"legend">, RadioGroupRootState>;
}

/**
 * The group's `<legend>`, which names the fieldset natively. Optional; must be the **first child**
 * of `RadioGroup.Root` (HTML content model). Its state is the Root's state. Owns no keys.
 *
 * @see https://ui.funstack.work/components/radio-group
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

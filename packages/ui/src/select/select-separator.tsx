"use client";
import type { ComponentPropsWithRef, CSSProperties } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useSelectContext } from "./select-context.js";
import type { SelectRootState } from "./select-root.js";

export interface SelectSeparatorProps extends Omit<
  ComponentPropsWithRef<"hr">,
  "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, SelectRootState>;
  style?: StateValue<CSSProperties | undefined, SelectRootState>;
  /** Replace the rendered element. */
  render?: RenderProp<ComponentPropsWithRef<"hr">, SelectRootState>;
}

/**
 * A decorative `<hr>` between options or groups (exposed as `separator` by Chromium's
 * customizable select; a line in native pickers). Owns no keys.
 */
export function SelectSeparator({ className, style, render, ...rest }: SelectSeparatorProps) {
  const ctx = useSelectContext("Select.Separator");
  const state: SelectRootState = {
    value: ctx.optimistic,
    pending: ctx.pending,
    disabled: ctx.disabled,
  };
  return useRender<ComponentPropsWithRef<"hr">, SelectRootState>({
    defaultElement: "hr",
    render,
    state,
    className,
    style,
    children: undefined,
    props: rest,
  });
}

SelectSeparator.displayName = "SelectSeparator";

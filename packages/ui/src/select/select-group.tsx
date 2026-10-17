"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useSelectContext } from "./select-context.js";
import { useSelectPartRef } from "./select-dom.js";
import type { SelectRootState } from "./select-root.js";

export interface SelectGroupProps extends Omit<
  ComponentPropsWithRef<"optgroup">,
  "label" | "className" | "style" | "children"
> {
  /**
   * The `<optgroup label>`: shown by native pickers (Firefox today) and read by assistive
   * technology. Required. Keep it equal to the text of a `Select.GroupLabel`, if any.
   */
  label: string;
  /** Native `disabled`: every option in the group is disabled. */
  disabled?: boolean;
  className?: StateValue<string | undefined, SelectRootState>;
  style?: StateValue<CSSProperties | undefined, SelectRootState>;
  children?: StateValue<ReactNode, SelectRootState>;
  /** Replace the rendered element. Must keep an `<optgroup>`. */
  render?: RenderProp<ComponentPropsWithRef<"optgroup">, SelectRootState>;
}

/** An `<optgroup>` of options. Its state is the Root's state. Owned key: `label`. */
export function SelectGroup({
  label,
  className,
  style,
  children,
  render,
  ...rest
}: SelectGroupProps) {
  const ctx = useSelectContext("Select.Group");
  const state: SelectRootState = {
    value: ctx.optimistic,
    pending: ctx.pending,
    disabled: ctx.disabled,
  };
  const { ref } = useSelectPartRef<HTMLOptGroupElement>("Select.Group", "optgroup");
  return useRender<ComponentPropsWithRef<"optgroup">, SelectRootState>({
    defaultElement: "optgroup",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: { label },
    ref,
  });
}

SelectGroup.displayName = "SelectGroup";

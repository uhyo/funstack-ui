"use client";
import { useMemo } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { SelectContext, useSelectContext } from "./select-context.js";
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

/**
 * An `<optgroup>` of options. Its state is the Root's state. Owned key: `label`. Its `disabled`
 * reaches the Options' `state.disabled` / `data-disabled` through context, as `:disabled` does.
 */
export function SelectGroup({
  label,
  disabled = false,
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
  const element = useRender<ComponentPropsWithRef<"optgroup">, SelectRootState>({
    defaultElement: "optgroup",
    render,
    state,
    className,
    style,
    children,
    props: { ...rest, disabled },
    libraryProps: { label },
    ref,
  });
  // Nested groups are not valid HTML, so this only ever turns `false` into the group's value.
  const context = useMemo(() => ({ ...ctx, groupDisabled: disabled }), [ctx, disabled]);
  return <SelectContext value={context}>{element}</SelectContext>;
}

SelectGroup.displayName = "SelectGroup";

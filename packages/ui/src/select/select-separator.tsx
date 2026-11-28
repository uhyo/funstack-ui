"use client";
import type { ComponentPropsWithRef, CSSProperties } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { rootStateAttributes, useSelectContext } from "./select-context.js";
import type { SelectRootState } from "./select-root.js";

/**
 * Props of `Select.Separator`.
 *
 * @see https://ui.funstack.work/components/select
 */
export interface SelectSeparatorProps extends Omit<
  ComponentPropsWithRef<"hr">,
  "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, SelectRootState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, SelectRootState>;
  /** Replace the rendered element. */
  render?: RenderProp<ComponentPropsWithRef<"hr">, SelectRootState>;
}

/**
 * A decorative `<hr>` between options or groups (exposed as `separator` by Chromium's
 * customizable select; a line in native pickers). Writes no `role`: inside a `<select>` the
 * parser keeps only an `<hr>`, so the implicit role cannot be lost
 * (design/components/separator.md 5). Owned keys: `data-pending`, `data-disabled`,
 * `data-invalid` (the Root's).
 *
 * @see https://ui.funstack.work/components/select
 */
export function SelectSeparator({ className, style, render, ...rest }: SelectSeparatorProps) {
  const ctx = useSelectContext("Select.Separator");
  const state: SelectRootState = {
    value: ctx.optimistic,
    pending: ctx.pending,
    disabled: ctx.disabled,
    readOnly: ctx.readOnly,
    invalid: ctx.invalid,
  };
  return useRender<ComponentPropsWithRef<"hr">, SelectRootState>({
    defaultElement: "hr",
    render,
    state,
    className,
    style,
    children: undefined,
    props: rest,
    libraryProps: rootStateAttributes(ctx),
  });
}

SelectSeparator.displayName = "SelectSeparator";

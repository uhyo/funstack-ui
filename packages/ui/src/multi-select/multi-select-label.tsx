"use client";
import { useLayoutEffect } from "react";
import type { ComponentPropsWithRef, CSSProperties, MouseEvent, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { useMultiSelectContext } from "./multi-select-context.js";

/**
 * State of `MultiSelect.Label`, passed to the function forms of `className`, `style`, `children`
 * and `render`.
 */
export interface MultiSelectLabelState {
  /** The Root's `disabled` (or the Field's). */
  readonly disabled: boolean;
  /** The Root's `readOnly` (or the Field's). */
  readonly readOnly: boolean;
  /** The Root's `pending`: a value or open transition is in flight. */
  readonly pending: boolean;
}

/**
 * Props of `MultiSelect.Label`.
 *
 * @see https://ui.funstack.work/components/multi-select
 */
export interface MultiSelectLabelProps extends Omit<
  ComponentPropsWithRef<"label">,
  "id" | "htmlFor" | "onClick" | "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, MultiSelectLabelState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, MultiSelectLabelState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, MultiSelectLabelState>;
  /** Replace the default `<label>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"label">, MultiSelectLabelState>;
}

/**
 * The visible name of the MultiSelect: `<label for={trigger}>`, whose id also names the listbox
 * (`aria-labelledby` on `MultiSelect.List`, emitted only while a Label is mounted). Its click
 * focuses the Trigger and does **not** open the listbox, as a label on a native `<select>`
 * (design/components/multi-select.md B.8): a `<label for>` on a button would forward the click.
 *
 * Owned keys (conventions 1.2): `id`, `htmlFor`, `onClick`, `data-disabled`, `data-pending` (the
 * Root's, conventions 4.1 rule 4).
 *
 * @see https://ui.funstack.work/components/multi-select
 */
export function MultiSelectLabel({
  className,
  style,
  children,
  render,
  ...rest
}: MultiSelectLabelProps) {
  const ctx = useMultiSelectContext("MultiSelect.Label");
  const { registerLabel } = ctx;
  useLayoutEffect(registerLabel, [registerLabel]);
  const libraryProps: ComponentPropsWithRef<"label"> & DataAttributes = {
    id: ctx.ids.label,
    htmlFor: ctx.ids.trigger,
    onClick: (event: MouseEvent<HTMLLabelElement>) => {
      ctx.labelClick(event.nativeEvent);
    },
    "data-disabled": dataAttr(ctx.disabled),
    "data-readonly": dataAttr(ctx.readOnly),
    "data-pending": dataAttr(ctx.pending),
  };
  return useRender<ComponentPropsWithRef<"label">, MultiSelectLabelState>({
    defaultElement: "label",
    render,
    state: { disabled: ctx.disabled, readOnly: ctx.readOnly, pending: ctx.pending },
    className,
    style,
    children,
    props: rest,
    libraryProps,
  });
}

MultiSelectLabel.displayName = "MultiSelectLabel";

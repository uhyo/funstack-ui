"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { useMultiSelectContext } from "./multi-select-context.js";

/**
 * State of `MultiSelect.Value`, passed to the function forms of `className`, `style`, `children`
 * and `render`.
 */
export interface MultiSelectValueState {
  /** Optimistic selection, in pick order. */
  readonly value: readonly string[];
  /**
   * For each value, the text of its option as the library last saw it; `undefined` if it never
   * saw one (a default value before the listbox first opened, and always in the server HTML).
   */
  readonly labels: readonly (string | undefined)[];
  /** Nothing is selected: `value.length === 0` (`data-empty`). */
  readonly empty: boolean;
  /** The Root's `disabled` (or the Field's). */
  readonly disabled: boolean;
}

/**
 * Props of `MultiSelect.Value`.
 *
 * @see https://ui.funstack.work/components/multi-select
 */
export interface MultiSelectValueProps extends Omit<
  ComponentPropsWithRef<"span">,
  "className" | "style" | "children"
> {
  /** Rendered by the default content while the selection is empty (`data-empty`). */
  placeholder?: ReactNode;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, MultiSelectValueState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, MultiSelectValueState>;
  /**
   * The summary, usually a function of `{ value }` with your own names (the labels are unknown
   * until an option was seen). Rendered from optimistic state; must not suspend.
   *
   * @defaultValue `placeholder` while empty, else each `labels[i] ?? value[i]` joined with `", "`
   */
  children?: StateValue<ReactNode, MultiSelectValueState>;
  /** Replace the default `<span>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"span">, MultiSelectValueState>;
}

/**
 * What the Trigger shows (design/components/multi-select.md B.7): a `<span>` inside
 * `MultiSelect.Trigger`, with `data-empty` while the selection is empty. Without
 * `children` it renders `placeholder` while the selection is empty, else the labels of the label
 * cache joined with `", "`, the raw value for a value whose option was never mounted. The Trigger's text content is the combobox's value
 * for assistive technology.
 *
 * Owned keys (conventions 1.2): `data-empty`, `data-disabled`.
 *
 * @see https://ui.funstack.work/components/multi-select
 */
export function MultiSelectValue({
  placeholder,
  className,
  style,
  children,
  render,
  ...rest
}: MultiSelectValueProps) {
  const ctx = useMultiSelectContext("MultiSelect.Value");
  const empty = ctx.values.length === 0;
  const state: MultiSelectValueState = {
    value: ctx.values,
    labels: ctx.labels,
    empty,
    disabled: ctx.disabled,
  };
  const libraryProps: ComponentPropsWithRef<"span"> & DataAttributes = {
    "data-empty": dataAttr(empty),
    "data-disabled": dataAttr(ctx.disabled),
  };
  return useRender<ComponentPropsWithRef<"span">, MultiSelectValueState>({
    defaultElement: "span",
    render,
    state,
    className,
    style,
    children:
      children ??
      ((s) => (empty ? placeholder : s.value.map((v, i) => s.labels[i] ?? v).join(", "))),
    props: rest,
    libraryProps,
  });
}

MultiSelectValue.displayName = "MultiSelectValue";

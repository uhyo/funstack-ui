"use client";
import { use, useCallback } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useNameWarning } from "../internal/use-name-warning.js";
import { resolveStateValue, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import {
  MultiSelectListContext,
  MultiSelectPopupContext,
  useMultiSelectContext,
} from "./multi-select-context.js";

const isDev = process.env.NODE_ENV !== "production";

/**
 * State of `MultiSelect.List`, passed to the function forms of `className`, `style`, `children`
 * and `render`.
 */
export interface MultiSelectListState {
  /** No option is mounted and the List is not loading. */
  readonly empty: boolean;
}

/**
 * Props of `MultiSelect.List`.
 *
 * @see https://ui.funstack.work/components/multi-select
 */
export interface MultiSelectListProps extends Omit<
  ComponentPropsWithRef<"div">,
  "id" | "role" | "aria-busy" | "aria-multiselectable" | "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, MultiSelectListState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, MultiSelectListState>;
  /**
   * The Options and Groups, under your own `<Suspense>` (with a `MultiSelect.Status` fallback)
   * for options that load when the listbox opens.
   */
  children?: StateValue<ReactNode, MultiSelectListState>;
  /** Replace the default `<div>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"div">, MultiSelectListState>;
}

/**
 * The listbox: `<div role="listbox" aria-multiselectable="true" aria-labelledby={label}>` (the
 * label only while a `MultiSelect.Label` is mounted, else the enclosing `Field.Label`), the
 * element the Trigger's `aria-controls` names (design/components/multi-select.md B.9). Contains
 * only Options and Groups; a `Status` rendered as a Suspense fallback inside it marks the List as
 * loading (`aria-busy="true"`).
 *
 * Owned keys (conventions 1.2): `id`, `role`, `aria-multiselectable`, `aria-labelledby`
 * (token-merged), `aria-busy`, `data-empty`.
 *
 * @see https://ui.funstack.work/components/multi-select
 */
export function MultiSelectList({
  className,
  style,
  children,
  render,
  ...rest
}: MultiSelectListProps) {
  const ctx = useMultiSelectContext("MultiSelect.List");
  const inPopup = use(MultiSelectPopupContext);
  useDevWarning(
    !inPopup,
    isDev &&
      "MultiSelect.List: rendered outside a MultiSelect.Popup. The listbox must be inside the " +
        "Popup, which is the element the library shows and hides.",
  );
  const { listRef } = ctx;
  const checkName = useNameWarning(
    isDev &&
      "MultiSelect.List: the listbox has no accessible name. Render a MultiSelect.Label, or give " +
        "the List an `aria-label` / `aria-labelledby`.",
  );

  const ref = useCallback(
    (element: HTMLElement) => {
      listRef.current = element;
      checkName?.(element);
      return () => {
        if (listRef.current === element) listRef.current = null;
      };
    },
    [listRef, checkName],
  );

  const state: MultiSelectListState = { empty: ctx.empty };

  const libraryProps: ComponentPropsWithRef<"div"> & DataAttributes = {
    id: ctx.ids.list,
    role: "listbox",
    "aria-multiselectable": true,
    ...(ctx.hasLabel
      ? { "aria-labelledby": ctx.ids.label }
      : ctx.fieldLabelId !== undefined && { "aria-labelledby": ctx.fieldLabelId }),
    "aria-busy": ctx.loading ? true : undefined,
    "data-empty": dataAttr(ctx.empty),
  };

  return useRender<ComponentPropsWithRef<"div">, MultiSelectListState>({
    defaultElement: "div",
    render,
    state,
    className,
    style,
    children: (s) => (
      <MultiSelectListContext value={true}>{resolveStateValue(children, s)}</MultiSelectListContext>
    ),
    props: rest,
    libraryProps,
    ref,
  });
}

MultiSelectList.displayName = "MultiSelectList";

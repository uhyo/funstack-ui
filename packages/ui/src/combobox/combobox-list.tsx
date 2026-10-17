"use client";
import { use, useCallback } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { resolveStateValue, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import {
  ComboboxListContext,
  ComboboxPopupContext,
  useComboboxContext,
} from "./combobox-context.js";

export interface ComboboxListState {
  /** The deferred text the results are for: render the Options for it. */
  readonly query: string;
  /** The results shown are for an older text (`aria-busy`). */
  readonly stale: boolean;
  /** No option is mounted and the results are settled. */
  readonly empty: boolean;
}

export interface ComboboxListProps extends Omit<
  ComponentPropsWithRef<"div">,
  "id" | "role" | "aria-busy" | "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, ComboboxListState>;
  style?: StateValue<CSSProperties | undefined, ComboboxListState>;
  /**
   * Usually a function of `{ query }` rendering the Options for it, under your own `<Suspense>`
   * for an async search. The previous results stay visible while the next ones load.
   */
  children?: StateValue<ReactNode, ComboboxListState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, ComboboxListState>;
}

/**
 * The listbox: `<div role="listbox" aria-labelledby={label}>`, the element the input's
 * `aria-controls` names. Its children are the results for the deferred `query` (the library
 * filters nothing, design 6.1); while they are for an older text it carries `aria-busy="true"`
 * and `data-stale`. Contains only Options and Groups (a `Status` rendered as a Suspense fallback
 * inside it marks the results as loading).
 *
 * Owned keys (conventions 1.2): `id`, `role`, `aria-labelledby` (token-merged), `aria-busy`,
 * `data-stale`, `data-empty`.
 */
export function ComboboxList({ className, style, children, render, ...rest }: ComboboxListProps) {
  const ctx = useComboboxContext("Combobox.List");
  const inPopup = use(ComboboxPopupContext);
  useDevWarning(
    !inPopup,
    "Combobox.List: rendered outside a Combobox.Popup. The listbox must be inside the Popup, " +
      "which is the element the library shows and hides.",
  );
  const { listRef } = ctx;

  const ref = useCallback(
    (element: HTMLElement) => {
      listRef.current = element;
      return () => {
        if (listRef.current === element) listRef.current = null;
      };
    },
    [listRef],
  );

  const state: ComboboxListState = { query: ctx.query, stale: ctx.stale, empty: ctx.empty };

  const libraryProps: ComponentPropsWithRef<"div"> & DataAttributes = {
    id: ctx.ids.list,
    role: "listbox",
    "aria-labelledby": ctx.ids.label,
    "aria-busy": ctx.stale ? true : undefined,
    "data-stale": dataAttr(ctx.stale),
    "data-empty": dataAttr(ctx.empty),
  };

  return useRender<ComponentPropsWithRef<"div">, ComboboxListState>({
    defaultElement: "div",
    render,
    state,
    className,
    style,
    children: (s) => (
      <ComboboxListContext value={true}>{resolveStateValue(children, s)}</ComboboxListContext>
    ),
    props: rest,
    libraryProps,
    ref,
  });
}

ComboboxList.displayName = "ComboboxList";

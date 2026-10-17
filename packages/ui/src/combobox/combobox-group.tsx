"use client";
import { use, useId, useLayoutEffect } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useRender } from "../internal/use-render.js";
import {
  ComboboxGroupContext,
  ComboboxListContext,
  useComboboxContext,
} from "./combobox-context.js";
import type { ComboboxListState } from "./combobox-list.js";

/** `Combobox.Group`, `Combobox.GroupLabel` and `Combobox.Status` have no state of their own. */
export type ComboboxGroupState = Record<string, never>;
export type ComboboxGroupLabelState = Record<string, never>;
export type ComboboxStatusState = Record<string, never>;
/** `Combobox.Empty` renders from the List's state. */
export type ComboboxEmptyState = ComboboxListState;

const EMPTY: Record<string, never> = {};

export interface ComboboxGroupProps extends Omit<
  ComponentPropsWithRef<"div">,
  "role" | "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, ComboboxGroupState>;
  style?: StateValue<CSSProperties | undefined, ComboboxGroupState>;
  children?: StateValue<ReactNode, ComboboxGroupState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, ComboboxGroupState>;
}

/**
 * A labelled set of options: `<div role="group" aria-labelledby>` named by the
 * `Combobox.GroupLabel` inside it. Owned keys: `role`, `aria-labelledby` (token-merged).
 */
export function ComboboxGroup({ className, style, children, render, ...rest }: ComboboxGroupProps) {
  useComboboxContext("Combobox.Group");
  const labelId = `${useId()}-label`;
  const element = useRender<ComponentPropsWithRef<"div">, ComboboxGroupState>({
    defaultElement: "div",
    render,
    state: EMPTY,
    className,
    style,
    children,
    props: rest,
    libraryProps: { role: "group", "aria-labelledby": labelId },
  });
  return <ComboboxGroupContext value={labelId}>{element}</ComboboxGroupContext>;
}

ComboboxGroup.displayName = "ComboboxGroup";

export interface ComboboxGroupLabelProps extends Omit<
  ComponentPropsWithRef<"div">,
  "id" | "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, ComboboxGroupLabelState>;
  style?: StateValue<CSSProperties | undefined, ComboboxGroupLabelState>;
  children?: StateValue<ReactNode, ComboboxGroupLabelState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, ComboboxGroupLabelState>;
}

/** The name of the enclosing `Combobox.Group`: a `<div>` with the referenced id. Owned key: `id`. */
export function ComboboxGroupLabel({
  className,
  style,
  children,
  render,
  ...rest
}: ComboboxGroupLabelProps) {
  const labelId = use(ComboboxGroupContext);
  useDevWarning(
    labelId === null,
    "Combobox.GroupLabel: rendered outside a Combobox.Group; it names nothing.",
  );
  return useRender<ComponentPropsWithRef<"div">, ComboboxGroupLabelState>({
    defaultElement: "div",
    render,
    state: EMPTY,
    className,
    style,
    children,
    props: rest,
    libraryProps: labelId === null ? {} : { id: labelId },
  });
}

ComboboxGroupLabel.displayName = "ComboboxGroupLabel";

export interface ComboboxEmptyProps extends Omit<
  ComponentPropsWithRef<"div">,
  "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, ComboboxEmptyState>;
  style?: StateValue<CSSProperties | undefined, ComboboxEmptyState>;
  children?: StateValue<ReactNode, ComboboxEmptyState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, ComboboxEmptyState>;
}

/**
 * "No results": renders a `<div>` with its children only when the List has **no mounted
 * options, the results are not stale and none are loading** (no `Combobox.Status` mounted inside
 * the List, i.e. no Suspense fallback showing); nothing otherwise (design 6.3). Place it in the
 * Popup, outside the List (a listbox holds only options). Owns no keys.
 */
export function ComboboxEmpty({ className, style, children, render, ...rest }: ComboboxEmptyProps) {
  const ctx = useComboboxContext("Combobox.Empty");
  const state: ComboboxEmptyState = { query: ctx.query, stale: ctx.stale, empty: ctx.empty };
  const element = useRender<ComponentPropsWithRef<"div">, ComboboxEmptyState>({
    defaultElement: "div",
    render,
    state,
    className,
    style,
    children,
    props: rest,
  });
  return ctx.empty ? element : null;
}

ComboboxEmpty.displayName = "ComboboxEmpty";

export interface ComboboxStatusProps extends Omit<
  ComponentPropsWithRef<"div">,
  "role" | "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, ComboboxStatusState>;
  style?: StateValue<CSSProperties | undefined, ComboboxStatusState>;
  children?: StateValue<ReactNode, ComboboxStatusState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, ComboboxStatusState>;
}

/**
 * A loading row or a hint: `<div role="status">`. No live-region work of its own (the result
 * count is announced with `ariaNotify`). Rendered **inside the List** (the usual Suspense
 * fallback, `<Suspense fallback={<Combobox.Status>Searching…</Combobox.Status>}>`), it marks
 * the results as loading: `Empty` stays hidden and nothing is announced while it is mounted.
 * Rendered in the Popup outside the List it is a plain hint. Owned key: `role`.
 */
export function ComboboxStatus({
  className,
  style,
  children,
  render,
  ...rest
}: ComboboxStatusProps) {
  const { registerStatus } = useComboboxContext("Combobox.Status");
  const inList = use(ComboboxListContext);
  useLayoutEffect(() => (inList ? registerStatus() : undefined), [inList, registerStatus]);
  return useRender<ComponentPropsWithRef<"div">, ComboboxStatusState>({
    defaultElement: "div",
    render,
    state: EMPTY,
    className,
    style,
    children,
    props: rest,
    libraryProps: { role: "status" },
  });
}

ComboboxStatus.displayName = "ComboboxStatus";

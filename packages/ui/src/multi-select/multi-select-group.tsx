"use client";
import { use, useLayoutEffect } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useGroupLabel, useGroupLabelId } from "../internal/use-group-label.js";
import { useRender } from "../internal/use-render.js";
import {
  MultiSelectGroupContext,
  MultiSelectListContext,
  useMultiSelectContext,
} from "./multi-select-context.js";
import type { MultiSelectListState } from "./multi-select-list.js";

const isDev = process.env.NODE_ENV !== "production";

/** State of `MultiSelect.Group`: empty (the part has no state of its own). */
export type MultiSelectGroupState = Record<string, never>;
/** State of `MultiSelect.GroupLabel`: empty (the part has no state of its own). */
export type MultiSelectGroupLabelState = Record<string, never>;
/** State of `MultiSelect.Status`: empty (the part has no state of its own). */
export type MultiSelectStatusState = Record<string, never>;
/** `MultiSelect.Empty` renders from the List's state. */
export type MultiSelectEmptyState = MultiSelectListState;

const EMPTY: Record<string, never> = {};

/**
 * Props of `MultiSelect.Group`.
 *
 * @see https://ui.funstack.work/components/multi-select
 */
export interface MultiSelectGroupProps extends Omit<
  ComponentPropsWithRef<"div">,
  "role" | "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, MultiSelectGroupState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, MultiSelectGroupState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, MultiSelectGroupState>;
  /** Replace the default `<div>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"div">, MultiSelectGroupState>;
}

/**
 * A labelled set of options: `<div role="group" aria-labelledby>` named by the
 * `MultiSelect.GroupLabel` inside it, while one is mounted (#218). Owned keys: `role`,
 * `aria-labelledby` (token-merged).
 *
 * @see https://ui.funstack.work/components/multi-select
 */
export function MultiSelectGroup({
  className,
  style,
  children,
  render,
  ...rest
}: MultiSelectGroupProps) {
  useMultiSelectContext("MultiSelect.Group");
  const { context, labelledBy } = useGroupLabel();
  const element = useRender<ComponentPropsWithRef<"div">, MultiSelectGroupState>({
    defaultElement: "div",
    render,
    state: EMPTY,
    className,
    style,
    children,
    props: rest,
    libraryProps: { role: "group", ...labelledBy },
  });
  return <MultiSelectGroupContext value={context}>{element}</MultiSelectGroupContext>;
}

MultiSelectGroup.displayName = "MultiSelectGroup";

/**
 * Props of `MultiSelect.GroupLabel`.
 *
 * @see https://ui.funstack.work/components/multi-select
 */
export interface MultiSelectGroupLabelProps extends Omit<
  ComponentPropsWithRef<"div">,
  "id" | "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, MultiSelectGroupLabelState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, MultiSelectGroupLabelState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, MultiSelectGroupLabelState>;
  /** Replace the default `<div>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"div">, MultiSelectGroupLabelState>;
}

/**
 * The name of the enclosing `MultiSelect.Group`: a `<div>` with the referenced id. Owned key:
 * `id`.
 *
 * @see https://ui.funstack.work/components/multi-select
 */
export function MultiSelectGroupLabel({
  className,
  style,
  children,
  render,
  ...rest
}: MultiSelectGroupLabelProps) {
  const labelId = useGroupLabelId(use(MultiSelectGroupContext)) ?? null;
  useDevWarning(
    labelId === null,
    isDev && "MultiSelect.GroupLabel: rendered outside a MultiSelect.Group; it names nothing.",
  );
  return useRender<ComponentPropsWithRef<"div">, MultiSelectGroupLabelState>({
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

MultiSelectGroupLabel.displayName = "MultiSelectGroupLabel";

/**
 * Props of `MultiSelect.Empty`.
 *
 * @see https://ui.funstack.work/components/multi-select
 */
export interface MultiSelectEmptyProps extends Omit<
  ComponentPropsWithRef<"div">,
  "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, MultiSelectEmptyState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, MultiSelectEmptyState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, MultiSelectEmptyState>;
  /** Replace the default `<div>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"div">, MultiSelectEmptyState>;
}

/**
 * "Nothing to choose from": renders a `<div>` with its children only when the List has **no
 * mounted options and none are loading** (no `MultiSelect.Status` mounted inside the List);
 * nothing otherwise (combobox.md 6.3). Place it in the Popup, outside the List (a listbox holds
 * only options). Owns no keys.
 *
 * @see https://ui.funstack.work/components/multi-select
 */
export function MultiSelectEmpty({
  className,
  style,
  children,
  render,
  ...rest
}: MultiSelectEmptyProps) {
  const ctx = useMultiSelectContext("MultiSelect.Empty");
  const state: MultiSelectEmptyState = { empty: ctx.empty };
  const element = useRender<ComponentPropsWithRef<"div">, MultiSelectEmptyState>({
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

MultiSelectEmpty.displayName = "MultiSelectEmpty";

/**
 * Props of `MultiSelect.Status`.
 *
 * @see https://ui.funstack.work/components/multi-select
 */
export interface MultiSelectStatusProps extends Omit<
  ComponentPropsWithRef<"div">,
  "role" | "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, MultiSelectStatusState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, MultiSelectStatusState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, MultiSelectStatusState>;
  /** Replace the default `<div>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"div">, MultiSelectStatusState>;
}

/**
 * A loading row or a hint. Rendered **inside the List** (the usual Suspense fallback,
 * `<Suspense fallback={<MultiSelect.Status>Loading…</MultiSelect.Status>}>`), it marks the
 * List as loading: `<div role="none">` (a listbox owns only options and groups; the List is
 * `aria-busy` instead), `Empty` stays hidden and the initial active option waits until the
 * options are there. Rendered in the Popup outside the List it is a plain hint,
 * `<div role="status">`. Owned key: `role`.
 *
 * @see https://ui.funstack.work/components/multi-select
 */
export function MultiSelectStatus({
  className,
  style,
  children,
  render,
  ...rest
}: MultiSelectStatusProps) {
  const { registerStatus } = useMultiSelectContext("MultiSelect.Status");
  const inList = use(MultiSelectListContext);
  useLayoutEffect(() => (inList ? registerStatus() : undefined), [inList, registerStatus]);
  return useRender<ComponentPropsWithRef<"div">, MultiSelectStatusState>({
    defaultElement: "div",
    render,
    state: EMPTY,
    className,
    style,
    children,
    props: rest,
    libraryProps: { role: inList ? "none" : "status" },
  });
}

MultiSelectStatus.displayName = "MultiSelectStatus";

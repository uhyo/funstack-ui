"use client";
import { use } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useGroupLabel, useGroupLabelId } from "../internal/use-group-label.js";
import { useRender } from "../internal/use-render.js";
import { MenuGroupContext } from "./menu-context.js";

const isDev = process.env.NODE_ENV !== "production";

/** `Menu.Group`, `Menu.GroupLabel` and `Menu.Separator` have no state. */
export type MenuGroupState = Record<string, never>;
/** State of `Menu.GroupLabel`: empty (the part has no state of its own). */
export type MenuGroupLabelState = Record<string, never>;
/** State of `Menu.Separator`: empty (the part has no state of its own). */
export type MenuSeparatorState = Record<string, never>;

const EMPTY: Record<string, never> = {};

/**
 * Props of `Menu.Group`.
 *
 * @see https://ui.funstack.work/components/menu
 */
export interface MenuGroupProps extends Omit<
  ComponentPropsWithRef<"div">,
  "role" | "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, MenuGroupState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, MenuGroupState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, MenuGroupState>;
  /** Replace the default `<div>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"div">, MenuGroupState>;
}

/**
 * A labelled set of items: `<div role="group" aria-labelledby>` named by the `Menu.GroupLabel`
 * inside it, while one is mounted (#218). Owned keys: `role`, `aria-labelledby` (token-merged).
 *
 * @see https://ui.funstack.work/components/menu
 */
export function MenuGroup({ className, style, children, render, ...rest }: MenuGroupProps) {
  const { context, labelledBy } = useGroupLabel();
  const element = useRender<ComponentPropsWithRef<"div">, MenuGroupState>({
    defaultElement: "div",
    render,
    state: EMPTY,
    className,
    style,
    children,
    props: rest,
    libraryProps: { role: "group", ...labelledBy },
  });
  return <MenuGroupContext value={context}>{element}</MenuGroupContext>;
}

MenuGroup.displayName = "MenuGroup";

/**
 * Props of `Menu.GroupLabel`.
 *
 * @see https://ui.funstack.work/components/menu
 */
export interface MenuGroupLabelProps extends Omit<
  ComponentPropsWithRef<"div">,
  "id" | "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, MenuGroupLabelState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, MenuGroupLabelState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, MenuGroupLabelState>;
  /** Replace the default `<div>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"div">, MenuGroupLabelState>;
}

/**
 * The name of the enclosing `Menu.Group` or `Menu.RadioGroup`: a `<div>` with the id the group's
 * `aria-labelledby` references. Owned key: `id`.
 *
 * @see https://ui.funstack.work/components/menu
 */
export function MenuGroupLabel({
  className,
  style,
  children,
  render,
  ...rest
}: MenuGroupLabelProps) {
  const group = use(MenuGroupContext);
  // The group references this id only while a GroupLabel is mounted (#218).
  useGroupLabelId(group);
  useDevWarning(
    group === null,
    isDev && "Menu.GroupLabel: rendered outside a Menu.Group or Menu.RadioGroup; it names nothing.",
  );
  return useRender<ComponentPropsWithRef<"div">, MenuGroupLabelState>({
    defaultElement: "div",
    render,
    state: EMPTY,
    className,
    style,
    children,
    props: rest,
    libraryProps: group === null ? {} : { id: group.labelId },
  });
}

MenuGroupLabel.displayName = "MenuGroupLabel";

/**
 * Props of `Menu.Separator`.
 *
 * @see https://ui.funstack.work/components/menu
 */
export interface MenuSeparatorProps extends Omit<
  ComponentPropsWithRef<"hr">,
  "role" | "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, MenuSeparatorState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, MenuSeparatorState>;
  /**
   * Replace the default `<hr>` (element form) or take over rendering (function form). The part
   * writes the role, so any element is a separator.
   */
  render?: RenderProp<ComponentPropsWithRef<"hr">, MenuSeparatorState>;
}

/**
 * A divider between items: `<hr role="separator">`. The role is rendered, not left to the
 * `<hr>`, so a `render` element of another tag is a separator too
 * (design/components/separator.md 3). Owned keys: `role`.
 *
 * @see https://ui.funstack.work/components/menu
 */
export function MenuSeparator({ className, style, render, ...rest }: MenuSeparatorProps) {
  return useRender<ComponentPropsWithRef<"hr">, MenuSeparatorState>({
    defaultElement: "hr",
    render,
    state: EMPTY,
    className,
    style,
    children: undefined,
    props: rest,
    libraryProps: { role: "separator" },
  });
}

MenuSeparator.displayName = "MenuSeparator";

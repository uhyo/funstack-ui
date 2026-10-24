"use client";
import { use, useId, useMemo } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useRender } from "../internal/use-render.js";
import { MenuGroupContext } from "./menu-context.js";

const isDev = process.env.NODE_ENV !== "production";

/** `Menu.Group`, `Menu.GroupLabel` and `Menu.Separator` have no state. */
export type MenuGroupState = Record<string, never>;
export type MenuGroupLabelState = Record<string, never>;
export type MenuSeparatorState = Record<string, never>;

const EMPTY: Record<string, never> = {};

export interface MenuGroupProps extends Omit<
  ComponentPropsWithRef<"div">,
  "role" | "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, MenuGroupState>;
  style?: StateValue<CSSProperties | undefined, MenuGroupState>;
  children?: StateValue<ReactNode, MenuGroupState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, MenuGroupState>;
}

/**
 * A labelled set of items: `<div role="group" aria-labelledby>` named by the `Menu.GroupLabel`
 * inside it. Owned keys: `role`, `aria-labelledby` (token-merged).
 */
export function MenuGroup({ className, style, children, render, ...rest }: MenuGroupProps) {
  const labelId = `${useId()}-label`;
  const element = useRender<ComponentPropsWithRef<"div">, MenuGroupState>({
    defaultElement: "div",
    render,
    state: EMPTY,
    className,
    style,
    children,
    props: rest,
    libraryProps: { role: "group", "aria-labelledby": labelId },
  });
  const context = useMemo(() => ({ labelId }), [labelId]);
  return <MenuGroupContext value={context}>{element}</MenuGroupContext>;
}

MenuGroup.displayName = "MenuGroup";

export interface MenuGroupLabelProps extends Omit<
  ComponentPropsWithRef<"div">,
  "id" | "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, MenuGroupLabelState>;
  style?: StateValue<CSSProperties | undefined, MenuGroupLabelState>;
  children?: StateValue<ReactNode, MenuGroupLabelState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, MenuGroupLabelState>;
}

/**
 * The name of the enclosing `Menu.Group` or `Menu.RadioGroup`: a `<div>` with the id the group's
 * `aria-labelledby` references. Owned key: `id`.
 */
export function MenuGroupLabel({
  className,
  style,
  children,
  render,
  ...rest
}: MenuGroupLabelProps) {
  const group = use(MenuGroupContext);
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

export interface MenuSeparatorProps extends Omit<
  ComponentPropsWithRef<"hr">,
  "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, MenuSeparatorState>;
  style?: StateValue<CSSProperties | undefined, MenuSeparatorState>;
  /** Another element must carry `role="separator"` itself. */
  render?: RenderProp<ComponentPropsWithRef<"hr">, MenuSeparatorState>;
}

/** A divider between items: `<hr>` (implicit `role="separator"`). Owns no keys. */
export function MenuSeparator({ className, style, render, ...rest }: MenuSeparatorProps) {
  return useRender<ComponentPropsWithRef<"hr">, MenuSeparatorState>({
    defaultElement: "hr",
    render,
    state: EMPTY,
    className,
    style,
    children: undefined,
    props: rest,
  });
}

MenuSeparator.displayName = "MenuSeparator";

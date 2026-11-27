// No "use client": `NavigationMenu.List` reads no context and calls no hook, so a Server
// Component may render it (design/components/navigation-menu.md 8). It must not import from any
// "use client" module (checked by src/__tests__/directives.test.ts).
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { mergeRenderRef, renderElement } from "../internal/render-element.js";
import type { RenderProp, StateValue } from "../internal/types.js";

/** `NavigationMenu.List` has no state. */
export type NavigationMenuListState = Record<string, never>;

const EMPTY: Record<string, never> = {};

/**
 * Props of `NavigationMenu.List`.
 *
 * @see https://ui.funstack.work/components/navigation-menu
 */
export interface NavigationMenuListProps extends Omit<
  ComponentPropsWithRef<"ul">,
  "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, NavigationMenuListState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, NavigationMenuListState>;
  /** Content: `NavigationMenu.Item`s. */
  children?: StateValue<ReactNode, NavigationMenuListState>;
  /** Replace the default `<ul>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"ul">, NavigationMenuListState>;
}

/**
 * The top-level entries: a `<ul role="list">`. The explicit role keeps the list semantics that
 * Safari drops under `list-style: none` (design 1); it is a default the consumer may override.
 * Directive-free, so a Server Component may render it.
 *
 * @see https://ui.funstack.work/components/navigation-menu
 */
export function NavigationMenuList({
  className,
  style,
  children,
  render,
  ref,
  ...rest
}: NavigationMenuListProps) {
  return renderElement<ComponentPropsWithRef<"ul">, NavigationMenuListState>({
    defaultElement: "ul",
    render,
    state: EMPTY,
    className,
    style,
    children,
    props: { role: "list", ...rest },
    // Passed through to the element, never read during render.
    // oxlint-disable-next-line react/refs
    ref: mergeRenderRef(ref, render),
  });
}

NavigationMenuList.displayName = "NavigationMenuList";

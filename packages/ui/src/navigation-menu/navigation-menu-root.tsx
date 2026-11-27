// No "use client": `NavigationMenu.Root` reads no context and calls no hook, so a Server
// Component may render it and it runs once, on the server (design/components/navigation-menu.md
// 8). It must not import from any "use client" module (checked by src/__tests__/directives.test.ts).
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { mergeRenderRef, renderElement } from "../internal/render-element.js";
import type { RenderProp, StateValue } from "../internal/types.js";

/** `NavigationMenu.Root` has no state. */
export type NavigationMenuRootState = Record<string, never>;

const EMPTY: Record<string, never> = {};

/**
 * Props of `NavigationMenu.Root`.
 *
 * @see https://ui.funstack.work/components/navigation-menu
 */
export interface NavigationMenuRootProps extends Omit<
  ComponentPropsWithRef<"nav">,
  "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, NavigationMenuRootState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, NavigationMenuRootState>;
  /** Content: a `NavigationMenu.List`. */
  children?: StateValue<ReactNode, NavigationMenuRootState>;
  /** Replace the default `<nav>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"nav">, NavigationMenuRootState>;
}

/**
 * The navigation landmark: a `<nav>`. Structure only, with no state and no owned keys. Name it
 * with `aria-label` (or `aria-labelledby`) when the page has more than one `nav`.
 * Directive-free, so a Server Component may render it.
 *
 * @see https://ui.funstack.work/components/navigation-menu
 */
export function NavigationMenuRoot({
  className,
  style,
  children,
  render,
  ref,
  ...rest
}: NavigationMenuRootProps) {
  return renderElement<ComponentPropsWithRef<"nav">, NavigationMenuRootState>({
    defaultElement: "nav",
    render,
    state: EMPTY,
    className,
    style,
    children,
    props: rest,
    // Passed through to the element, never read during render.
    // oxlint-disable-next-line react/refs
    ref: mergeRenderRef(ref, render),
  });
}

NavigationMenuRoot.displayName = "NavigationMenuRoot";

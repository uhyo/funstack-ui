"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { resolveStateValue, useRender } from "../internal/use-render.js";
import { useTabsContext } from "./tabs-context.js";
import type { TabsOrientation } from "./tabs-context.js";
import { anchorName } from "./tabs-ids.js";

export interface TabsIndicatorState {
  /** Optimistic selected value, or `null` (the indicator is then `hidden`). */
  readonly value: string | null;
  readonly pending: boolean;
  readonly orientation: TabsOrientation;
}

export interface TabsIndicatorProps extends Omit<
  ComponentPropsWithRef<"span">,
  "hidden" | "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, TabsIndicatorState>;
  style?: StateValue<CSSProperties | undefined, TabsIndicatorState>;
  children?: StateValue<ReactNode, TabsIndicatorState>;
  render?: RenderProp<ComponentPropsWithRef<"span">, TabsIndicatorState>;
}

/**
 * A decorative marker that follows the optimistic selection. Positioned by CSS Anchor
 * Positioning: it sets `position-anchor` to the selected Tab's `anchor-name`; the consumer's CSS
 * gives it `position: absolute` and `anchor()` insets, and a CSS `transition` on those insets
 * slides it. It must come after the Tabs inside `Tabs.List` (an anchor must precede the
 * positioned element in tree order). No `<ViewTransition>`: it changes only in optimistic (sync)
 * commits, which never start a view transition (design 10.1).
 *
 * Owned keys (conventions 1.2): `aria-hidden`, `hidden`, `data-selected`, `data-pending`.
 */
export function TabsIndicator({ className, style, children, render, ...rest }: TabsIndicatorProps) {
  const ctx = useTabsContext("Tabs.Indicator");
  const value = ctx.optimistic;
  const state: TabsIndicatorState = {
    value,
    pending: ctx.pending,
    orientation: ctx.orientation,
  };
  const anchor = value === null ? undefined : anchorName(ctx.rootId, value);

  return useRender<ComponentPropsWithRef<"span">, TabsIndicatorState>({
    defaultElement: "span",
    render,
    state,
    className,
    // `position-anchor` sits under the consumer's style: the consumer wins.
    style: (s) => ({ positionAnchor: anchor, ...resolveStateValue(style, s) }),
    children,
    props: rest,
    libraryProps: {
      "aria-hidden": true,
      hidden: value === null,
      "data-selected": dataAttr(value !== null),
      "data-pending": dataAttr(ctx.pending),
    },
  });
}

TabsIndicator.displayName = "TabsIndicator";

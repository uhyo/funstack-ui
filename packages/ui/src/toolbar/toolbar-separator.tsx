"use client";
import type { ComponentPropsWithRef, CSSProperties } from "react";
import { useToolbarContext } from "../internal/toolbar-context.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import type { ToolbarOrientation } from "./toolbar-root.js";

/**
 * State of `Toolbar.Separator`, passed to the function forms of `className`, `style` and `render`.
 */
export interface ToolbarSeparatorState {
  /** The separator's own orientation: perpendicular to the Toolbar's. */
  readonly orientation: ToolbarOrientation;
}

/**
 * Props of `Toolbar.Separator`.
 *
 * @see https://ui.funstack.work/components/toolbar
 */
export interface ToolbarSeparatorProps extends Omit<
  ComponentPropsWithRef<"hr">,
  "aria-orientation" | "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, ToolbarSeparatorState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, ToolbarSeparatorState>;
  /** Replace the default `<hr>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"hr">, ToolbarSeparatorState>;
}

/**
 * `<hr aria-orientation>` between toolbar items: vertical in a horizontal Toolbar, horizontal in
 * a vertical one. Not focusable, not an item.
 *
 * Owned keys (conventions 1.2): `aria-orientation`, `data-orientation`.
 *
 * @see https://ui.funstack.work/components/toolbar
 */
export function ToolbarSeparator({ className, style, render, ...rest }: ToolbarSeparatorProps) {
  const toolbar = useToolbarContext();
  const orientation: ToolbarOrientation =
    toolbar?.orientation === "vertical" ? "horizontal" : "vertical";
  const state: ToolbarSeparatorState = { orientation };

  return useRender<ComponentPropsWithRef<"hr">, ToolbarSeparatorState>({
    defaultElement: "hr",
    render,
    state,
    className,
    style,
    children: undefined,
    props: rest,
    libraryProps: {
      "aria-orientation": orientation,
      "data-orientation": orientation,
    },
  });
}

ToolbarSeparator.displayName = "ToolbarSeparator";

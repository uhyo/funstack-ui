"use client";
import type { ComponentPropsWithRef, CSSProperties } from "react";
import { useToolbarContext } from "../internal/toolbar-context.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import type { ToolbarOrientation } from "./toolbar-root.js";

export interface ToolbarSeparatorState {
  /** The separator's own orientation: perpendicular to the Toolbar's. */
  readonly orientation: ToolbarOrientation;
}

export interface ToolbarSeparatorProps extends Omit<
  ComponentPropsWithRef<"hr">,
  "aria-orientation" | "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, ToolbarSeparatorState>;
  style?: StateValue<CSSProperties | undefined, ToolbarSeparatorState>;
  render?: RenderProp<ComponentPropsWithRef<"hr">, ToolbarSeparatorState>;
}

/**
 * `<hr aria-orientation>` between toolbar items: vertical in a horizontal Toolbar, horizontal in
 * a vertical one. Not focusable, not an item.
 *
 * Owned keys (conventions 1.2): `aria-orientation`, `data-orientation`.
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

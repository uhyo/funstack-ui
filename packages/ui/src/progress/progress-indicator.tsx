"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useProgressContext } from "./progress-context.js";
import type { ProgressState } from "./progress-root.js";

/**
 * Props of `Progress.Indicator`.
 *
 * @see https://ui.funstack.work/components/progress
 */
export interface ProgressIndicatorProps extends Omit<
  ComponentPropsWithRef<"span">,
  "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, ProgressState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, ProgressState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, ProgressState>;
  /** Replace the default `<span>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"span">, ProgressState>;
}

/**
 * `Progress.Indicator`: the fill. It renders no inline size: the consumer's CSS sizes it from the Root's inherited custom property. Owned keys: `data-indeterminate`, `data-complete`.
 *
 * @see https://ui.funstack.work/components/progress
 */
export function ProgressIndicator({
  className,
  style,
  children,
  render,
  ...rest
}: ProgressIndicatorProps) {
  const { state } = useProgressContext("Progress.Indicator");
  return useRender<ComponentPropsWithRef<"span">, ProgressState>({
    defaultElement: "span",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: {
      "data-indeterminate": dataAttr(state.indeterminate),
      "data-complete": dataAttr(state.complete),
    },
  });
}

ProgressIndicator.displayName = "ProgressIndicator";

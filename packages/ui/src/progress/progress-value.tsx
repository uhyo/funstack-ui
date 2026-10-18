"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useProgressContext } from "./progress-context.js";
import type { ProgressState } from "./progress-root.js";

export interface ProgressValueProps extends Omit<
  ComponentPropsWithRef<"span">,
  "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, ProgressState>;
  style?: StateValue<CSSProperties | undefined, ProgressState>;
  /** Default: `state.formattedValue` (nothing while indeterminate). */
  children?: StateValue<ReactNode, ProgressState>;
  render?: RenderProp<ComponentPropsWithRef<"span">, ProgressState>;
}

/**
 * `Progress.Value`: shows `state.formattedValue` or `children(state)`. `aria-hidden="true"` is a default the consumer may override, not an owned key: the same text is in the Root's `aria-valuetext`. Owned keys: `data-indeterminate`, `data-complete`.
 */
export function ProgressValue({ className, style, children, render, ...rest }: ProgressValueProps) {
  const { state } = useProgressContext("Progress.Value");
  const props = { ...rest, "aria-hidden": rest["aria-hidden"] ?? true };
  return useRender<ComponentPropsWithRef<"span">, ProgressState>({
    defaultElement: "span",
    render,
    state,
    className,
    style,
    children: children ?? state.formattedValue,
    props,
    libraryProps: {
      "data-indeterminate": dataAttr(state.indeterminate),
      "data-complete": dataAttr(state.complete),
    },
  });
}

ProgressValue.displayName = "ProgressValue";

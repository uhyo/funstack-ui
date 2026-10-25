"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useProgressContext } from "./progress-context.js";
import type { ProgressState } from "./progress-root.js";

/**
 * Props of `Progress.Label`.
 *
 * @see https://ui.funstack.work/components/progress
 */
export interface ProgressLabelProps extends Omit<
  ComponentPropsWithRef<"span">,
  "id" | "className" | "style" | "children"
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
 * `Progress.Label`: a `span` whose id the Root always references through `aria-labelledby` (the Root is not a labelable element, so a `<label for>` would associate nothing). Owned keys: `id`, `data-indeterminate`, `data-complete`.
 *
 * @see https://ui.funstack.work/components/progress
 */
export function ProgressLabel({ className, style, children, render, ...rest }: ProgressLabelProps) {
  const { id, state } = useProgressContext("Progress.Label");
  return useRender<ComponentPropsWithRef<"span">, ProgressState>({
    defaultElement: "span",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: {
      id: `${id}-label`,
      "data-indeterminate": dataAttr(state.indeterminate),
      "data-complete": dataAttr(state.complete),
    },
  });
}

ProgressLabel.displayName = "ProgressLabel";

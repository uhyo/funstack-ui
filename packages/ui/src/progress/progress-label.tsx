"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useProgressContext } from "./progress-context.js";
import type { ProgressState } from "./progress-root.js";

export interface ProgressLabelProps extends Omit<
  ComponentPropsWithRef<"span">,
  "id" | "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, ProgressState>;
  style?: StateValue<CSSProperties | undefined, ProgressState>;
  children?: StateValue<ReactNode, ProgressState>;
  render?: RenderProp<ComponentPropsWithRef<"span">, ProgressState>;
}

/**
 * `Progress.Label`: a `span` whose id the Root always references through `aria-labelledby` (the Root is not a labelable element, so a `<label for>` would associate nothing). Owned keys: `id`, `data-indeterminate`, `data-complete`.
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

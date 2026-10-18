"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useProgressContext } from "./progress-context.js";
import type { ProgressState } from "./progress-root.js";

export interface ProgressTrackProps extends Omit<
  ComponentPropsWithRef<"div">,
  "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, ProgressState>;
  style?: StateValue<CSSProperties | undefined, ProgressState>;
  children?: StateValue<ReactNode, ProgressState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, ProgressState>;
}

/**
 * `Progress.Track`: the rail. It renders nothing but the state's data attributes. Owned keys: `data-indeterminate`, `data-complete`.
 */
export function ProgressTrack({ className, style, children, render, ...rest }: ProgressTrackProps) {
  const { state } = useProgressContext("Progress.Track");
  return useRender<ComponentPropsWithRef<"div">, ProgressState>({
    defaultElement: "div",
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

ProgressTrack.displayName = "ProgressTrack";

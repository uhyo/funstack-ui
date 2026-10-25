"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useProgressContext } from "./progress-context.js";
import type { ProgressState } from "./progress-root.js";

/**
 * Props of `Progress.Track`.
 *
 * @see https://ui.funstack.work/components/progress
 */
export interface ProgressTrackProps extends Omit<
  ComponentPropsWithRef<"div">,
  "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, ProgressState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, ProgressState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, ProgressState>;
  /** Replace the default `<div>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"div">, ProgressState>;
}

/**
 * `Progress.Track`: the rail. It renders nothing but the state's data attributes. Owned keys: `data-indeterminate`, `data-complete`.
 *
 * @see https://ui.funstack.work/components/progress
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

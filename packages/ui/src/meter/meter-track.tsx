"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useMeterContext } from "./meter-context.js";
import type { MeterState } from "./meter-root.js";

/**
 * Props of `Meter.Track`.
 *
 * @see https://ui.funstack.work/components/meter
 */
export interface MeterTrackProps extends Omit<
  ComponentPropsWithRef<"div">,
  "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, MeterState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, MeterState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, MeterState>;
  /** Replace the default `<div>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"div">, MeterState>;
}

/**
 * `Meter.Track`: the rail. It renders nothing but the state's data attributes. Owned keys: `data-region`.
 *
 * @see https://ui.funstack.work/components/meter
 */
export function MeterTrack({ className, style, children, render, ...rest }: MeterTrackProps) {
  const { state } = useMeterContext("Meter.Track");
  return useRender<ComponentPropsWithRef<"div">, MeterState>({
    defaultElement: "div",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: {
      "data-region": state.region,
    },
  });
}

MeterTrack.displayName = "MeterTrack";

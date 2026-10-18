"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useMeterContext } from "./meter-context.js";
import type { MeterState } from "./meter-root.js";

export interface MeterTrackProps extends Omit<
  ComponentPropsWithRef<"div">,
  "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, MeterState>;
  style?: StateValue<CSSProperties | undefined, MeterState>;
  children?: StateValue<ReactNode, MeterState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, MeterState>;
}

/**
 * `Meter.Track`: the rail. It renders nothing but the state's data attributes. Owned keys: `data-region`.
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

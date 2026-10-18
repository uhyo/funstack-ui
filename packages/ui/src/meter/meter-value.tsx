"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useMeterContext } from "./meter-context.js";
import type { MeterState } from "./meter-root.js";

export interface MeterValueProps extends Omit<
  ComponentPropsWithRef<"span">,
  "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, MeterState>;
  style?: StateValue<CSSProperties | undefined, MeterState>;
  /** Default: `state.formattedValue`. */
  children?: StateValue<ReactNode, MeterState>;
  render?: RenderProp<ComponentPropsWithRef<"span">, MeterState>;
}

/**
 * `Meter.Value`: shows `state.formattedValue` or `children(state)`. `aria-hidden="true"` is a default the consumer may override, not an owned key: the same text is in the Root's `aria-valuetext`. Owned keys: `data-region`.
 */
export function MeterValue({ className, style, children, render, ...rest }: MeterValueProps) {
  const { state } = useMeterContext("Meter.Value");
  const props = { ...rest, "aria-hidden": rest["aria-hidden"] ?? true };
  return useRender<ComponentPropsWithRef<"span">, MeterState>({
    defaultElement: "span",
    render,
    state,
    className,
    style,
    children: children ?? state.formattedValue,
    props,
    libraryProps: {
      "data-region": state.region,
    },
  });
}

MeterValue.displayName = "MeterValue";

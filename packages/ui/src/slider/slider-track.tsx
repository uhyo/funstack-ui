"use client";
import { useCallback } from "react";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { resolveStateValue, useRender } from "../internal/use-render.js";
import { useSliderContext } from "./slider-context.js";
import type { SliderOrientation } from "./slider-root.js";

export interface SliderTrackState {
  readonly orientation: SliderOrientation;
  /** A pointer is captured on a thumb. */
  readonly dragging: boolean;
  readonly disabled: boolean;
}

export interface SliderTrackProps extends Omit<
  ComponentPropsWithRef<"div">,
  "onPointerDown" | "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, SliderTrackState>;
  style?: StateValue<CSSProperties | undefined, SliderTrackState>;
  children?: StateValue<ReactNode, SliderTrackState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, SliderTrackState>;
}

/**
 * The rail the thumbs move along. A press moves the nearest thumb, focuses its input and starts
 * its drag; its box is the geometry reference for the pointer math (its computed `direction`
 * mirrors a horizontal slider). Owned keys: `onPointerDown`, `data-orientation`,
 * `data-disabled`, and `touch-action` in `style` (`pan-y` horizontal, `pan-x` vertical; the
 * consumer's entry wins).
 */
export function SliderTrack({ className, style, children, render, ...rest }: SliderTrackProps) {
  const ctx = useSliderContext("Slider.Track");
  const { trackRef } = ctx;
  const libraryRef = useCallback(
    (element: HTMLDivElement) => {
      trackRef.current = element;
      return () => {
        if (trackRef.current === element) trackRef.current = null;
      };
    },
    [trackRef],
  );

  const state: SliderTrackState = {
    orientation: ctx.orientation,
    dragging: ctx.draggingThumb !== null,
    disabled: ctx.disabled,
  };
  const touchAction: CSSProperties = {
    touchAction: ctx.orientation === "vertical" ? "pan-x" : "pan-y",
  };

  return useRender<ComponentPropsWithRef<"div">, SliderTrackState>({
    defaultElement: "div",
    render,
    state,
    className,
    style: (s) => ({ ...touchAction, ...resolveStateValue(style, s) }),
    children,
    props: rest,
    ref: libraryRef,
    libraryProps: {
      "data-orientation": ctx.orientation,
      "data-disabled": dataAttr(ctx.disabled),
      onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
        // A press on a Thumb bubbles here after the Thumb began its gesture; the Root ignores it.
        ctx.beginGesture(null, event.nativeEvent, event.currentTarget);
      },
    },
  });
}

SliderTrack.displayName = "SliderTrack";

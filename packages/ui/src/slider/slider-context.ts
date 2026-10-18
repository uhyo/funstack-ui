"use client";
import { createContext, use } from "react";
import type { RefObject } from "react";
import type { SliderOrientation, SliderRootState, SliderValue } from "./slider-root.js";

export interface SliderContextValue {
  /** The Root's state, for `Slider.Label` and `Slider.Value`. */
  readonly state: SliderRootState<SliderValue>;
  /** The values the thumbs show (design 2.2): `live` while held, else optimistic. */
  readonly shown: readonly number[];
  /** `shown` in the prop's shape (`number` or array). */
  readonly shownValue: number | readonly number[];
  readonly min: number;
  readonly max: number;
  readonly step: number;
  /** `minStepsBetweenThumbs × step`. */
  readonly gap: number;
  readonly orientation: SliderOrientation;
  readonly disabled: boolean;
  /** A step or commit dispatched through this Slider is in flight. */
  readonly pending: boolean;
  /** The thumb a pointer is captured on, or `null`. */
  readonly draggingThumb: number | null;
  /** The thumb the latest step or commit moved, or `null` (platform dispatches). */
  readonly pendingThumb: number | null;
  readonly name: string | undefined;
  readonly form: string | undefined;
  readonly getAriaValueText: ((value: number, index: number) => string) | undefined;
  readonly labelId: string;
  readonly thumbId: (index: number) => string;
  /** The Track's element: the geometry reference for pointer math. */
  readonly trackRef: RefObject<HTMLElement | null>;

  /** The native `input` of thumb `index` (React `onChange`): one step. */
  readonly inputStep: (index: number, value: number, event: Event) => void;
  /** The native `change` of thumb `index`: the key press's commit. */
  readonly inputCommit: (index: number, event: Event) => void;
  /** `keydown` on thumb `index`: ArrowLeft / ArrowRight normalisation of a vertical slider. */
  readonly inputKeyDown: (index: number, event: KeyboardEvent) => void;
  /** `pointerdown` on a Thumb (`index`) or on the Track (`null`: the nearest thumb). */
  readonly beginGesture: (index: number | null, event: PointerEvent, element: HTMLElement) => void;
  /** Called by each Thumb from a layout effect; returns the unregistration. */
  readonly registerThumb: (index: number, input: HTMLInputElement) => () => void;
  /** Called by each Label from a layout effect; returns the unregistration. */
  readonly registerLabel: () => () => void;
  /** Late-mounting Thumbs report here (useNativeGroupReconciliation). */
  readonly onItemMounted: () => void;
}

export const SliderContext = createContext<SliderContextValue | null>(null);

export function useSliderContext(part: string): SliderContextValue {
  const context = use(SliderContext);
  if (context === null) {
    throw new Error(`${part} must be rendered inside a Slider.Root.`);
  }
  return context;
}

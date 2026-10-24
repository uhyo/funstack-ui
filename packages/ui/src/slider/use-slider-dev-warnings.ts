"use client";
import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { isMaxReachable, isOnGrid, shapeOf, toArray } from "./slider-arithmetic.js";

const isDev = process.env.NODE_ENV !== "production";

export interface SliderDevWarningsOptions {
  /** The `step` prop as given, and whether it is a positive number. */
  readonly stepProp: number;
  readonly stepValid: boolean;
  readonly min: number;
  readonly max: number;
  /** The step in use. */
  readonly step: number;
  readonly value: number | readonly number[] | undefined;
  readonly defaultValue: number | readonly number[] | undefined;
  /** The shape fixed at mount. */
  readonly shape: "number" | "array";
  /** Several thumbs with no name: outside a Field, no `aria-label` / `aria-labelledby`. */
  readonly unnamedGroup: boolean;
  /** Mounted `Slider.Label`s, current before the re-render their registration scheduled. */
  readonly labelCountRef: RefObject<number>;
}

/** `Slider.Root`'s development warnings about its props (design 3.1, 5, 9.1). */
export function useSliderDevWarnings(options: SliderDevWarningsOptions): void {
  const { stepProp, stepValid, min, max, step, value, defaultValue, shape } = options;
  const { unnamedGroup, labelCountRef } = options;
  useDevWarning(
    !stepValid,
    isDev && `Slider.Root: \`step\` must be a positive number (got ${String(stepProp)}); using 1.`,
  );
  useDevWarning(
    stepValid && !isMaxReachable(min, max, step),
    isDev &&
      `Slider.Root: \`max\` (${max}) is not on the step grid from \`min\` (${min}) with \`step\` ` +
        `${step}: it is unreachable, as on a native range. The last reachable value is the last ` +
        `step below \`max\`.`,
  );
  const given = value ?? defaultValue;
  const givenValues = given === undefined ? [] : toArray(given);
  useDevWarning(
    givenValues.some((v) => !isOnGrid(v, min, max, step)),
    isDev &&
      `Slider.Root: the ${value !== undefined ? "`value`" : "`defaultValue`"} ` +
        `(${givenValues.join(", ")}) is off the step grid or outside \`min\` / \`max\`. It is ` +
        `rendered as given and the browser sanitises it; the first user step snaps it.`,
  );
  useDevWarning(
    givenValues.some((v, i) => i > 0 && v < (givenValues[i - 1] as number)),
    isDev &&
      `Slider.Root: the values (${givenValues.join(", ")}) must be in ascending order; the thumbs ` +
        `would be rendered crossed.`,
  );
  const currentShape = shapeOf(given);
  useDevWarning(
    currentShape !== undefined && currentShape !== shape,
    isDev &&
      `Slider.Root: the value changed shape between a number and an array after mount. The shape ` +
        `is fixed at mount; remount the Slider (a \`key\`) to change the number of thumbs.`,
  );
  const warnedGroupName = useRef(false);
  useEffect(() => {
    if (!isDev || warnedGroupName.current || !unnamedGroup || labelCountRef.current > 0) return;
    warnedGroupName.current = true;
    console.error(
      "Slider.Root: a slider with several thumbs is a `group` and needs a name: render a " +
        "Slider.Label, or pass `aria-label` / `aria-labelledby` to the Root.",
    );
  }, [unnamedGroup, labelCountRef]);
}

// No "use client": `Meter.Root` uses only `useId`, arithmetic and `Intl`, and renders the client
// context's provider (conventions 7.1's second exception). Rendered by a Server Component it runs
// once, on the server (design/components/progress.md 8.1). It must not import from any
// "use client" module except its context (checked by src/__tests__/directives.test.ts).
import { useId } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { warnOnce } from "../internal/dev-warn.js";
import { clamp, formatRangeValue, isDegenerate, percentage } from "../internal/range-value.js";
import { mergeRenderRef, renderElement, resolveStateValue } from "../internal/render-element.js";
import type { DataAttributes } from "../internal/render-element.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { MeterContext } from "./meter-context.js";
import { meterRegion, resolveMeterBounds } from "./meter-region.js";
import type { MeterRegion } from "./meter-region.js";

export type { MeterRegion } from "./meter-region.js";

/** The state every Meter part receives. */
export interface MeterState {
  /** Clamped to `[min, max]`. */
  readonly value: number;
  /** The `min` prop. */
  readonly min: number;
  /** The `max` prop. */
  readonly max: number;
  /** After HTML's defaults and clamping. */
  readonly low: number;
  /** After HTML's defaults and clamping. */
  readonly high: number;
  /** After HTML's defaults and clamping. */
  readonly optimum: number;
  /** A number 0–100. */
  readonly percentage: number;
  /** The `Intl.NumberFormat` text of the value (or of the fraction, for the percent style). */
  readonly formattedValue: string;
  /** What `aria-valuetext` carries: `getAriaValueText`'s result, else `formattedValue`. */
  readonly valueText: string | null;
  /**
   * Which region of the range the value is in, as the platform computes it; rendered as
   * `data-region` on every part.
   */
  readonly region: MeterRegion;
}

/**
 * Props of `Meter.Root`.
 *
 * @see https://ui.funstack.work/components/meter
 */
export interface MeterRootProps extends Omit<
  ComponentPropsWithRef<"div">,
  | "role"
  | "aria-valuemin"
  | "aria-valuemax"
  | "aria-valuenow"
  | "aria-valuetext"
  | "defaultValue"
  | "defaultChecked"
  | "className"
  | "style"
  | "children"
> {
  /** Required: a meter always has a value. Clamped to `[min, max]`. */
  value: number;
  /**
   * Lower bound of the range.
   *
   * @defaultValue `0`
   */
  min?: number;
  /**
   * Upper bound of the range.
   *
   * @defaultValue `100`
   */
  max?: number;
  /**
   * Upper bound of the "low" part of the range.
   *
   * @defaultValue `min`
   */
  low?: number;
  /**
   * Lower bound of the "high" part of the range.
   *
   * @defaultValue `max`
   */
  high?: number;
  /**
   * The best value. Decides which part of the range is `optimum`.
   *
   * @defaultValue the midpoint, `(min + max) / 2`
   */
  optimum?: number;
  /**
   * `Intl.NumberFormat` options for `aria-valuetext` and `Meter.Value`. A `percent` style formats
   * the fraction of the range; any other style formats the value. Serialisable: a Server
   * Component may pass it.
   *
   * @defaultValue `{ style: "percent" }`
   */
  format?: Intl.NumberFormatOptions;
  /**
   * BCP 47 tag for `Intl.NumberFormat`. Pass it when a client tree is server-rendered.
   *
   * @defaultValue the runtime's locale
   */
  locale?: string;
  /**
   * The `aria-valuetext` to render instead of `formattedValue`. Called with the clamped value
   * and the state as it would be without this prop. Return `null` to render no
   * `aria-valuetext`.
   */
  getAriaValueText?: (value: number, state: MeterState) => string | null | undefined;
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
 * `Meter.Root`: a `div[role=meter]` with the ARIA values and `aria-valuetext` always,
 * `data-region`, and `--meter-value` / `--meter-low` / `--meter-high` / `--meter-optimum` (the
 * percentages) in `style`, where the consumer's entries win. Owned keys: `role`,
 * `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext`, `aria-labelledby`
 * (token-merged: the consumer's tokens, then `Meter.Label`'s id, always), `data-region`.
 *
 * @see https://ui.funstack.work/components/meter
 */
export function MeterRoot({
  value,
  min = 0,
  max = 100,
  low,
  high,
  optimum,
  format,
  locale,
  getAriaValueText,
  className,
  style,
  children,
  render,
  ref,
  ...rest
}: MeterRootProps) {
  const id = useId();

  let given = value;
  if (!Number.isFinite(given)) {
    warnOnce(
      `Meter.Root:non-finite:${given}`,
      `Meter.Root: \`value\` is ${given}, which is not a finite number; it is rendered as \`min\`.`,
    );
    given = min;
  }
  if (isDegenerate(min, max)) {
    warnOnce(
      `Meter.Root:degenerate:${min}:${max}`,
      `Meter.Root: \`max\` (${max}) must be greater than \`min\` (${min}); the percentage is ` +
        "rendered as 0.",
    );
  }

  const clamped = clamp(given, min, max);
  const bounds = resolveMeterBounds(min, max, low, high, optimum);
  const formattedValue = formatRangeValue(clamped, min, max, format, locale);
  const base: MeterState = {
    value: clamped,
    min,
    max,
    ...bounds,
    percentage: percentage(clamped, min, max),
    formattedValue,
    valueText: formattedValue,
    region: meterRegion(clamped, bounds.low, bounds.high, bounds.optimum),
  };
  const valueText =
    getAriaValueText === undefined ? formattedValue : (getAriaValueText(clamped, base) ?? null);
  const state: MeterState = valueText === base.valueText ? base : { ...base, valueText };

  const variables = {
    "--meter-value": `${state.percentage}%`,
    "--meter-low": `${percentage(bounds.low, min, max)}%`,
    "--meter-high": `${percentage(bounds.high, min, max)}%`,
    "--meter-optimum": `${percentage(bounds.optimum, min, max)}%`,
  };

  const libraryProps: Partial<ComponentPropsWithRef<"div">> & DataAttributes = {
    role: "meter",
    "aria-valuemin": min,
    "aria-valuemax": max,
    "aria-valuenow": clamped,
    "aria-valuetext": valueText ?? undefined,
    "aria-labelledby": `${id}-label`,
    "data-region": state.region,
  };

  const element = renderElement<ComponentPropsWithRef<"div">, MeterState>({
    defaultElement: "div",
    render,
    state,
    className,
    // The custom properties lose to the consumer's own entries (design 3.3).
    style: (s) => ({ ...(variables as CSSProperties), ...resolveStateValue(style, s) }),
    children,
    props: rest,
    libraryProps,
    // Passed through to the element, never read during render.
    // oxlint-disable-next-line react/refs
    ref: mergeRenderRef(ref, render),
  });

  return <MeterContext value={{ id, state }}>{element}</MeterContext>;
}

MeterRoot.displayName = "MeterRoot";

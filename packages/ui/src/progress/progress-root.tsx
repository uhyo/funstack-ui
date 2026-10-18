// No "use client": `Progress.Root` uses only `useId`, arithmetic and `Intl`, and renders the
// client context's provider (conventions 7.1's second exception). Rendered by a Server Component
// it runs once, on the server (design/components/progress.md 8.1). It must not import from any
// "use client" module except its context (checked by src/__tests__/directives.test.ts).
import { useId } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import { warnOnce } from "../internal/dev-warn.js";
import { clamp, formatRangeValue, isDegenerate, percentage } from "../internal/range-value.js";
import { mergeRenderRef, renderElement, resolveStateValue } from "../internal/render-element.js";
import type { DataAttributes } from "../internal/render-element.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { ProgressContext } from "./progress-context.js";

/** The state every Progress part receives. */
export interface ProgressState {
  /** The value clamped to `[min, max]`, or `null` while indeterminate. */
  readonly value: number | null;
  readonly min: number;
  readonly max: number;
  /** `(value - min) / (max - min) * 100`, a number 0–100; `null` while indeterminate. */
  readonly percentage: number | null;
  /**
   * The `Intl.NumberFormat` text of the value (or of the fraction, for the percent style): what
   * `Progress.Value` shows. `null` while indeterminate.
   */
  readonly formattedValue: string | null;
  /** What `aria-valuetext` carries: `getAriaValueText`'s result, else `formattedValue`. */
  readonly valueText: string | null;
  /** `value` is `null`. */
  readonly indeterminate: boolean;
  /** The clamped value has reached `max`. */
  readonly complete: boolean;
}

export interface ProgressRootProps extends Omit<
  ComponentPropsWithRef<"div">,
  | "role"
  | "aria-valuemin"
  | "aria-valuemax"
  | "aria-valuenow"
  | "aria-valuetext"
  | "className"
  | "style"
  | "children"
> {
  /** The current value. Absent or `null`: indeterminate. Clamped to `[min, max]`. */
  value?: number | null;
  /** @default 0 */
  min?: number;
  /** @default 100 */
  max?: number;
  /**
   * `Intl.NumberFormat` options for `aria-valuetext` and `Progress.Value`. Default
   * `{ style: "percent" }`. A `percent` style formats the fraction of the range; any other style
   * formats the value. Serialisable: a Server Component may pass it.
   */
  format?: Intl.NumberFormatOptions;
  /**
   * BCP 47 tag for `Intl.NumberFormat`; default: the runtime's locale. Pass it when a client
   * tree is server-rendered.
   */
  locale?: string;
  /**
   * The `aria-valuetext` to render instead of `formattedValue`. Called with the clamped value
   * (`null` while indeterminate) and the state as it would be without this prop. Return `null`
   * to render no `aria-valuetext`. A function: from a Server Component it works when this Root
   * is rendered by that Server Component (the Root runs on the server), not when the Root is
   * rendered by a client component.
   */
  getAriaValueText?: (value: number | null, state: ProgressState) => string | null | undefined;
  className?: StateValue<string | undefined, ProgressState>;
  style?: StateValue<CSSProperties | undefined, ProgressState>;
  children?: StateValue<ReactNode, ProgressState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, ProgressState>;
}

/**
 * `Progress.Root`: a `div[role=progressbar]` with the ARIA values, `aria-valuetext` from
 * `Intl.NumberFormat`, `data-indeterminate` / `data-complete`, and `--progress-value` (the
 * percentage, absent while indeterminate) in `style`, where the consumer's entries win. Owned
 * keys: `role`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext`,
 * `aria-labelledby` (token-merged: the consumer's tokens, then `Progress.Label`'s id, always),
 * `data-indeterminate`, `data-complete`.
 */
export function ProgressRoot({
  value = null,
  min = 0,
  max = 100,
  format,
  locale,
  getAriaValueText,
  className,
  style,
  children,
  render,
  ref,
  ...rest
}: ProgressRootProps) {
  const id = useId();

  let given = value;
  if (given !== null && !Number.isFinite(given)) {
    warnOnce(
      `Progress.Root:non-finite:${given}`,
      `Progress.Root: \`value\` is ${given}, which is not a finite number; the bar is rendered ` +
        "as indeterminate. Pass `null` for an unknown value.",
    );
    given = null;
  }
  const degenerate = isDegenerate(min, max);
  if (degenerate) {
    warnOnce(
      `Progress.Root:degenerate:${min}:${max}`,
      `Progress.Root: \`max\` (${max}) must be greater than \`min\` (${min}); the percentage is ` +
        "rendered as 0. Pass `value={null}` while the total is unknown or empty.",
    );
  }

  const clamped = given === null ? null : clamp(given, min, max);
  const formattedValue =
    clamped === null ? null : formatRangeValue(clamped, min, max, format, locale);
  const base: ProgressState = {
    value: clamped,
    min,
    max,
    percentage: clamped === null ? null : percentage(clamped, min, max),
    formattedValue,
    valueText: formattedValue,
    indeterminate: clamped === null,
    complete: clamped !== null && !degenerate && clamped >= max,
  };
  const valueText =
    getAriaValueText === undefined ? formattedValue : (getAriaValueText(clamped, base) ?? null);
  const state: ProgressState = valueText === base.valueText ? base : { ...base, valueText };

  const variables = state.percentage === null ? {} : { "--progress-value": `${state.percentage}%` };

  const libraryProps: Partial<ComponentPropsWithRef<"div">> & DataAttributes = {
    role: "progressbar",
    "aria-valuemin": min,
    "aria-valuemax": max,
    "aria-valuenow": clamped ?? undefined,
    "aria-valuetext": valueText ?? undefined,
    "aria-labelledby": `${id}-label`,
    "data-indeterminate": dataAttr(state.indeterminate),
    "data-complete": dataAttr(state.complete),
  };

  const element = renderElement<ComponentPropsWithRef<"div">, ProgressState>({
    defaultElement: "div",
    render,
    state,
    className,
    // The custom property loses to the consumer's own entry (design 3.1).
    style: (s) => ({ ...(variables as CSSProperties), ...resolveStateValue(style, s) }),
    children,
    props: rest,
    libraryProps,
    // Passed through to the element, never read during render.
    // oxlint-disable-next-line react/refs
    ref: mergeRenderRef(ref, render),
  });

  return <ProgressContext value={{ id, state }}>{element}</ProgressContext>;
}

ProgressRoot.displayName = "ProgressRoot";

"use client";
import { useEffect, useRef } from "react";
import { useDevWarning } from "../internal/use-dev-warning.js";
import type { StepBounds } from "./number-field-arithmetic.js";
import type { NumberFormatter } from "./number-field-format.js";

const isDev = process.env.NODE_ENV !== "production";

function languageOf(tag: string): string {
  return tag.split("-")[0]?.toLowerCase() ?? "";
}

export interface NumberFieldDevWarningsOptions {
  /** The `value` / `defaultValue` props as given (before `NaN` / `Infinity` become empty). */
  readonly value: number | null | undefined;
  readonly defaultValue: number | null | undefined;
  /** The `min` / `max` props as given, and the bounds in use. */
  readonly min: number | undefined;
  readonly max: number | undefined;
  readonly bounds: StepBounds;
  /** `step` and `largeStep` are absent or positive numbers. */
  readonly stepValid: boolean;
  readonly largeStepValid: boolean;
  readonly formatter: NumberFormatter;
  /** The `locale` prop. */
  readonly locale: string | readonly string[] | undefined;
}

/** `NumberField.Root`'s development warnings about its props (design 3.1, 8). */
export function useNumberFieldDevWarnings(options: NumberFieldDevWarningsOptions): void {
  const { value, defaultValue, min, max, bounds, formatter, locale } = options;
  useDevWarning(
    (value !== undefined && value !== null && !Number.isFinite(value)) ||
      (defaultValue !== undefined && defaultValue !== null && !Number.isFinite(defaultValue)),
    isDev &&
      "NumberField.Root: `value` / `defaultValue` must be a finite number or `null`; " +
        `got ${String(value ?? defaultValue)}, treated as empty.`,
  );
  useDevWarning(
    bounds.min !== undefined && bounds.max !== undefined && bounds.min > bounds.max,
    isDev && `NumberField.Root: \`min\` (${String(min)}) is greater than \`max\` (${String(max)}).`,
  );
  useDevWarning(
    !options.stepValid || !options.largeStepValid,
    isDev &&
      "NumberField.Root: `step` and `largeStep` must be positive numbers; using the defaults.",
  );
  useDevWarning(
    formatter.warning !== null,
    isDev && `NumberField.Root: ${formatter.warning ?? ""}`,
  );
  const warnedLang = useRef(false);
  useEffect(() => {
    if (!isDev || warnedLang.current || locale !== undefined) return;
    const lang = document.documentElement.lang;
    if (lang === "" || languageOf(lang) === languageOf(formatter.locale)) return;
    warnedLang.current = true;
    console.error(
      `NumberField.Root: the page is \`lang="${lang}"\` but NumberField formats as ` +
        `\`${formatter.locale}\` (the runtime's locale); pass \`locale\`.`,
    );
  }, [locale, formatter]);
}

// No "use client": pure arithmetic and formatting shared by the directive-free `Progress.Root`
// and `Meter.Root` (design/components/progress.md 2.1, 2.2 and implementation note 14.4).

/** The platform's clamp (`<progress>` 150 of 100 is 100). A degenerate range yields `min`. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Whether `[min, max]` is empty or a point (`max <= min`): a bug at the call site. */
export function isDegenerate(min: number, max: number): boolean {
  return !(max > min);
}

/** `(value - min) / (max - min)`, `0` for a degenerate range. */
export function fraction(value: number, min: number, max: number): number {
  return isDegenerate(min, max) ? 0 : (value - min) / (max - min);
}

/** The fraction as a number 0–100. */
export function percentage(value: number, min: number, max: number): number {
  return fraction(value, min, max) * 100;
}

const PERCENT: Intl.NumberFormatOptions = { style: "percent" };
const CACHE_LIMIT = 32;
const formatters = new Map<string, Intl.NumberFormat>();

/**
 * One `Intl.NumberFormat` per `locale` + `format`, so an update loop does not construct one per
 * render. Bounded: past 32 entries the oldest is dropped.
 */
export function getNumberFormat(
  locale: string | undefined,
  format: Intl.NumberFormatOptions | undefined,
): Intl.NumberFormat {
  const options = format ?? PERCENT;
  const key = `${locale ?? ""}\u0000${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (formatter === undefined) {
    formatter = new Intl.NumberFormat(locale, options);
    if (formatters.size >= CACHE_LIMIT) {
      const oldest = formatters.keys().next().value;
      if (oldest !== undefined) formatters.delete(oldest);
    }
    formatters.set(key, formatter);
  }
  return formatter;
}

/**
 * The visible text of a (clamped) value: the fraction of the range for the `percent` style (the
 * default when `format` is absent), the value itself for any other style. A `format` without
 * `style` is `decimal` per `Intl` and formats the value.
 */
export function formatRangeValue(
  value: number,
  min: number,
  max: number,
  format: Intl.NumberFormatOptions | undefined,
  locale: string | undefined,
): string {
  const percentStyle = format === undefined || format.style === "percent";
  return getNumberFormat(locale, format).format(percentStyle ? fraction(value, min, max) : value);
}

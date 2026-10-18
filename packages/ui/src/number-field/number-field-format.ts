// Locale-aware formatting and parsing of NumberField (design/components/number-field.md 5). No
// directive: no React, no client-only API; usable on the server.
//
// ECMA-402 has no parser, so the locale's symbols are derived from `formatToParts` once per
// `(locale, format)` and the parser accepts exactly the shapes the formatter produces (plus
// full-width digits, ASCII signs and the other spellings of the currency or unit), with **strict
// grouping**: `1,5` under `en` is unparsable, never `15`.
import { roundTo } from "../internal/decimal.js";

export interface NumberFormatter {
  /** The resolved locale (`resolvedOptions().locale`). */
  readonly locale: string;
  /** The text for `value`; `""` for `null`. */
  readonly format: (value: number | null) => string;
  /**
   * The value `text` stands for, rounded (5.4): `null` for an empty text, `undefined` for an
   * unparsable one.
   */
  readonly parse: (text: string) => number | null | undefined;
  /** `value` rounded to what the text can show (5.4); unchanged with significant digits. */
  readonly round: (value: number) => number;
  /** The resolved `maximumFractionDigits`, or `undefined` when significant digits rule. */
  readonly fractionDigits: number | undefined;
  /** The format can show a fraction (`inputmode="decimal"`, 8.5). */
  readonly allowsFractions: boolean;
  /** `style: "percent"`: the text shows the value × 100. */
  readonly percent: boolean;
  /** Development: why this format cannot round-trip (`compact` notation, significant digits). */
  readonly warning: string | null;
}

// Bidirectional controls that some locales put around numbers and signs (`ar`: U+061C).
const BIDI = /[؜‎‏‪-‮⁦-⁩]/g;

function normalize(text: string): string {
  return text.normalize("NFKC").replace(BIDI, "").replace(/\s/g, " ").toLowerCase();
}

/** Every string `format` may emit, with the plural samples that change a unit or currency name. */
const SAMPLES = [-1234567.891, 0, 1, 2, 3, 5, 11, 21, 0.5, 1.5, 100];

function collect(
  locale: string | readonly string[] | undefined,
  options: Intl.NumberFormatOptions,
  type: Intl.NumberFormatPartTypes,
  into: Set<string>,
): void {
  let formatter: Intl.NumberFormat;
  try {
    formatter = new Intl.NumberFormat(locale as string | string[] | undefined, options);
  } catch {
    return;
  }
  for (const sample of SAMPLES) {
    for (const part of formatter.formatToParts(sample)) {
      if (part.type !== type) continue;
      const value = normalize(part.value).trim();
      if (value !== "") into.add(value);
    }
  }
}

interface Symbols {
  readonly decimal: string;
  /** Group separators accepted (normalised). `" "` stands for any whitespace. */
  readonly groups: readonly string[];
  readonly minus: readonly string[];
  readonly plus: readonly string[];
  /** Currency, unit and percent strings, longest first. */
  readonly affixes: readonly string[];
  /** Literal strings the formatter puts around the number (never parentheses). */
  readonly literals: readonly string[];
  /** The numbering system's ten digits, normalised. */
  readonly digits: readonly string[];
  readonly primaryGroup: number;
  readonly secondaryGroup: number;
}

function deriveSymbols(
  locale: string | readonly string[] | undefined,
  options: Intl.NumberFormatOptions,
  numberingSystem: string,
): Symbols {
  const loc = locale as string | string[] | undefined;
  // A probe that always shows a fraction and groups, without rounding by significant digits.
  const probeOptions: Intl.NumberFormatOptions = {
    ...options,
    notation: "standard",
    useGrouping: true,
    minimumFractionDigits: 1,
    maximumFractionDigits: 3,
    minimumSignificantDigits: undefined,
    maximumSignificantDigits: undefined,
    signDisplay: "auto",
    numberingSystem,
  };
  let probe: Intl.NumberFormat;
  try {
    probe = new Intl.NumberFormat(loc, probeOptions);
  } catch {
    probe = new Intl.NumberFormat(loc, {
      useGrouping: true,
      minimumFractionDigits: 1,
      numberingSystem,
    });
  }
  const parts = probe.formatToParts(-1234567890.5);
  let decimal = ".";
  let group = ",";
  const minus = new Set(["-", "−"]);
  const plus = new Set(["+"]);
  const integers: string[] = [];
  for (const part of parts) {
    const value = normalize(part.value);
    if (part.type === "decimal") decimal = value;
    else if (part.type === "group") group = value;
    else if (part.type === "minusSign" && value.trim() !== "") minus.add(value.trim());
    else if (part.type === "integer") integers.push(part.value);
  }
  try {
    for (const part of new Intl.NumberFormat(loc, {
      ...probeOptions,
      signDisplay: "always",
    }).formatToParts(1)) {
      if (part.type === "plusSign") plus.add(normalize(part.value).trim());
    }
  } catch {
    // The plus sign stays ASCII.
  }
  const primaryGroup = integers.at(-1)?.length ?? 3;
  const secondaryGroup = integers.length > 2 ? (integers.at(-2)?.length ?? 3) : primaryGroup;

  const groups = [group.trim() === "" ? " " : group];
  // An apostrophe group (`de-CH`) is typed with whichever apostrophe the keyboard has.
  if (["'", "’", "ʼ"].includes(group)) groups.push("'", "’", "ʼ");

  const affixes = new Set<string>();
  const style = options.style ?? "decimal";
  if (style === "percent") {
    collect(loc, options, "percentSign", affixes);
    affixes.add("%");
  } else if (style === "currency") {
    for (const currencyDisplay of ["symbol", "narrowSymbol", "code", "name"] as const) {
      collect(loc, { ...options, currencyDisplay }, "currency", affixes);
    }
    if (options.currency !== undefined) affixes.add(options.currency.toLowerCase());
  } else if (style === "unit") {
    for (const unitDisplay of ["short", "long", "narrow"] as const) {
      collect(loc, { ...options, unitDisplay }, "unit", affixes);
    }
  }
  const literals = new Set<string>();
  collect(loc, options, "literal", literals);
  for (const ch of ["(", ")"]) literals.delete(ch);

  const digitFormat = new Intl.NumberFormat(loc, { useGrouping: false, numberingSystem });
  const digits = Array.from({ length: 10 }, (_, d) => normalize(digitFormat.format(d)));

  return {
    decimal,
    groups,
    minus: [...minus],
    plus: [...plus],
    affixes: [...affixes].sort((a, b) => b.length - a.length),
    literals: [...literals].filter((l) => l !== "").sort((a, b) => b.length - a.length),
    digits,
    primaryGroup,
    secondaryGroup,
  };
}

function stripEdges(text: string, tokens: readonly string[]): string {
  let s = text.trim();
  let changed = true;
  while (changed && s !== "") {
    changed = false;
    for (const token of tokens) {
      if (s.startsWith(token)) {
        s = s.slice(token.length).trim();
        changed = true;
      }
      if (s.endsWith(token)) {
        s = s.slice(0, s.length - token.length).trim();
        changed = true;
      }
    }
  }
  return s;
}

function startsWithAny(s: string, tokens: readonly string[]): string | null {
  for (const token of tokens) if (s.startsWith(token)) return token;
  return null;
}

function endsWithAny(s: string, tokens: readonly string[]): string | null {
  for (const token of tokens) if (s.endsWith(token)) return token;
  return null;
}

/** Strict grouping (5.3 step 5): the integer part, with group separators replaced by nothing. */
function ungroup(integer: string, symbols: Symbols): string | undefined {
  const separators = symbols.groups;
  const chunks: string[] = [];
  let current = "";
  for (const ch of integer) {
    if (separators.includes(ch)) {
      chunks.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  chunks.push(current);
  if (chunks.length === 1) return integer;
  const { primaryGroup, secondaryGroup } = symbols;
  const last = chunks.length - 1;
  for (let i = 0; i <= last; i += 1) {
    const length = chunks[i]!.length;
    if (i === last) {
      if (length !== primaryGroup) return undefined;
    } else if (i === 0) {
      if (length < 1 || length > secondaryGroup) return undefined;
    } else if (length !== secondaryGroup) {
      return undefined;
    }
  }
  return chunks.join("");
}

function parseWith(
  text: string,
  symbols: Symbols,
  percent: boolean,
  round: (value: number) => number,
): number | null | undefined {
  let s = normalize(text).trim();
  if (s === "") return null;

  // 2. Currency, unit and percent strings, anywhere.
  for (const affix of symbols.affixes) s = s.split(affix).join(" ");
  s = stripEdges(s, symbols.literals);
  if (s === "") return undefined;

  // 3. One sign: parentheses (accounting), a leading or trailing minus or plus.
  let negative = false;
  if (s.startsWith("(") && s.endsWith(")")) {
    negative = true;
    s = stripEdges(s.slice(1, -1), symbols.literals);
  } else {
    const leadMinus = startsWithAny(s, symbols.minus);
    const leadPlus = leadMinus === null ? startsWithAny(s, symbols.plus) : null;
    if (leadMinus !== null || leadPlus !== null) {
      negative = leadMinus !== null;
      s = s.slice((leadMinus ?? leadPlus)!.length);
    } else {
      const trailMinus = endsWithAny(s, symbols.minus);
      const trailPlus = trailMinus === null ? endsWithAny(s, symbols.plus) : null;
      if (trailMinus !== null || trailPlus !== null) {
        negative = trailMinus !== null;
        s = s.slice(0, s.length - (trailMinus ?? trailPlus)!.length);
      }
    }
    s = stripEdges(s, symbols.literals);
  }
  if (s === "") return undefined;

  // 4. Digits to ASCII; anything but a digit, the decimal or a group separator is garbage.
  const decimalAliases = [symbols.decimal];
  // An Arabic decimal separator is often typed as the ASCII period.
  if (symbols.decimal === "٫" && !symbols.groups.includes(".")) decimalAliases.push(".");
  let integer = "";
  let fraction: string | null = null;
  for (const ch of s) {
    const localDigit = symbols.digits.indexOf(ch);
    const digit = localDigit !== -1 ? String(localDigit) : /[0-9]/.test(ch) ? ch : null;
    if (digit !== null) {
      if (fraction === null) integer += digit;
      else fraction += digit;
    } else if (decimalAliases.includes(ch)) {
      if (fraction !== null) return undefined;
      fraction = "";
    } else if (symbols.groups.includes(ch)) {
      // 5. Group separators only before the decimal separator.
      if (fraction !== null) return undefined;
      integer += ch;
    } else {
      return undefined;
    }
  }
  const digitsOnly = ungroup(integer, symbols);
  if (digitsOnly === undefined) return undefined;
  if (digitsOnly === "" && (fraction === null || fraction === "")) return undefined;

  // 6. The number; percent divides by 100.
  let value = Number(
    `${digitsOnly === "" ? "0" : digitsOnly}.${fraction ?? ""}`.replace(/\.$/, ""),
  );
  if (!Number.isFinite(value)) return undefined;
  if (negative) value = -value;
  // 7. Rounded to what the text shows.
  const result = round(percent ? value / 100 : value);
  return result === 0 ? 0 : result;
}

const cache = new Map<string, NumberFormatter>();

function cacheKey(locale: string | readonly string[] | undefined, format: object): string {
  const entries = Object.entries(format)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return JSON.stringify([locale ?? null, entries]);
}

/** A stable serialisation of `format`, for memoising on its content rather than its identity. */
export function formatKey(format: Intl.NumberFormatOptions | undefined): string {
  return cacheKey(undefined, format ?? {});
}

/**
 * The formatter and parser for `(locale, format)`, cached per pair at module level (construction
 * is expensive). `locale` `undefined` is the runtime's locale.
 */
export function createNumberFormatter(
  locale: string | readonly string[] | undefined,
  format: Intl.NumberFormatOptions = {},
): NumberFormatter {
  const key = cacheKey(locale, format);
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const intl = new Intl.NumberFormat(locale as string | string[] | undefined, format);
  const resolved = intl.resolvedOptions() as Intl.ResolvedNumberFormatOptions & {
    roundingPriority?: string;
  };
  const percent = resolved.style === "percent";
  const significant =
    format.maximumSignificantDigits !== undefined || format.minimumSignificantDigits !== undefined;
  const fractionDigits = significant ? undefined : resolved.maximumFractionDigits;
  const notation = format.notation ?? "standard";
  const warning =
    notation !== "standard"
      ? `\`notation: "${notation}"\` cannot be parsed back; typed text in this format reverts.`
      : significant
        ? "`maximumSignificantDigits` makes the value's rounding impossible to state; the value " +
          "may differ from the text."
        : null;

  const round = (value: number): number => {
    if (fractionDigits === undefined) return value;
    if (percent) return roundTo(roundTo(value * 100, fractionDigits) / 100, fractionDigits + 2);
    return roundTo(value, fractionDigits);
  };

  const symbols = deriveSymbols(locale, format, resolved.numberingSystem);
  const formatter: NumberFormatter = {
    locale: resolved.locale,
    format: (value) => (value === null ? "" : intl.format(value)),
    parse: (text) => parseWith(text, symbols, percent, round),
    round,
    fractionDigits,
    allowsFractions: percent || fractionDigits === undefined || fractionDigits > 0,
    percent,
    warning,
  };
  cache.set(key, formatter);
  return formatter;
}

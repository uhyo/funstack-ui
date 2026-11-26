// Directive-free: the pure filter of an OTPField (design/components/otp-field.md 4.1) and the
// `charset` table (section 3). No hook, no DOM.

/** Which characters a code may contain (design/components/otp-field.md 3). */
export type OTPFieldCharset = "numeric" | "alphanumeric" | "alphabetic";

interface CharsetRule {
  /** One kept character, after the full-width conversion. */
  readonly test: RegExp;
  readonly inputMode: "numeric" | "text";
  /** The `pattern` character class. */
  readonly pattern: string;
}

const CHARSETS: Record<OTPFieldCharset, CharsetRule> = {
  numeric: { test: /^[0-9]$/, inputMode: "numeric", pattern: "[0-9]" },
  alphanumeric: { test: /^[A-Za-z0-9]$/, inputMode: "text", pattern: "[A-Za-z0-9]" },
  alphabetic: { test: /^[A-Za-z]$/, inputMode: "text", pattern: "[A-Za-z]" },
};

function rule(charset: OTPFieldCharset): CharsetRule {
  return CHARSETS[charset] ?? CHARSETS.numeric;
}

/** `inputmode` for a charset: `numeric` for digits, `text` otherwise. */
export function charsetInputMode(charset: OTPFieldCharset): "numeric" | "text" {
  return rule(charset).inputMode;
}

/** The derived `pattern`: `[0-9]{6}` for six digits. */
export function charsetPattern(charset: OTPFieldCharset, length: number): string {
  return `${rule(charset).pattern}{${length}}`;
}

/**
 * Keeps the characters of `charset` in `text`, in order. Full-width digits (U+FF10 to U+FF19,
 * what a Japanese or Chinese IME types) are converted to ASCII for `"numeric"` (section 3).
 * Letters keep their case.
 */
export function filterChars(text: string, charset: OTPFieldCharset): string {
  const { test } = rule(charset);
  const numeric = charset === "numeric";
  let kept = "";
  for (const raw of text) {
    let char = raw;
    if (numeric) {
      const code = raw.codePointAt(0)!;
      if (code >= 0xff10 && code <= 0xff19) char = String.fromCharCode(code - 0xff10 + 48);
    }
    if (test.test(char)) kept += char;
  }
  return kept;
}

/** `filterChars`, cut to `length`: what a value may hold. */
export function normalizeCode(text: string, charset: OTPFieldCharset, length: number): string {
  return filterChars(text, charset).slice(0, Math.max(0, length));
}

/** The input's text and selection when `beforeinput` fired. */
export interface EditBefore {
  readonly text: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
}

export interface EditInput {
  /** The record from `beforeinput`; `null` when no `beforeinput` preceded the `input` (rule 6). */
  readonly before: EditBefore | null;
  /** The input's text after the browser's edit. */
  readonly dom: string;
  /** The input's `selectionStart` after the browser's edit (`null`: unknown). */
  readonly caret: number | null;
  /** `InputEvent.inputType` (`""` when unknown). */
  readonly inputType: string;
  readonly charset: OTPFieldCharset;
  readonly length: number;
}

export interface EditResult {
  /** The filtered value. */
  readonly value: string;
  /** Where the caret goes (collapsed), or `null` for "where the browser left it". */
  readonly caret: number | null;
  /**
   * Characters the edit inserted and the filter kept: `0` for a deletion and for an insertion
   * the filter dropped entirely (a letter typed into a numeric field). Completion runs only for
   * an edit that kept something or changed the value.
   */
  readonly kept: number;
  /** The selection to restore when the edit was dropped entirely: the one before it. */
  readonly selection: readonly [start: number, end: number] | null;
}

/**
 * Applies one `input` event to the value (design/components/otp-field.md 4.1). The browser has
 * already edited the text; this computes what the filtered text and the caret should be:
 *
 * 1. the inserted run is what the browser put between the kept prefix and suffix of the text
 *    before the edit, filtered by `charset`;
 * 2. a run of `length` characters or more replaces everything (a pasted full code);
 * 3. a selected range is replaced by the run;
 * 4. a collapsed caret overtypes: the run replaces as many characters as it has;
 * 5. a complete code with the caret at its end treats the last position as the caret's;
 * 6. a deletion, and an `input` with no `beforeinput`, is `filter(dom)`;
 * 7. the result is cut to `length`, the caret goes after the run.
 *
 * An insertion the filter dropped entirely leaves the value as it was and restores the
 * selection (section 4.2: "no feedback beyond the text not changing").
 */
export function applyEdit(input: EditInput): EditResult {
  const { before, dom, caret, inputType, charset, length } = input;
  const insertion = inputType.startsWith("insert");

  const fallback = (): EditResult => {
    const value = normalizeCode(dom, charset, length);
    // The caret keeps its place among the characters the filter kept before it.
    const at =
      caret === null
        ? null
        : Math.min(filterChars(dom.slice(0, caret), charset).length, value.length);
    return { value, caret: at, kept: 0, selection: null };
  };

  if (before === null || !insertion) return fallback();

  const { text, selectionStart, selectionEnd } = before;
  let start = Math.min(selectionStart, selectionEnd);
  let end = Math.max(selectionStart, selectionEnd);
  const prefix = text.slice(0, start);
  const suffix = text.slice(end);
  // Rule 1: the browser replaced [start, end) with the run; anything else (an engine that edits
  // elsewhere) falls back to rule 6.
  if (
    dom.length < prefix.length + suffix.length ||
    !dom.startsWith(prefix) ||
    !dom.endsWith(suffix)
  ) {
    return fallback();
  }
  const run = dom.slice(start, dom.length - suffix.length);
  const kept = filterChars(run, charset);

  if (kept.length === 0) {
    // Dropped entirely: the text before the edit, the selection where it was.
    const value = normalizeCode(text, charset, length);
    return {
      value,
      caret: null,
      kept: 0,
      selection: [Math.min(start, value.length), Math.min(end, value.length)],
    };
  }

  // Rule 2: a full code replaces everything.
  if (kept.length >= length) {
    return { value: kept.slice(0, length), caret: length, kept: kept.length, selection: null };
  }

  const base = normalizeCode(text, charset, length);
  start = Math.min(start, base.length);
  end = Math.min(end, base.length);
  let next: string;
  if (start !== end) {
    // Rule 3: the selected range is replaced.
    next = base.slice(0, start) + kept + base.slice(end);
  } else {
    // Rule 5: at the end of a complete code the last position is the caret's.
    if (base.length >= length && start >= length) start = length - 1;
    // Rule 4: overtype.
    next = base.slice(0, start) + kept + base.slice(start + kept.length);
  }
  next = next.slice(0, length);
  return {
    value: next,
    caret: Math.min(start + kept.length, length),
    kept: kept.length,
    selection: null,
  };
}

/** The active slots for a selection (section 4.3): `[from, to)`, empty when not focused. */
export function activeRange(
  focused: boolean,
  selectionStart: number | null,
  selectionEnd: number | null,
  length: number,
): readonly [from: number, to: number] {
  if (!focused || selectionStart === null || length <= 0) return [0, 0];
  const start = Math.min(selectionStart, selectionEnd ?? selectionStart);
  const end = Math.max(selectionStart, selectionEnd ?? selectionStart);
  if (start === end) {
    const slot = Math.min(start, length - 1);
    return [slot, slot + 1];
  }
  return [Math.min(start, length), Math.min(end, length)];
}

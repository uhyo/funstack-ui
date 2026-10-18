// Directive-free helpers for Field and Form (design/components/field-form.md 2, 14): the validity
// snapshot, error-value normalisation, the `:user-invalid` read and the element resolution.

/** A field error: a message, several messages, or nothing (`""`, `[]`, `null`, `undefined`). */
export type FieldErrorValue = string | readonly string[] | null | undefined;

/** Field errors keyed by field `name` (usually `state.errors` from `useActionState`). */
export type FormErrors = Readonly<Record<string, FieldErrorValue>>;

/**
 * A plain, serialisable snapshot of the control's `ValidityState` (all `false` and
 * `valid: true` on the server and before the first read).
 */
export interface FieldValidity {
  readonly valueMissing: boolean;
  readonly typeMismatch: boolean;
  readonly patternMismatch: boolean;
  readonly tooLong: boolean;
  readonly tooShort: boolean;
  readonly rangeUnderflow: boolean;
  readonly rangeOverflow: boolean;
  readonly stepMismatch: boolean;
  readonly badInput: boolean;
  readonly customError: boolean;
  readonly valid: boolean;
}

const VALIDITY_KEYS = [
  "valueMissing",
  "typeMismatch",
  "patternMismatch",
  "tooLong",
  "tooShort",
  "rangeUnderflow",
  "rangeOverflow",
  "stepMismatch",
  "badInput",
  "customError",
  "valid",
] as const satisfies readonly (keyof FieldValidity)[];

export const VALID: FieldValidity = Object.freeze({
  valueMissing: false,
  typeMismatch: false,
  patternMismatch: false,
  tooLong: false,
  tooShort: false,
  rangeUnderflow: false,
  rangeOverflow: false,
  stepMismatch: false,
  badInput: false,
  customError: false,
  valid: true,
});

export function snapshotValidity(validity: ValidityState): FieldValidity {
  const result = {} as Record<keyof FieldValidity, boolean>;
  for (const key of VALIDITY_KEYS) result[key] = validity[key];
  return result;
}

export function validityEquals(a: FieldValidity, b: FieldValidity): boolean {
  return VALIDITY_KEYS.every((key) => a[key] === b[key]);
}

export function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

const NONE: readonly string[] = Object.freeze([]);

/** `""`, `[]`, `null` and `undefined` mean no error; empty strings inside an array are dropped. */
export function normaliseErrorValue(value: FieldErrorValue): readonly string[] {
  if (value === null || value === undefined || value === "") return NONE;
  if (typeof value === "string") return [value];
  const list = value.filter((v) => typeof v === "string" && v !== "");
  return list.length === 0 ? NONE : list;
}

/** Some entry of `errors` is a non-empty error. */
export function hasAnyError(errors: FormErrors | undefined): boolean {
  if (errors === undefined) return false;
  return Object.values(errors).some((v) => normaliseErrorValue(v).length > 0);
}

let userInvalidSupport: boolean | undefined;

/**
 * Whether the environment implements `:user-invalid` (every engine the library supports does).
 * Decided once per module, so the read is not on a hot path.
 *
 * Detected with `CSS.supports("selector(:user-invalid)")` rather than by `matches()` throwing:
 * jsdom 30's selector engine knows the name and silently answers `false` (it does not throw), and
 * its `CSS.supports` reports `false`, so the fallback engages there and nowhere else
 * (memo/developer/field-form.md).
 */
export function supportsUserInvalid(): boolean {
  if (userInvalidSupport === undefined) {
    try {
      userInvalidSupport =
        typeof CSS !== "undefined" &&
        typeof CSS.supports === "function" &&
        CSS.supports("selector(:user-invalid)");
    } catch {
      userInvalidSupport = false;
    }
  }
  return userInvalidSupport;
}

/** An element that takes part in constraint validation. */
export type ValidatableElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isValidatable(el: Element): el is ValidatableElement {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
  );
}

/**
 * Where `validity`, `validationMessage`, `:user-invalid` and `setCustomValidity` are read and
 * written (design 7.1): the element itself when it is a form control, else the first named
 * `willValidate` member of a `<fieldset>` (a group's first enabled item, not a CheckboxGroup
 * Parent, which has no name), else the first `input` / `select` / `textarea` inside.
 */
export function validityElementOf(el: Element | null): ValidatableElement | null {
  if (el === null) return null;
  if (isValidatable(el)) return el;
  const members =
    el instanceof HTMLFieldSetElement
      ? [...el.elements]
      : [...el.querySelectorAll("input, select, textarea")];
  const controls = members.filter(isValidatable);
  return (
    controls.find((c) => c.willValidate && c.name !== "") ??
    controls.find((c) => c.willValidate) ??
    controls[0] ??
    null
  );
}

/**
 * What the Field focuses (design 2.5): the control itself, or for a group the checked radio if
 * any, else the first enabled member.
 */
export function focusTargetOf(el: Element | null): HTMLElement | null {
  if (el === null) return null;
  if (isValidatable(el)) return el;
  const members = (
    el instanceof HTMLFieldSetElement
      ? [...el.elements]
      : [...el.querySelectorAll("input, select, textarea, button")]
  ).filter(
    (m): m is HTMLElement =>
      m instanceof HTMLElement &&
      !(m as HTMLInputElement).disabled &&
      (m as HTMLInputElement).type !== "hidden",
  );
  const checkedRadio = members.find(
    (m) => m instanceof HTMLInputElement && m.type === "radio" && m.checked,
  );
  return checkedRadio ?? members.find(isValidatable) ?? members[0] ?? null;
}

/** Sorts elements into document order. */
export function sortByDocumentOrder<T>(items: readonly T[], elementOf: (item: T) => Node): T[] {
  return [...items].sort((a, b) => {
    const position = elementOf(a).compareDocumentPosition(elementOf(b));
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
}

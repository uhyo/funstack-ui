// Set and order helpers of the set-valued components (CheckboxGroup, ToggleGroup, Accordion) and
// Field. No directive: pure functions (conventions 7.1).

export type ValueSet = ReadonlySet<string>;

export const EMPTY_SET: ValueSet = new Set();

/** A value prop as a set: `null` is empty, a string is one value, an array is its values. */
export function toSet(value: string | readonly string[] | null): ValueSet {
  if (value === null) return EMPTY_SET;
  return typeof value === "string" ? new Set([value]) : new Set(value);
}

export function setsEqual(a: ValueSet, b: ValueSet): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/** A change to a set of values (conventions 2.2: the `added` / `removed` diff). */
export interface SetPatch {
  readonly added: readonly string[];
  readonly removed: readonly string[];
}

/** The optimistic reducer of a patch-based group: apply a patch, so stacked dispatches re-base. */
export function applyPatch(set: ValueSet, patch: SetPatch): ValueSet {
  const next = new Set(set);
  for (const v of patch.removed) next.delete(v);
  for (const v of patch.added) next.add(v);
  return next;
}

/**
 * `values` sorted by `order` (the Items' values in document order); values not in `order` keep
 * their iteration order, after the others.
 */
export function sortByOrder(values: Iterable<string>, order: readonly string[]): string[] {
  const wanted = new Set(values);
  const sorted: string[] = [];
  for (const v of order) if (wanted.delete(v)) sorted.push(v);
  for (const v of wanted) sorted.push(v);
  return sorted;
}

export function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** The first value that occurs twice in `values`, or `undefined`. */
export function firstDuplicate(values: readonly string[]): string | undefined {
  return values.find((v, i) => values.indexOf(v) !== i);
}

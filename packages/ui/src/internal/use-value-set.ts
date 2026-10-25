"use client";
import { useMemo } from "react";
import { toSet } from "./value-set.js";
import type { ValueSet } from "./value-set.js";

/**
 * A `value` / `defaultValue` prop of a set-valued component as a set, `undefined` when absent.
 *
 * The set's identity is stable while the prop has the same contents, so `useOptimistic` only
 * re-bases, and the context only changes, when the value really changed. Keyed on the contents,
 * not the array: an inline `value={["a"]}` is a new array on every render. (Order-sensitive; a
 * reordered array only costs one new set.)
 */
export function useValueSet(
  value: string | readonly string[] | null | undefined,
): ValueSet | undefined {
  const key = value === undefined ? undefined : JSON.stringify(value);
  return useMemo(
    () =>
      key === undefined ? undefined : toSet(JSON.parse(key) as string | readonly string[] | null),
    [key],
  );
}

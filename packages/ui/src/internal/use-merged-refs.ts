"use client";
import { useMemo } from "react";
import type { Ref } from "react";
import { mergeRefs } from "./merge-props.js";

/**
 * `mergeRefs` with a stable identity while every ref keeps its own. `undefined` entries are
 * dropped: a single remaining ref passes through unwrapped, none gives `undefined`. Call it with
 * the same number of arguments on every render.
 */
export function useMergedRefs<T>(...refs: readonly (Ref<T> | undefined)[]): Ref<T> | undefined {
  return useMemo(
    () => {
      const defined = refs.filter((ref) => ref !== undefined);
      return defined.length <= 1 ? defined[0] : mergeRefs(...defined);
    },
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- the refs themselves are the deps
    refs,
  );
}

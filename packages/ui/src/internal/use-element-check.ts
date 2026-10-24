"use client";
import { useCallback, useRef } from "react";
import type { DependencyList } from "react";
import { useLatest } from "./use-latest.js";

const isDev = process.env.NODE_ENV !== "production";

/** Runs the check on `element`; returns a no-op cleanup, so it is also a callback ref. */
export type ElementCheck<E extends Element> = (element: E) => () => void;

/**
 * A development check of the element a part mounted (a `render` element of the wrong kind, an
 * element in the wrong place): `message(element)` returns the warning, or `null` when the element
 * is fine. The first warning of an instance is logged with `console.error`; later ones are not.
 *
 * The result is a callback ref (merge it with the part's own) or a function to call from the
 * part's own ref (`check?.(element)`). Ref callbacks run in the layout phase, when the element's
 * siblings are in place. As a ref, `deps` re-run the check when they change (the callback is
 * re-created, as a `useCallback` ref would be). `undefined` in production.
 */
export function useElementCheck<E extends Element = HTMLElement>(
  message: (element: E) => string | null,
  deps: DependencyList = [],
): ElementCheck<E> | undefined {
  const warned = useRef(false);
  const latest = useLatest(message);
  const check = useCallback(
    (element: E) => {
      if (!warned.current) {
        const text = latest.current(element);
        if (text !== null) {
          warned.current = true;
          console.error(text);
        }
      }
      // A cleanup, so a merged ref is never called back with `null`.
      return () => {};
    },
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- `deps` decide when to re-check
    [latest, ...deps],
  );
  return isDev ? check : undefined;
}

"use client";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export interface PartPresence {
  /**
   * A part of this kind is mounted, as of this render. `true` until the owner's first commit:
   * the server render and the hydration render cannot know whether a part rendered after the
   * reader exists, so they keep the reference (field-form.md 4.2, "Referenced only while
   * mounted").
   */
  readonly present: boolean;
  /** Stable. Call from the part's layout effect (`useLayoutEffect(register, [register])`); returns the unregistration. */
  readonly register: () => () => void;
  /** How many parts are registered now, current before the re-render a registration scheduled (effects only). */
  readonly countRef: RefObject<number>;
}

/**
 * Tracks whether an optional part whose id another element references (an `aria-labelledby` /
 * `aria-describedby` token) is mounted, so the reference is never left dangling after the first
 * commit (#217). Unlike `useRegisterCount`, which starts at none, the part counts as present until
 * the owner has committed once: the server HTML carries the reference whenever the part may be
 * rendered, and the hydration render matches it. The owner's own layout effect, which runs after
 * its children's, then settles the real presence before the first paint, and every registration
 * or unregistration after it updates it. Only a change schedules a render.
 */
export function usePartPresence(): PartPresence {
  const countRef = useRef(0);
  const [present, setPresent] = useState(true);
  const sync = useCallback(() => {
    setPresent(countRef.current > 0);
  }, []);
  const register = useCallback(() => {
    countRef.current += 1;
    sync();
    return () => {
      countRef.current -= 1;
      sync();
    };
  }, [sync]);
  // The owner's first commit: every part rendered with it has registered by now.
  useLayoutEffect(sync, [sync]);
  return { present, register, countRef };
}

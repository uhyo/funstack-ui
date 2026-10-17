"use client";
import { useInsertionEffect, useRef } from "react";
import type { RefObject } from "react";

/**
 * A ref holding the value of the last **committed** render, for stable callbacks (handlers,
 * actions, effects) that must read the current props without changing identity on every render.
 *
 * Written in an insertion effect: it runs in the mutation phase, before every layout effect of
 * the same commit (a child's included), so a callback called from a layout effect of the commit
 * that changed the value already sees it. A render that never commits (a discarded concurrent or
 * StrictMode render) never writes it. Never read it during render.
 *
 * Stale window: the write happens in the owner's own insertion effect, and React runs a commit's
 * insertion effects children first, interleaved with that subtree's DOM mutations. So a callback
 * called before the owner's insertion effect of the commit that changed the value still sees the
 * previous commit's value: from a descendant's insertion effect, or from a DOM event the browser
 * fires synchronously during the mutation phase (Chromium fires `blur` / `focusout` when a
 * focused node is removed). This is the same value a per-render closure would have given (the
 * handler attached then was the previous commit's too), so it is not a regression; just do not
 * rely on the new value before the layout phase.
 */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useInsertionEffect(() => {
    ref.current = value;
  });
  return ref;
}

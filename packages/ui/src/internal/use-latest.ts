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
 */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useInsertionEffect(() => {
    ref.current = value;
  });
  return ref;
}

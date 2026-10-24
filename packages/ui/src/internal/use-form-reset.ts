"use client";
import type { RefObject } from "react";
import { useFormOwnerEvent } from "./use-form-owner-event.js";
import type { FormAssociatedElement } from "./use-form-owner-event.js";
import { useLatest } from "./use-latest.js";

/**
 * Stable `reset` subscription on the form owner of `ref.current` (conventions 3.8).
 *
 * - Built on `useFormOwnerEvent`, with its owner-following rules (rule 4).
 * - The `reset` event fires before the reset algorithm, so `onReset` is called in a microtask,
 *   when the inputs hold their reset values (rule 5), and only if no listener cancelled the reset
 *   (rule 7).
 * - `onReset` always sees the latest committed render's values.
 */
export function useFormReset(
  ref: RefObject<FormAssociatedElement | null>,
  onReset: (event: Event) => void,
  /**
   * Called synchronously from the `reset` event, before the reset algorithm runs: the last
   * moment to write a reset target the browser will restore (Combobox re-applies its mirrored
   * `defaultValue`, which react-dom's attribute syncing overwrites after every keystroke).
   */
  onResetEvent?: (event: Event) => void,
): void {
  // Read in the microtask, after the commit that may have run the reset (React's own reset runs
  // in a commit's mutation phase): the latest committed `onReset`.
  const latestOnReset = useLatest(onReset);
  useFormOwnerEvent(ref, "reset", (event) => {
    onResetEvent?.(event);
    queueMicrotask(() => {
      if (event.defaultPrevented) return;
      latestOnReset.current(event);
    });
  });
}

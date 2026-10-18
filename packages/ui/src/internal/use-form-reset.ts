"use client";
import type { RefObject } from "react";
import { useFormOwnerEvent } from "./use-form-owner-event.js";
import type { FormAssociatedElement } from "./use-form-owner-event.js";
import { useLatest } from "./use-latest.js";

export type { FormAssociatedElement } from "./use-form-owner-event.js";

/**
 * Stable `reset` subscription on the form owner of `ref.current` (conventions 3.8).
 *
 * - The owner (`element.form`, which honours the `form` attribute) is re-read after every commit,
 *   but the listener is moved only when the owner changed. It is never removed and re-added on an
 *   ordinary re-render: React's automatic reset after a successful `<form action>` runs in the
 *   commit's mutation phase, between an effect's cleanup and its next run, so a subscription that
 *   followed every commit would miss it (rule 4). Built on `useFormOwnerEvent`.
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

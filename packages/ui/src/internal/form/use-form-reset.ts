"use client";
import { useState } from "react";
import type { RefObject } from "react";
import { useFormOwnerEvent } from "./use-form-owner-event.js";
import type { FormAssociatedElement } from "./use-form-owner-event.js";
import { useLatest } from "../use-latest.js";

/**
 * Stable `reset` subscription on the form owner of `ref.current` (conventions 3.8).
 *
 * - Built on `useFormOwnerEvent`, with its owner-following rules (rule 4).
 * - The `reset` event fires before the reset algorithm, so `onReset` is called in a microtask,
 *   and only if no listener cancelled the reset (rule 7). **The inputs may still hold the
 *   user's values then**: after a script `form.reset()` (React's own reset included) the
 *   microtask runs after the algorithm, but after a click on a `<button type="reset">` the event
 *   is dispatched from a task and a microtask checkpoint follows each listener, so the microtask
 *   (and a synchronous React commit it causes) runs *before* the algorithm (#185). `onReset`
 *   therefore never reads a reset result from `.value` / `.checked`: it dispatches a target
 *   computed in JS (rule 6) or read from `defaultChecked` / `defaultValue` (rule 5), which hold
 *   the target before and after the algorithm alike.
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

/**
 * The form-reset target of a value prop by mode (conventions 3.8 rule 6): controlled
 * (`value !== undefined`), the value it had at mount; uncontrolled, the latest `defaultValue`.
 * `undefined` when that is absent: an uncontrolled Root with no `defaultValue`, or a Root that
 * became controlled after it mounted uncontrolled. The caller supplies its own fallback
 * (`?? null`, `?? value`, a platform default).
 */
export function useResetTarget<T>(
  value: T | undefined,
  defaultValue: T | undefined,
): T | undefined {
  const [mountValue] = useState(value);
  return value !== undefined ? mountValue : defaultValue;
}

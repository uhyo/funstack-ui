"use client";
import { useState } from "react";
import type { RefObject } from "react";
import { useFormOwnerEvent } from "./use-form-owner-event.js";
import { afterDispatch } from "../after-dispatch.js";
import { useLatest } from "../use-latest.js";

/**
 * Stable `reset` subscription on the form owner of `ref.current` (conventions 3.8).
 *
 * - Built on `useFormOwnerEvent`, with its owner-following rules (rule 4).
 * - `onReset` runs after every `reset` listener and after the reset algorithm, in both orders
 *   (rule 5): through `afterDispatch`, a microtask after a script `form.reset()` (React's own
 *   reset included), a task after a click on a `<button type="reset">`, whose microtask
 *   checkpoints run mid-dispatch. So it may read the DOM's reset state (validity, `FormData`,
 *   the selected option), and it is skipped when any listener cancelled the reset (rule 7).
 * - `onReset` always sees the latest committed render's values.
 */
export function useFormReset(
  /** A form-associated element (or one whose `form` the owner hook reads, as Field's control). */
  ref: RefObject<Element | null>,
  onReset: (event: Event) => void,
  /**
   * Called synchronously from the `reset` event, before the reset algorithm runs: the last
   * moment to write a reset target the browser will restore (Combobox re-applies its mirrored
   * `defaultValue`, which react-dom's attribute syncing overwrites after every keystroke).
   */
  onResetEvent?: (event: Event) => void,
): void {
  // Read when the callback is due, after the commit that may have run the reset (React's own
  // reset runs in a commit's mutation phase): the latest committed `onReset`.
  const latestOnReset = useLatest(onReset);
  useFormOwnerEvent(ref, "reset", (event) => {
    onResetEvent?.(event);
    afterDispatch(event, () => {
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

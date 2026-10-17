"use client";
import { useEffectEvent, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";

/** A form-associated element whose form owner the hook follows. */
export type FormAssociatedElement = HTMLInputElement | HTMLFieldSetElement | HTMLSelectElement;

interface Subscription {
  readonly form: HTMLFormElement;
  readonly listener: (event: Event) => void;
}

/**
 * Stable `reset` subscription on the form owner of `ref.current` (conventions 3.8).
 *
 * - The owner (`element.form`, which honours the `form` attribute) is re-read after every commit,
 *   but the listener is moved only when the owner changed. It is never removed and re-added on an
 *   ordinary re-render: React's automatic reset after a successful `<form action>` runs in the
 *   commit's mutation phase, between an effect's cleanup and its next run, so a subscription that
 *   followed every commit would miss it (rule 4).
 * - The `reset` event fires before the reset algorithm, so `onReset` is called in a microtask,
 *   when the inputs hold their reset values (rule 5), and only if no listener cancelled the reset
 *   (rule 7).
 * - `onReset` always sees the latest committed render's values (`useEffectEvent`).
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
  const handleReset = useEffectEvent((event: Event) => {
    onReset(event);
  });
  const handleResetEvent = useEffectEvent((event: Event) => {
    onResetEvent?.(event);
  });
  const subscription = useRef<Subscription | null>(null);

  // No deps on purpose: follows the form owner after every commit (a changed `form` attribute, the
  // element moved to another form), but re-subscribes only when the owner actually changed.
  useLayoutEffect(() => {
    const form = ref.current?.form ?? null;
    const current = subscription.current;
    if (current !== null && current.form === form) return;
    if (current !== null) current.form.removeEventListener("reset", current.listener);
    subscription.current = null;
    if (form === null) return;
    const listener = (event: Event) => {
      handleResetEvent(event);
      queueMicrotask(() => {
        if (event.defaultPrevented) return;
        handleReset(event);
      });
    };
    form.addEventListener("reset", listener);
    subscription.current = { form, listener };
  });

  // The only place the subscription is torn down: unmount (and StrictMode's simulated unmount,
  // after which the effect above subscribes again).
  useLayoutEffect(
    () => () => {
      const current = subscription.current;
      if (current !== null) current.form.removeEventListener("reset", current.listener);
      subscription.current = null;
    },
    [],
  );
}

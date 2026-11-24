"use client";
import { useEffectEvent, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";

/** A form-associated element whose form owner the hook follows. */
export type FormAssociatedElement =
  | HTMLInputElement
  | HTMLFieldSetElement
  | HTMLSelectElement
  | HTMLTextAreaElement;

interface Subscription {
  readonly form: HTMLFormElement;
  readonly listener: (event: Event) => void;
}

/**
 * Stable subscription to `type` on the form owner of `ref.current` (conventions 3.8 rule 4,
 * generalised for Field, design/components/field-form.md 14).
 *
 * - The owner (`element.form`, which honours the `form` attribute) is re-read after every commit,
 *   but the listener is moved only when the owner changed. It is never removed and re-added on an
 *   ordinary re-render: React's automatic reset after a successful `<form action>` runs in the
 *   commit's mutation phase, between an effect's cleanup and its next run, so a subscription that
 *   followed every commit would miss it.
 * - `handler` always sees the latest committed render's values (`useEffectEvent`).
 * - `ref.current` may be any element: one without a `form` property has no owner.
 */
export function useFormOwnerEvent(
  ref: RefObject<Element | null>,
  type: string,
  handler: (event: Event, form: HTMLFormElement) => void,
): void {
  const handle = useEffectEvent((event: Event, form: HTMLFormElement) => {
    handler(event, form);
  });
  const subscription = useRef<Subscription | null>(null);

  // No deps on purpose: follows the form owner after every commit (a changed `form` attribute, the
  // element moved to another form), but re-subscribes only when the owner actually changed.
  useLayoutEffect(() => {
    const element = ref.current as Partial<FormAssociatedElement> | null;
    const form = element?.form ?? null;
    const current = subscription.current;
    if (current !== null && current.form === form) return;
    if (current !== null) current.form.removeEventListener(type, current.listener);
    subscription.current = null;
    if (form === null) return;
    const listener = (event: Event) => handle(event, form);
    form.addEventListener(type, listener);
    subscription.current = { form, listener };
  });

  // The only place the subscription is torn down: unmount (and StrictMode's simulated unmount,
  // after which the effect above subscribes again).
  useLayoutEffect(
    () => () => {
      const current = subscription.current;
      if (current !== null) current.form.removeEventListener(type, current.listener);
      subscription.current = null;
    },
    [type],
  );
}

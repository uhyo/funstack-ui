"use client";
import { useEffectEvent, useLayoutEffect } from "react";
import type { RefObject } from "react";
import { useFormReset } from "./use-form-reset.js";

export interface UseNativeGroupReconciliationOptions<T> {
  /** The group's form-associated container (`RadioGroup.Root`'s `<fieldset>`). */
  readonly element: RefObject<HTMLFieldSetElement | null>;
  /** The group's value as the DOM shows it now (`checked` of the members). */
  readonly readCurrent: () => T;
  /** The value the browser resets the group to (`defaultChecked` of the members, rule 5). */
  readonly readDefault: () => T;
  /** What the user intends: `latestInFlight()?.next ?? optimistic` (rule 1). */
  readonly base: () => T;
  /**
   * The browser changed the group's value on a residual path and it differs from `base()`.
   * `event` is the `reset` event, or `undefined` for mount reconciliation. The Root dispatches
   * once for the whole group with `reason: "platform"`.
   */
  readonly onPlatformChange: (next: T, event: Event | undefined) => void;
}

/**
 * Group adapter of the native-input machinery (conventions 3.8): one dispatch per group for the
 * two residual browser paths, from the Root rather than once per member.
 *
 * - Mount reconciliation, once, in a layout effect: `readCurrent()` vs `base()`. The members'
 *   `useNativeChecked({ group: true })` leaves `checked` alone in the mount commit, so this effect,
 *   which runs after the members' (children first), still reads the hydrated DOM.
 * - Form reset through `useFormReset` on the container: in a microtask after the reset,
 *   `readDefault()` vs `base()`.
 *
 * Values are compared with `Object.is`.
 */
export function useNativeGroupReconciliation<T>(
  options: UseNativeGroupReconciliationOptions<T>,
): void {
  const { element } = options;

  function reconcile(next: T, event: Event | undefined): void {
    if (!Object.is(next, options.base())) options.onPlatformChange(next, event);
  }

  const reconcileMount = useEffectEvent(() => {
    if (element.current === null) return;
    reconcile(options.readCurrent(), undefined);
  });
  useLayoutEffect(() => {
    reconcileMount();
  }, []);

  useFormReset(element, (event) => {
    if (element.current === null) return;
    reconcile(options.readDefault(), event);
  });
}

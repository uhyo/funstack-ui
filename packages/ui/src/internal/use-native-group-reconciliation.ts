"use client";
import { useCallback, useEffectEvent, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import { useFormReset } from "./use-form-reset.js";
import type { FormAssociatedElement } from "./use-form-owner-event.js";
import { useLatest } from "./use-latest.js";

export interface UseNativeGroupReconciliationOptions<T> {
  /**
   * The group's form-associated element: `RadioGroup.Root`'s / `CheckboxGroup.Root`'s
   * `<fieldset>`, `Select.Root`'s `<select>` (whose options are the members), or any member
   * input when the Root renders no form-associated element (`Slider.Root` subscribes through its
   * first Thumb's `<input type="range">`).
   */
  readonly element: RefObject<FormAssociatedElement | null>;
  /** The group's value as the DOM shows it now (`checked` of the members). */
  readonly readCurrent: () => T;
  /** The value the browser resets the group to (`defaultChecked` of the members, rule 5). */
  readonly readDefault: () => T;
  /**
   * What the user intends (rule 1): the latest in-flight dispatch's `next`, else the optimistic
   * value. `intendedValue` (use-controllable-action.ts) keeps an in-flight dispatch of a nullish
   * value (a pending reset to "nothing checked"), which `?.next ?? optimistic` would drop.
   */
  readonly base: () => T;
  /**
   * The browser changed the group's value on a residual path and it differs from `base()`.
   * `event` is the `reset` event, or `undefined` for mount reconciliation (the Root's mount, or a
   * member mounting later). The Root dispatches once for the whole group with
   * `reason: "platform"`.
   */
  readonly onPlatformChange: (next: T, event: Event | undefined) => void;
  /**
   * Equality between a read value and `base()`. Default `Object.is`, right for a primitive value
   * (RadioGroup's `string | null`); a group with a collection value (CheckboxGroup's
   * `ReadonlySet<string>`) passes structural equality, since every read builds a new object.
   */
  readonly equals?: ((a: T, b: T) => boolean) | undefined;
  /**
   * Passed through to `useFormReset`: called synchronously from the `reset` event, before the
   * reset algorithm runs. A group of controlled **value** inputs (Slider) writes each input's
   * `defaultValue` to the reset target here, because react-dom keeps that attribute equal to the
   * current value after every update (conventions 3.8 rule 6).
   */
  readonly onResetEvent?: ((event: Event) => void) | undefined;
}

export interface UseNativeGroupReconciliationResult {
  /**
   * Stable. Pass it to every member, which hands it to
   * `useNativeChecked({ group: true, onItemMounted })`; the hook calls it from the member's mount
   * layout effect. A member that mounts after the Root's own mount reconciliation (inside a
   * Suspense boundary that hydrates later, selective hydration, or a member added on the client)
   * makes the adapter reconcile the group again: `readCurrent()` vs `base()`, in a microtask, once
   * for all members mounted in the same commit. Members mounting in the Root's own commit are
   * covered by the Root's mount reconciliation (their effects run before the Root's) and are
   * ignored. The member's element argument is not used here; the Root may use it (dev warnings).
   */
  readonly onItemMounted: (element?: Element | null) => void;
}

/**
 * Group adapter of the native-input machinery (conventions 3.8): one dispatch per group for the
 * residual browser paths, from the Root rather than once per member.
 *
 * - Mount reconciliation, once, in a layout effect: `readCurrent()` vs `base()`. The members'
 *   `useNativeChecked({ group: true })` leaves `checked` alone in their mount commit, so this
 *   effect, which runs after the members' (children first), still reads the hydrated DOM.
 * - Late members: a member mounting in a later commit (a Suspense boundary that hydrates after the
 *   Root, where a click before hydration changed the DOM) reports through `onItemMounted`, and the
 *   group is reconciled again the same way (see `UseNativeGroupReconciliationResult`).
 * - Form reset through `useFormReset` on the container: in a microtask after the reset,
 *   `readDefault()` vs `base()`.
 *
 * Values are compared with `equals` (default `Object.is`).
 */
export function useNativeGroupReconciliation<T>(
  options: UseNativeGroupReconciliationOptions<T>,
): UseNativeGroupReconciliationResult {
  const { element } = options;

  // The latest committed options, for the late reconciliation, which runs in a microtask outside
  // any effect (so it cannot go through an Effect Event).
  const latest = useLatest(options);

  /** The Root's own mount reconciliation has run (reset by its cleanup, StrictMode included). */
  const rootReconciled = useRef(false);
  /** A late reconciliation is queued; members mounting in the same commit share it. */
  const lateQueued = useRef(false);

  const reconcileMount = useEffectEvent(() => {
    if (element.current === null) return;
    reconcile(options, options.readCurrent());
  });
  useLayoutEffect(() => {
    reconcileMount();
    rootReconciled.current = true;
    return () => {
      rootReconciled.current = false;
    };
  }, []);

  const onItemMounted = useCallback(() => {
    if (!rootReconciled.current || lateQueued.current) return;
    lateQueued.current = true;
    queueMicrotask(() => {
      lateQueued.current = false;
      if (!rootReconciled.current) return;
      const current = latest.current;
      if (current.element.current === null) return;
      reconcile(current, current.readCurrent());
    });
  }, [latest]);

  useFormReset(
    element,
    (event) => {
      if (element.current === null) return;
      reconcile(options, options.readDefault(), event);
    },
    (event) => {
      if (element.current === null) return;
      options.onResetEvent?.(event);
    },
  );

  return { onItemMounted };
}

function reconcile<T>(options: UseNativeGroupReconciliationOptions<T>, next: T, event?: Event) {
  const equals = options.equals ?? Object.is;
  if (!equals(next, options.base())) options.onPlatformChange(next, event);
}

"use client";
import { useCallback, useEffectEvent, useLayoutEffect, useRef } from "react";
import type { RefCallback } from "react";
import { useFormReset } from "./use-form-reset.js";

const isDev = process.env.NODE_ENV !== "production";

export interface UseNativeCheckedOptions {
  /** Dev-only: the expected `input.type`. */
  readonly type: "checkbox" | "radio";
  /** Dev-only: the part's name in warnings (`"Switch"`, `"RadioGroup.Item"`). */
  readonly component: string;
  /** What the DOM must show after every commit: the optimistic value. */
  readonly checked: boolean;
  /**
   * The form-reset target. Uncontrolled parts pass the latest `defaultChecked` prop (`?? false`),
   * mirrored into `el.defaultChecked` after every commit. Controlled parts pass `undefined`:
   * React's mount-time value stays (conventions 3.8 rule 6).
   */
  readonly defaultChecked: boolean | undefined;
  /** Checkbox only: `el.indeterminate` after every commit (the part passes `indeterminate && !pending`). */
  readonly indeterminate?: boolean | undefined;
  /**
   * `true` inside a group (`RadioGroup.Item`): the hook does the element check and the re-apply
   * only; mount reconciliation and form reset are reported once per group by the Root through
   * `useNativeGroupReconciliation`. Default `false`: the hook reports both paths itself.
   */
  readonly group?: boolean | undefined;
  /**
   * Group members only: the Root's `onItemMounted` from `useNativeGroupReconciliation`. Called
   * from this member's mount layout effect so that a member mounting after the Root (a Suspense
   * boundary that hydrates later) still gets the group reconciled. Ignored without `group`.
   */
  readonly onItemMounted?: (() => void) | undefined;
  /** From `useControllableAction`: the value the DOM is compared against on the residual paths. */
  readonly latestInFlight?: (() => { readonly next: boolean } | null) | undefined;
  /**
   * Single controls only. The browser changed the value on a residual path and it differs from
   * what the user intends. `event` is the `reset` event, or `undefined` for mount reconciliation.
   * The part dispatches with `reason: "platform"`.
   */
  readonly onPlatformChange?: ((next: boolean, event: Event | undefined) => void) | undefined;
}

/**
 * Per-element machinery for a controlled native `<input type="checkbox" | "radio">`
 * (conventions 3.8): returns the ref to attach to the input (merged by `useRender`).
 *
 * 1. Ref callback: stores the node; in development warns once when it is not an `<input>` of
 *    the expected `type`.
 * 2. Mount reconciliation (single controls): a click before hydration or Firefox's form-state
 *    restoration left the DOM different from what the user intends; reported once with
 *    `event: undefined`.
 * 3. Re-apply after every commit: `checked` (optimistic, or the latest in-flight value),
 *    `indeterminate` and `defaultChecked`, none of which React manages for a controlled input
 *    except `checked`.
 * 4. Form reset (single controls): in a microtask after the reset, compares `el.defaultChecked`
 *    with what the user intends and reports a difference with the `reset` event.
 *
 * The hook knows nothing about transitions or `reason`; the part wires `onPlatformChange`.
 */
export function useNativeChecked(options: UseNativeCheckedOptions): RefCallback<HTMLInputElement> {
  const { type, component, checked, defaultChecked, indeterminate, group = false } = options;
  const node = useRef<HTMLInputElement | null>(null);
  const warnedElement = useRef(false);

  const ref = useCallback(
    (el: HTMLInputElement) => {
      node.current = el;
      if (isDev && !warnedElement.current && !isInputOfType(el, type)) {
        warnedElement.current = true;
        console.error(
          `${component}: expected to render an \`<input type="${type}">\` but got ` +
            `${describeElement(el)}; the platform semantics (form participation, labels, ` +
            `keyboard, reset) need a real input. A \`render\` element must keep the input.`,
        );
      }
      return () => {
        node.current = null;
      };
    },
    [type, component],
  );

  /** What the user intends: the latest in-flight dispatch, else the optimistic value (rule 1). */
  const readBase = useEffectEvent(() => options.latestInFlight?.()?.next ?? checked);
  const report = useEffectEvent((next: boolean, event: Event | undefined) => {
    options.onPlatformChange?.(next, event);
  });

  // 2. Mount reconciliation. Declared before the re-apply effect so that the hydrated DOM value is
  //    read before anything overwrites it (rule 3). StrictMode's second run finds the first run's
  //    dispatch in flight and does nothing.
  const reconcileMount = useEffectEvent(() => {
    if (group) return;
    const el = node.current;
    if (el === null) return;
    if (el.checked !== readBase()) report(el.checked, undefined);
  });
  useLayoutEffect(() => {
    reconcileMount();
  }, []);

  // 2b. Group members tell the Root they mounted; the Root reconciles the group again if its own
  //     mount reconciliation already ran (a member mounting later), which covers the `checked`
  //     write this member skips in its mount commit (below).
  const notifyMounted = useEffectEvent(() => {
    if (group) options.onItemMounted?.();
  });
  useLayoutEffect(() => {
    notifyMounted();
  }, []);

  // 3. Re-apply after every commit (rule 8). `checked` is skipped in the mount commit (including
  //    StrictMode's re-run of it, which closes over the same render): React has just written it
  //    from the prop, or kept the hydrated DOM value for the residual path to read. That matters
  //    for groups, whose Root reconciles in its own layout effect, after its Items' effects.
  const renderToken = {};
  const mountToken = useRef<object | null>(null);
  useLayoutEffect(() => {
    if (mountToken.current === null) mountToken.current = renderToken;
    const el = node.current;
    if (el === null) return;
    // The order defaultChecked -> checked -> indeterminate is load-bearing for the first two.
    // React's automatic reset after a <form action> runs in the mutation phase, after react-dom
    // wrote `checked` and before this effect, and clears the dirty-checkedness flag; writing
    // `defaultChecked` (a new default from the same transition) then moves `checked` too, and the
    // `checked` write that follows restores the intended value. The other way round, the `checked`
    // write is skipped (it still matches) and the DOM ends up on the new default.
    // `indeterminate` is independent of both writes and goes last. Tested in
    // use-native-checked.test.tsx ("re-apply order").
    if (defaultChecked !== undefined && el.defaultChecked !== defaultChecked) {
      el.defaultChecked = defaultChecked;
    }
    if (mountToken.current !== renderToken) {
      const want = readBase();
      if (el.checked !== want) el.checked = want;
    }
    if (indeterminate !== undefined && el.indeterminate !== indeterminate) {
      el.indeterminate = indeterminate;
    }
  });

  // 4. Form reset (rules 4 to 7). `el.defaultChecked` is the value the browser reset to; by the
  //    time the microtask runs after React's own reset, the re-apply effect may already have put
  //    the optimistic value back into `checked`. (`useFormReset` already calls this through an
  //    Effect Event, so it reads the latest render's options directly.)
  useFormReset(node, (event) => {
    if (group) return;
    const el = node.current;
    if (el === null) return;
    const next = el.defaultChecked;
    const base = options.latestInFlight?.()?.next ?? checked;
    if (next !== base) options.onPlatformChange?.(next, event);
    else if (el.checked !== base) el.checked = base;
  });

  return ref;
}

function isInputOfType(el: Element, type: string): boolean {
  return el.tagName === "INPUT" && (el as HTMLInputElement).type === type;
}

function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase();
  return tag === "input" ? `\`<input type="${(el as HTMLInputElement).type}">\`` : `\`<${tag}>\``;
}

const warnedPreventDefault = new WeakSet<EventTarget>();

/**
 * Shared `onChange` guard for checkable inputs (conventions 3.8 rule 9, 2.3 item 3):
 *
 * - A click that is already cancelled (`preventDefault()` in a pass-through `onClick`, which runs
 *   before the library's `onChange`) is not a change: the browser reverts the DOM after dispatch
 *   and React restores unchanged props. Nothing is dispatched.
 * - Otherwise `dispatch()` runs (the action's sync prefix included); if the event is cancelled
 *   now, the action's sync prefix called `preventDefault()`, which desyncs the input while the
 *   action is pending. Development warns once per input element.
 */
export function guardCheckableChange(
  event: Event,
  dispatch: () => void,
  component: string = "A checkable input",
): void {
  if (event.defaultPrevented) return;
  dispatch();
  if (!isDev || !event.defaultPrevented) return;
  const target = event.target;
  if (target !== null) {
    if (warnedPreventDefault.has(target)) return;
    warnedPreventDefault.add(target);
  }
  console.error(
    `${component}: \`preventDefault()\` on the change event is not supported; it desyncs the ` +
      `input while the action is pending. Use controlled mode to veto a change.`,
  );
}

"use client";
import { useCallback, useEffectEvent, useLayoutEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { useLatest } from "./use-latest.js";
import { useNativeGroupReconciliation } from "./use-native-group-reconciliation.js";

export interface UseNativeSelectValueOptions {
  /** The `<select>`. */
  readonly ref: RefObject<HTMLSelectElement | null>;
  /** The optimistic value (what the `<select>` renders). */
  readonly optimistic: string;
  /** From `useControllableAction`: the latest in-flight dispatch, if any. */
  readonly latestInFlight: () => { readonly next: string } | null;
  /**
   * The value a form reset must return to, mirrored into `option.defaultSelected` after every
   * commit: uncontrolled, the latest `defaultValue`; controlled, the Root's mount-time value.
   * Ignored in adopt mode (`adoptDefault` set), where the target is the value adopted at mount.
   */
  readonly resetTarget: string | undefined;
  /**
   * Uncontrolled without `defaultValue` (design/components/select.md 5): adopts the browser's
   * choice as the committed value, without a dispatch. `undefined` in every other mode.
   */
  readonly adoptDefault: AdoptDefault | undefined;
  /**
   * The browser changed the value on a residual path (pre-hydration pick, Firefox form-state
   * restoration, a late hydrated option, a form reset) and it differs from what the user intends.
   * `event` is the `reset` event or `undefined`. The Root dispatches once with
   * `reason: "platform"`.
   */
  readonly onPlatformChange: (next: string, event: Event | undefined) => void;
}

export interface AdoptDefault {
  /** `adopt` of `useControllableAction`: writes the committed value, no action. */
  readonly adopt: (next: string) => void;
  /**
   * A dispatch (a pick or a platform change) has set the value. From then on the browser's
   * default is never adopted again: late options only get the re-apply, so options that suspend
   * again (a keyed boundary, a refetch) and come back keep the user's value.
   */
  readonly established: () => boolean;
}

export interface UseNativeSelectValueResult {
  /**
   * Stable. Each `Select.Option` calls it from its mount layout effect with its element and
   * whether that render hydrated server HTML (`useHydratedMount`). Reports from the Root's own
   * commit are ignored (the Root's effects cover them). A later report re-applies the intended
   * option (React never selects options mounted after the select's own commit); a hydrated one
   * is also reconciled, from a DOM snapshot taken before the re-apply.
   */
  readonly optionMounted: (el: HTMLOptionElement | null, hydrated: boolean) => void;
}

/** The first option whose value is `value` (react-dom's `updateOptions` selects the first). */
export function findOption(select: HTMLSelectElement, value: string): HTMLOptionElement | null {
  for (const option of select.options) {
    if (option.value === value) return option;
  }
  return null;
}

function isEnabled(option: HTMLOptionElement): boolean {
  if (option.disabled) return false;
  const parent = option.parentElement;
  return !(parent?.tagName === "OPTGROUP" && (parent as HTMLOptGroupElement).disabled);
}

function firstEnabled(select: HTMLSelectElement): string {
  for (const option of select.options) {
    if (isEnabled(option)) return option.value;
  }
  return "";
}

/**
 * The spec's reset result for a single select: the last option whose `defaultSelected` is true,
 * else the first enabled option, else `""` (nothing selected).
 */
export function readResetValue(select: HTMLSelectElement): string {
  let last: HTMLOptionElement | null = null;
  for (const option of select.options) {
    if (option.defaultSelected) last = option;
  }
  return last !== null ? last.value : firstEnabled(select);
}

/**
 * The option a `<select>` rendered with the value `""` selects: an option whose value is `""`
 * (react-dom's `updateOptions("")` and Fizz's `selected` attribute both pick it, even when it is
 * disabled), else the first enabled option (the selectedness setting algorithm), else `""`.
 */
export function implicitDefault(select: HTMLSelectElement): string {
  return findOption(select, "") !== null ? "" : firstEnabled(select);
}

/**
 * The reset-target mirror followed by the re-apply, in one synchronous step
 * (design/components/select.md 6.1). Writing `defaultSelected = true` on an option whose
 * dirtiness is false selects it, so the intended option is re-selected right after. Writes only
 * what differs: the common commit writes nothing.
 */
export function applySelection(
  select: HTMLSelectElement,
  target: string,
  resetTarget: string | undefined,
): void {
  if (resetTarget !== undefined) {
    // Only the first match, the option react-dom would select for that value.
    const def = findOption(select, resetTarget);
    for (const option of select.options) {
      const want = option === def;
      if (option.defaultSelected !== want) option.defaultSelected = want;
    }
  }
  const option = findOption(select, target);
  if (option !== null && !option.selected) option.selected = true;
}

interface Snapshot {
  readonly value: string;
  readonly index: number;
}

const read = (select: HTMLSelectElement): Snapshot => ({
  value: select.value,
  index: select.selectedIndex,
});

/**
 * Native-`<select>` machinery for `Select.Root` (conventions 3.8, the select analogue of
 * `useNativeChecked`), on top of `useNativeGroupReconciliation`:
 *
 * 1. Adoption (uncontrolled without `defaultValue`): at mount the browser's default becomes the
 *    committed value with no dispatch, and the mount reconciliation compares against it, so a
 *    pre-hydration pick of another option still dispatches. It is also the reset target (the
 *    value Fizz marks `selected` when it comes from a `""` option). While no dispatch has set
 *    the value, late options mounting without the state's option adopt again (loading).
 * 2. Mount reconciliation and form reset through the group adapter: one dispatch per Select, and
 *    only when the intended option exists in the DOM (a value whose option is still loading is
 *    never "reconciled" to the fallback).
 * 3. After every Root commit: the reset-target mirror, then the re-apply of the intended option.
 * 4. Late options: the same, once per commit; a hydrated late option is also reconciled, from a
 *    snapshot of the selection taken before the re-apply.
 */
export function useNativeSelectValue(
  options: UseNativeSelectValueOptions,
): UseNativeSelectValueResult {
  const { ref: elementRef } = options;
  // A `render` element that is not a <select> (dev warning in the Root) gets no DOM work.
  const ref = useMemo(
    () => ({
      get current(): HTMLSelectElement | null {
        const el = elementRef.current;
        // Tag, not `instanceof`: the element may come from another realm (an iframe).
        return el?.tagName === "SELECT" ? (el as HTMLSelectElement) : null;
      },
    }),
    [elementRef],
  );

  // The latest committed options. Written in the mutation phase (`useLatest`), so an Option's
  // mount layout effect, which runs before this Root's layout effects, already reads this commit's.
  const latest = useLatest(options);

  /**
   * A default adopted in this layout phase. Until the adoption's render (a sync update, flushed
   * right after this commit) the state still says the old value, so this is what the user
   * intends unless a dispatch is in flight. Cleared in a microtask, after that render.
   */
  const adopted = useRef<string | null>(null);
  const intended = (o: UseNativeSelectValueOptions): string => {
    const f = o.latestInFlight();
    if (f !== null) return f.next;
    return adopted.current ?? o.optimistic;
  };

  const adoptNow = (value: string, adopt: (next: string) => void) => {
    adopted.current = value;
    adopt(value);
    queueMicrotask(() => {
      adopted.current = null;
    });
  };

  /** Adopt mode: the value adopted at mount, the reset target (as the mount value is, controlled). */
  const mountAdopted = useRef<string | undefined>(undefined);
  const resetTargetOf = (o: UseNativeSelectValueOptions): string | undefined =>
    o.adoptDefault !== undefined ? mountAdopted.current : o.resetTarget;

  /** The selection read in the layout phase of a late-option commit (conventions 3.8 rule 3). */
  const lateSnapshot = useRef<Snapshot | null>(null);

  // 1. Adoption at mount. Declared before the adapter so that its mount reconciliation compares
  //    the DOM against the adopted default.
  const adoptAtMount = useEffectEvent(() => {
    const select = ref.current;
    const adoptDefault = options.adoptDefault;
    // `established`: StrictMode's re-run after a mount reconciliation already dispatched.
    if (select === null || adoptDefault === undefined || adoptDefault.established()) return;
    const value = implicitDefault(select);
    // `""` from a select with nothing selectable is no reset target (design 6.1): only a `""`
    // option, the placeholder react-dom and Fizz select, is mirrored.
    mountAdopted.current = value === "" && findOption(select, "") === null ? undefined : value;
    adoptNow(value, adoptDefault.adopt);
  });
  useLayoutEffect(() => {
    adoptAtMount();
  }, []);

  // 2. Residual paths: one dispatch per Select.
  const { onItemMounted } = useNativeGroupReconciliation<string>({
    element: ref,
    readCurrent: () => {
      const select = ref.current;
      const snapshot = lateSnapshot.current;
      lateSnapshot.current = null;
      const base = intended(latest.current);
      if (select === null) return base;
      const current = snapshot ?? read(select);
      // The dispatch gate: nothing selected, or the intended option absent, is not a pick.
      if (current.index === -1 || findOption(select, base) === null) return base;
      return current.value;
    },
    readDefault: () => {
      const select = ref.current;
      return select === null ? intended(latest.current) : readResetValue(select);
    },
    base: () => intended(latest.current),
    onPlatformChange: (next, event) => latest.current.onPlatformChange(next, event),
  });

  // 3. After every commit. Declared after the adapter, so the mount commit's DOM is read by the
  //    mount reconciliation before anything is re-applied.
  useLayoutEffect(() => {
    const select = ref.current;
    if (select === null) return;
    applySelection(select, intended(options), resetTargetOf(options));
  });

  /** The Root's own mount effects have run: later Option mounts are late. */
  const rootMounted = useRef(false);
  useLayoutEffect(() => {
    rootMounted.current = true;
    return () => {
      rootMounted.current = false;
    };
  }, []);
  /**
   * This commit's late options were handled (snapshot, adoption, re-apply). A microtask window,
   * not a per-commit flag: an Option's layout effect cannot tell which commit it belongs to (the
   * Root does not commit with a boundary that resolves inside it). A second commit in the same
   * task is covered by the per-report re-apply below; its hydrated options are reconciled against
   * the first commit's snapshot (theoretical: no part triggers such a commit).
   */
  const lateHandled = useRef(false);

  // 4. Late options.
  const optionMounted = useCallback(
    (el: HTMLOptionElement | null, hydrated: boolean) => {
      if (!rootMounted.current) return;
      const select = ref.current;
      if (select === null) return;
      if (!lateHandled.current) {
        lateHandled.current = true;
        // Every option of this commit is in the DOM already (the mutation phase precedes layout).
        lateSnapshot.current = read(select);
        const current = latest.current;
        const adoptDefault = current.adoptDefault;
        if (
          adoptDefault !== undefined &&
          !adoptDefault.established() &&
          current.latestInFlight() === null &&
          findOption(select, intended(current)) === null
        ) {
          // Still loading and nothing chosen yet (the fallback-only case): adopt the browser's
          // default. Never after a dispatch: that would overwrite the user's value silently.
          adoptNow(implicitDefault(select), adoptDefault.adopt);
        }
        applySelection(select, intended(current), resetTargetOf(current));
        // Cleared after the adapter's microtask, which a later report of this same commit may
        // queue after this point: two hops keep the snapshot for it.
        queueMicrotask(() =>
          queueMicrotask(() => {
            lateHandled.current = false;
            lateSnapshot.current = null;
          }),
        );
      } else if (el !== null) {
        // Per report, for an option that matters (cheap: at most the intended and the reset
        // target's options): a second commit within the window gets its re-apply too.
        const current = latest.current;
        if (el.value === intended(current) || el.value === resetTargetOf(current)) {
          applySelection(select, intended(current), resetTargetOf(current));
        }
      }
      if (hydrated) onItemMounted(el);
    },
    [ref, latest, onItemMounted],
  );

  return { optionMounted };
}

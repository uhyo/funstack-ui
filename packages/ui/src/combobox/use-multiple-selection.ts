"use client";
import { useMemo, useRef } from "react";
import { createActionDetails } from "../internal/action/action-details.js";
import {
  intendedValue,
  useControllableAction,
} from "../internal/action/use-controllable-action.js";
import { transitionTypes } from "../internal/transition-types.js";
import type { ChangeAction, ChangeReason } from "../internal/types.js";
import { useValueSet } from "../internal/use-value-set.js";
import { applyPatch, EMPTY_SET, setsEqual } from "../internal/value-set.js";
import type { SetPatch, ValueSet } from "../internal/value-set.js";
import type { ComboboxMultipleValueChangeDetails } from "./combobox-root.js";

export interface MultipleSelectionOptions {
  /** `multiple` at mount: when `false` the hook is idle (no value, no action). */
  readonly enabled: boolean;
  readonly value: readonly string[] | undefined;
  readonly defaultValue: readonly string[] | undefined;
  readonly valueChangeAction:
    | ChangeAction<string[], ComboboxMultipleValueChangeDetails>
    | undefined;
}

export interface MultipleSelection {
  /** The optimistic selection, insertion-ordered: the chip order (design 15.2). */
  readonly optimistic: ValueSet;
  readonly committed: ValueSet;
  /** `optimistic` as a list, stable while its contents are. */
  readonly values: readonly string[];
  /** The value action is in flight. */
  readonly pending: boolean;
  /**
   * One user change on top of the optimistic selection (design 15.3, 15.4). Parts of the patch
   * that change nothing are dropped; nothing is dispatched for an empty patch. Returns whether it
   * dispatched.
   */
  readonly change: (
    patch: SetPatch,
    fields: { readonly reason: ChangeReason; readonly custom: boolean },
    event: Event | undefined,
  ) => boolean;
  /** A form reset to `target` (design 15.4, 15.8): absolute, `"platform"`. */
  readonly reset: (target: ValueSet, event: Event) => void;
}

/**
 * The selection of `Combobox.Root multiple` (design/components/combobox.md 15.4): a set-valued
 * owner under the shared rules (conventions 2.2, 2.5, 3.3), with CheckboxGroup's machinery. The
 * patch reducer re-bases stacked optimistic changes and replays the resolved ones in dispatch
 * order; a form reset is the one absolute dispatch. The order is the value's own (a JS `Set`
 * keeps insertion order): the order of `value` / `defaultValue`, then the picks, appended.
 *
 * Always called by the Root (hooks are unconditional); with `enabled: false` it receives no
 * props and never dispatches.
 */
export function useMultipleSelection({
  enabled,
  value,
  defaultValue,
  valueChangeAction,
}: MultipleSelectionOptions): MultipleSelection {
  const controlledSet = useValueSet(enabled ? value : undefined);
  const defaultSet = useValueSet(enabled ? defaultValue : undefined);

  const { optimistic, committed, pending, dispatch, latestInFlight } = useControllableAction<
    ValueSet,
    ComboboxMultipleValueChangeDetails
  >({
    controlled: controlledSet,
    defaultValue: defaultSet,
    initialValue: EMPTY_SET,
    action:
      enabled && valueChangeAction
        ? (next, details) => valueChangeAction([...next], details)
        : undefined,
    transitionTypes: (_next, _prev, details) => [
      ...transitionTypes("combobox"),
      ...(details.added.length > 0 ? ["fsui-combobox-select"] : []),
      ...(details.removed.length > 0 ? ["fsui-combobox-deselect"] : []),
    ],
    // A patch, re-based on the committed set; also how the uncontrolled commit is folded over
    // the resolved dispatches (#150). A form reset is dispatched `whole` and bypasses it.
    reducer: (prev, _next, details) => applyPatch(prev, details),
    warn: { component: "Combobox.Root", prop: "value" },
  });

  const key = JSON.stringify([...optimistic]);
  const values = useMemo(() => JSON.parse(key) as string[], [key]);

  /** The latest dispatch was a form reset (CheckboxGroup #151). */
  const latestIsReset = useRef(false);

  const change: MultipleSelection["change"] = (patch, fields, event) => {
    const added = patch.added.filter((v, i) => !optimistic.has(v) && patch.added.indexOf(v) === i);
    const removed = patch.removed.filter((v) => optimistic.has(v));
    if (added.length === 0 && removed.length === 0) return false;
    // `removed` in value order (design 15.2).
    const ordered = [...optimistic].filter((v) => removed.includes(v));
    const details = createActionDetails(event, {
      reason: fields.reason,
      added,
      removed: ordered,
      custom: fields.custom,
    });
    latestIsReset.current = false;
    dispatch(applyPatch(optimistic, details), details);
    return true;
  };

  const reset: MultipleSelection["reset"] = (target, event) => {
    const from = intendedValue(latestInFlight, optimistic);
    // While a change is in flight the reset is dispatched even when it equals the intended
    // value: the replay applies it absolutely, so an earlier change that rejects later cannot
    // roll the selection back past the reset (conventions 3.3, last rule). Controlled: the
    // parent decides, no replay.
    const equal = setsEqual(from, target);
    if (
      equal &&
      !(controlledSet === undefined && latestInFlight() !== null && !latestIsReset.current)
    ) {
      return;
    }
    const details = createActionDetails(event, {
      reason: "platform" as const,
      added: [...target].filter((v) => !from.has(v)),
      removed: [...from].filter((v) => !target.has(v)),
      custom: false,
    });
    latestIsReset.current = true;
    dispatch(new Set(target), details, { whole: true });
  };

  return { optimistic, committed, values, pending, change, reset };
}

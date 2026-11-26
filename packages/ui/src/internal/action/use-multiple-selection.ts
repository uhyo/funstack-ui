"use client";
import { useMemo, useRef } from "react";
import { createActionDetails } from "./action-details.js";
import { intendedValue, useControllableAction } from "./use-controllable-action.js";
import { transitionTypes } from "../transition-types.js";
import type { ActionDetails, ChangeAction, ChangeReason } from "../types.js";
import { useValueSet } from "../use-value-set.js";
import { applyPatch, EMPTY_SET, setsEqual } from "../value-set.js";
import type { SetPatch, ValueSet } from "../value-set.js";

/**
 * The details of a set-valued listbox selection (Combobox `multiple`, MultiSelect): the reason,
 * the diff, and the component's own fields (`Extra`; Combobox: `custom`).
 */
export type MultipleSelectionDetails<Extra extends object> = ActionDetails & {
  readonly reason: ChangeReason;
  /** Values this dispatch added, in the order they join the value. */
  readonly added: readonly string[];
  /** Values this dispatch removed, in value order. */
  readonly removed: readonly string[];
} & Readonly<Extra>;

export interface MultipleSelectionOptions<Extra extends object> {
  /** The transition-type stem (`"combobox"` gives `fsui-combobox`, `fsui-combobox-select`, …). */
  readonly component: string;
  /** Public name of the Root for the development warnings (`"Combobox.Root"`). */
  readonly part: string;
  /** `false`: the hook is idle (no value, no action); Combobox in single mode. */
  readonly enabled: boolean;
  readonly value: readonly string[] | undefined;
  readonly defaultValue: readonly string[] | undefined;
  readonly valueChangeAction: ChangeAction<string[], MultipleSelectionDetails<Extra>> | undefined;
  /** The component's own fields of a form reset's details (Combobox: `{ custom: false }`). */
  readonly resetFields: Extra;
}

export interface MultipleSelection<Extra extends object> {
  /** The optimistic selection, insertion-ordered: the pick order (combobox.md 15.2). */
  readonly optimistic: ValueSet;
  readonly committed: ValueSet;
  /** `optimistic` as a list, stable while its contents are. */
  readonly values: readonly string[];
  /** The value action is in flight. */
  readonly pending: boolean;
  /**
   * One user change on top of the optimistic selection (combobox.md 15.3, 15.4). Parts of the
   * patch that change nothing are dropped; nothing is dispatched for an empty patch. Returns
   * whether it dispatched.
   */
  readonly change: (
    patch: SetPatch,
    fields: { readonly reason: ChangeReason } & Extra,
    event: Event | undefined,
  ) => boolean;
  /** A form reset to `target` (combobox.md 15.4, 15.8): absolute, `"platform"`. */
  readonly reset: (target: ValueSet, event: Event) => void;
}

/**
 * The set-valued selection of a listbox component, `Combobox.Root multiple` and
 * `MultiSelect.Root` (design/components/combobox.md 15.4, multi-select.md B.6): a set-valued
 * owner under the shared rules (conventions 2.2, 2.5, 3.3), with CheckboxGroup's machinery. The
 * patch reducer re-bases stacked optimistic changes and replays the resolved ones in dispatch
 * order; a form reset is the one absolute dispatch. The order is the value's own (a JS `Set`
 * keeps insertion order): the order of `value` / `defaultValue`, then the picks, appended.
 *
 * Always called by the Root (hooks are unconditional); with `enabled: false` it receives no
 * props and never dispatches.
 */
export function useMultipleSelection<Extra extends object>({
  component,
  part,
  enabled,
  value,
  defaultValue,
  valueChangeAction,
  resetFields,
}: MultipleSelectionOptions<Extra>): MultipleSelection<Extra> {
  type Details = MultipleSelectionDetails<Extra>;
  const controlledSet = useValueSet(enabled ? value : undefined);
  const defaultSet = useValueSet(enabled ? defaultValue : undefined);

  const { optimistic, committed, pending, dispatch, latestInFlight } = useControllableAction<
    ValueSet,
    Details
  >({
    controlled: controlledSet,
    defaultValue: defaultSet,
    initialValue: EMPTY_SET,
    action:
      enabled && valueChangeAction
        ? (next, details) => valueChangeAction([...next], details)
        : undefined,
    transitionTypes: (_next, _prev, details) => [
      ...transitionTypes(component),
      ...(details.added.length > 0 ? [`fsui-${component}-select`] : []),
      ...(details.removed.length > 0 ? [`fsui-${component}-deselect`] : []),
    ],
    // A patch, re-based on the committed set; also how the uncontrolled commit is folded over
    // the resolved dispatches (#150). A form reset is dispatched `whole` and bypasses it.
    reducer: (prev, _next, details) => applyPatch(prev, details),
    warn: { component: part, prop: "value" },
  });

  const key = JSON.stringify([...optimistic]);
  const values = useMemo(() => JSON.parse(key) as string[], [key]);

  /** The latest dispatch was a form reset (CheckboxGroup #151). */
  const latestIsReset = useRef(false);

  const change: MultipleSelection<Extra>["change"] = (patch, fields, event) => {
    const added = patch.added.filter((v, i) => !optimistic.has(v) && patch.added.indexOf(v) === i);
    const removed = patch.removed.filter((v) => optimistic.has(v));
    if (added.length === 0 && removed.length === 0) return false;
    // `removed` in value order (combobox.md 15.2).
    const ordered = [...optimistic].filter((v) => removed.includes(v));
    const { reason, ...extra } = fields;
    const details = createActionDetails(event, {
      reason,
      added,
      removed: ordered,
      ...extra,
    }) as unknown as Details;
    latestIsReset.current = false;
    dispatch(applyPatch(optimistic, details), details);
    return true;
  };

  const reset: MultipleSelection<Extra>["reset"] = (target, event) => {
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
      ...resetFields,
    }) as Details;
    latestIsReset.current = true;
    dispatch(new Set(target), details, { whole: true });
  };

  return { optimistic, committed, values, pending, change, reset };
}

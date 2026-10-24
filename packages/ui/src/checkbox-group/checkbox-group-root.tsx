"use client";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { createActionDetails } from "../internal/action-details.js";
import { dataAttr } from "../internal/data-attr.js";
import { transitionTypes } from "../internal/transition-types.js";
import type {
  ActionDetails,
  ChangeAction,
  ChangeReason,
  RenderProp,
  StateValue,
} from "../internal/types.js";
import { intendedValue, useControllableAction } from "../internal/use-controllable-action.js";
import { useFieldValueChange } from "../internal/use-field-control.js";
import { useFieldsetGroup } from "../internal/use-fieldset-group.js";
import { useItemOrder } from "../internal/use-item-order.js";
import type { ItemLayout } from "../internal/use-item-order.js";
import { useNativeGroupReconciliation } from "../internal/use-native-group-reconciliation.js";
import { useRender } from "../internal/use-render.js";
import { applyPatch, EMPTY_SET, setsEqual, sortByOrder, toSet } from "../internal/value-set.js";
import type { ValueSet } from "../internal/value-set.js";
import { CheckboxGroupContext, enabledValues } from "./checkbox-group-context.js";
import type { CheckboxGroupContextValue, CheckboxGroupPatch } from "./checkbox-group-context.js";

const isDev = process.env.NODE_ENV !== "production";

/** Details passed as the second argument of `valueChangeAction`. */
export interface CheckboxGroupValueChangeDetails extends ActionDetails {
  /**
   * `"activate"`: the user toggled an Item or a Parent (click, Space, label click; `event` is the
   * native `click`). `"platform"`: the browser changed the checked boxes itself: a form reset
   * (`event` is the `reset` event), or clicks before hydration / Firefox form-state restoration
   * found at mount (`event` is `undefined`).
   */
  readonly reason: ChangeReason;
  /** Values this dispatch checked, in document order of their Items (values with no Item last). */
  readonly added: readonly string[];
  /** Values this dispatch unchecked, same order. */
  readonly removed: readonly string[];
}

export interface CheckboxGroupRootState {
  /**
   * Optimistic checked values, in document order of the Items as of the Root's last render
   * (values with no Item last). Items reordered by a component that re-renders without the Root
   * keep the previous order here until the Root renders again; `next` and `details` of
   * `valueChangeAction` always read the current DOM order. The server render and the first client
   * render use the value's own order. Content rendered from it must not suspend.
   */
  readonly value: readonly string[];
  /** An action dispatched through this group is in flight. */
  readonly pending: boolean;
  /** The `disabled` prop (or the enclosing `Field.Root`'s). */
  readonly disabled: boolean;
}

export interface CheckboxGroupRootProps extends Omit<
  ComponentPropsWithRef<"fieldset">,
  | "className"
  | "style"
  | "children"
  | "defaultValue"
  | "defaultChecked"
  | "name"
  | "disabled"
  | "form"
> {
  /**
   * Controlled checked values. `[]` checks nothing; `undefined` means uncontrolled. Order is not
   * significant and duplicates are ignored: the value is a set.
   *
   * A form reset returns each box to the `checked` it had when *that box* mounted (React sets
   * `defaultChecked` once, from the initial `checked`). The reset is offered to
   * `valueChangeAction` as a `"platform"` change; for a stable target use `defaultValue`.
   */
  value?: string[];
  /**
   * Initial values in uncontrolled mode. Defaults to `[]`. Also the values a form reset returns
   * to: the latest prop value is mirrored into the boxes' `defaultChecked`.
   */
  defaultValue?: string[];
  /**
   * Runs inside the Root's transition whenever the set of checked values changes. May be sync
   * or async (also a Server Function); rejections reach the nearest Error Boundary and roll the
   * change back.
   *
   * `next` is the whole set as a fresh array in document order of the Items; treat it as a set.
   * `details.added` / `details.removed` say what changed. When controlled and updating after
   * your own `await`, prefer a functional update keyed by `added` / `removed` over
   * `setValue(next)`: two overlapping actions completing out of order would otherwise land the
   * older whole set last. A `setState` placed after your own `await` is not a Transition update;
   * wrap it in `startTransition` (React limitation). `details.event.preventDefault()` is not a
   * veto; use controlled mode to veto a change.
   */
  valueChangeAction?: ChangeAction<string[], CheckboxGroupValueChangeDetails>;
  /**
   * The `name` shared by every Item (form data key: `formData.getAll(name)`). Defaults to a
   * `useId()` value; pass a real name when the group is inside a `<form>` you submit.
   */
  name?: string;
  /** The `form` attribute, applied to the fieldset and to every Item. */
  form?: string;
  /**
   * "At least one Item must be checked." Rendered as native `required` on every Item while no
   * enabled Item is checked, and on none once one is: values with no Item and checked disabled
   * Items (neither is submitted) do not satisfy it. Until the Items have mounted (server HTML,
   * before hydration) any checked value satisfies it. Not exposed on the fieldset (ARIA does not
   * allow `aria-required` on role `group`): say it in the `Label` or through `aria-describedby`.
   */
  required?: boolean;
  /** Renders `<fieldset disabled>`: every Item and Parent is disabled and unfocusable. */
  disabled?: boolean;
  className?: StateValue<string | undefined, CheckboxGroupRootState>;
  style?: StateValue<CSSProperties | undefined, CheckboxGroupRootState>;
  children?: StateValue<ReactNode, CheckboxGroupRootState>;
  /** Replace the rendered element. Must keep a `<fieldset>`. */
  render?: RenderProp<ComponentPropsWithRef<"fieldset">, CheckboxGroupRootState>;
}

/** Value → "has an Item without its own `disabled`", over the registered Items. */
type ItemRegistry = Map<object, { readonly value: string; readonly disabled: boolean }>;

function summarize(registry: ItemRegistry): Map<string, boolean> {
  const items = new Map<string, boolean>();
  for (const { value, disabled } of registry.values()) {
    items.set(value, (items.get(value) ?? false) || !disabled);
  }
  return items;
}

function disabledOf(items: ReadonlyMap<string, boolean> | null): ValueSet {
  if (items === null) return EMPTY_SET;
  const disabled = new Set<string>();
  for (const [value, enabled] of items) if (!enabled) disabled.add(value);
  return disabled.size === 0 ? EMPTY_SET : disabled;
}

function mapsEqual(a: ReadonlyMap<string, boolean>, b: ReadonlyMap<string, boolean>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}

const NO_ORDER: ItemLayout = { order: [] };

/** The group's Items: checkboxes of this `name` in the fieldset (Parents have none). */
function readItems(fieldset: HTMLFieldSetElement | null, name: string): HTMLInputElement[] {
  if (fieldset === null) return [];
  return [...fieldset.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].filter(
    (box) => box.name === name,
  );
}

/**
 * `<fieldset>` that owns the group's state (a set of values), the transition, the shared `name`,
 * the form-reset listener, the mount reconciliation and the group-level `required`
 * (design/components/checkbox-group.md 14.3). Carries `data-pending` while `valueChangeAction`
 * is in flight. Its implicit role is `group`; no `role` is written.
 *
 * Owned keys (conventions 1.2): `disabled`, `form`, `data-pending`, `data-disabled`; inside a
 * `Field.Root` also `aria-labelledby` (→ `Field.Label`, token-merged), `aria-describedby`
 * (token-merged), `aria-invalid` and `data-invalid`, and `name` / `required` / `disabled` default
 * from the Field.
 *
 * Unlike RadioGroup, Items may hydrate after their Root (a Suspense boundary between them): a
 * click before an Item hydrated is reconciled when it does.
 */
export function CheckboxGroupRoot({
  value,
  defaultValue,
  valueChangeAction,
  name: nameProp,
  form,
  required: requiredProp,
  disabled: disabledProp,
  className,
  style,
  children,
  render,
  ...rest
}: CheckboxGroupRootProps) {
  // `required` is "at least one" (design section 7).
  const { field, name, required, disabled, fieldsetRef, rootRef } = useFieldsetGroup({
    component: "CheckboxGroup.Root",
    name: nameProp,
    disabled: disabledProp,
    required: requiredProp,
  });
  /** Parent reports waiting for the next mount read (design 8.1). */
  const parentReports = useRef<{ values: readonly string[]; checked: boolean }[]>([]);

  // Item registration (design 6.2, 7): each Item reports its value and own `disabled` from a
  // layout effect. The ref is current for the residual-path reads; the state, set only when the
  // summary changes, is what render uses. `null` until an Item registered, so the server render
  // and the hydration render (which cannot know) agree.
  const itemRegistry = useRef<ItemRegistry>(new Map());
  const [items, setItems] = useState<ReadonlyMap<string, boolean> | null>(null);
  const registerItem = useCallback((value: string, disabled: boolean) => {
    const publish = () => {
      const next = summarize(itemRegistry.current);
      setItems((prev) => (prev !== null && mapsEqual(prev, next) ? prev : next));
    };
    const token = {};
    itemRegistry.current.set(token, { value, disabled });
    publish();
    return () => {
      itemRegistry.current.delete(token);
      publish();
    };
  }, []);
  const disabledItems = useMemo(() => disabledOf(items), [items]);

  const controlledSet = useMemo(() => (value === undefined ? undefined : toSet(value)), [value]);
  const defaultSet = useMemo(
    () => (defaultValue === undefined ? undefined : toSet(defaultValue)),
    [defaultValue],
  );

  /** Sorts by the Items' current document order. Reads the DOM: handlers and effects only. */
  const sortByDocument = (values: Iterable<string>): string[] =>
    sortByOrder(
      values,
      readItems(fieldsetRef.current, name).map((item) => item.value),
    );

  const { optimistic, committed, pending, dispatch, latestInFlight } = useControllableAction<
    ValueSet,
    CheckboxGroupValueChangeDetails
  >({
    controlled: controlledSet,
    defaultValue: defaultSet,
    initialValue: EMPTY_SET,
    action:
      valueChangeAction && ((next, details) => valueChangeAction(sortByDocument(next), details)),
    transitionTypes: (_next, _prev, details) => [
      ...transitionTypes("checkbox-group"),
      ...(details.added.length > 0 ? ["fsui-checkbox-group-check"] : []),
      ...(details.removed.length > 0 ? ["fsui-checkbox-group-uncheck"] : []),
    ],
    reducer: (prev, _next, details) => applyPatch(prev, details),
    warn: { component: "CheckboxGroup.Root", prop: "value" },
  });
  // Deliberately no warning when neither `value` nor `defaultValue` is given: an empty group is
  // the HTML default (design 3.1).

  const base = (): ValueSet => intendedValue(latestInFlight, optimistic);

  /** Dispatches `patch` on top of `from`, with the details of design 3.1. */
  const dispatchPatch = (
    from: ValueSet,
    patch: CheckboxGroupPatch,
    reason: ChangeReason,
    event: Event | undefined,
  ): void => {
    const details = createActionDetails(event, {
      reason,
      added: sortByDocument(patch.added),
      removed: sortByDocument(patch.removed),
    });
    dispatch(applyPatch(from, details), details);
  };

  /**
   * The group as the DOM shows it (`checked`) or as a form reset leaves it (`defaultChecked`),
   * laid over `base()` so that values with no Item are kept (they have no DOM to read).
   */
  const readDom = (prop: "checked" | "defaultChecked"): Map<string, boolean> =>
    new Map(readItems(fieldsetRef.current, name).map((item) => [item.value, item[prop]]));
  const readGroup = (
    prop: "checked" | "defaultChecked",
    from: ValueSet,
    dom: ReadonlyMap<string, boolean> = readDom(prop),
  ): Set<string> => {
    const next = new Set(from);
    for (const [v, isChecked] of dom) {
      if (isChecked) next.add(v);
      else next.delete(v);
    }
    return next;
  };

  /**
   * The Root's own mount reconciliation ran: later member mounts are "late" (8.3). Set after the
   * adapter's mount effect; reset by the cleanup (StrictMode included).
   */
  const rootMounted = useRef(false);
  /**
   * Late mounts: the members' `checked` read in the first late member's mount layout effect. The
   * adapter reads the group in a microtask, but the Items' registration re-renders the group
   * right after the layout effects, and that re-render re-applies each Item's `checked`, erasing a
   * click made before the Item hydrated. Every member of the commit is in the DOM by then.
   */
  const lateSnapshot = useRef<Map<string, boolean> | null>(null);

  // The residual browser paths (design section 8): one dispatch per group, from here. Items and
  // Parents that mount after the Root report through `onItemMounted`.
  const { onItemMounted: onMemberMounted } = useNativeGroupReconciliation<ValueSet>({
    element: fieldsetRef,
    readCurrent: () => {
      const next = readGroup("checked", base(), lateSnapshot.current ?? undefined);
      lateSnapshot.current = null;
      // A Parent clicked before hydration means what its click means: check / uncheck all of its
      // values whose Items are enabled (8.1, 6.2). Read from the registry ref: the Items of this
      // commit registered before this runs, and render has not caught up yet.
      const disabledNow = disabledOf(summarize(itemRegistry.current));
      for (const report of parentReports.current) {
        for (const v of enabledValues(report.values, disabledNow)) {
          if (report.checked) next.add(v);
          else next.delete(v);
        }
      }
      parentReports.current = [];
      return next;
    },
    // Uncontrolled: start from `defaultValue`, so values with no Item return to it too (they have
    // no `defaultChecked` to read). Controlled: from `base()`, as for the mount read; the parent
    // decides.
    readDefault: () =>
      readGroup("defaultChecked", value === undefined ? (defaultSet ?? EMPTY_SET) : base()),
    base,
    equals: setsEqual,
    onPlatformChange: (next, event) => {
      const from = base();
      const added = [...next].filter((v) => !from.has(v));
      const removed = [...from].filter((v) => !next.has(v));
      dispatchPatch(from, { added, removed }, "platform", event);
    },
  });

  useLayoutEffect(() => {
    rootMounted.current = true;
    return () => {
      rootMounted.current = false;
    };
  }, []);
  const onItemMounted = (el: HTMLInputElement | null) => {
    const late = rootMounted.current;
    if (late && lateSnapshot.current === null) lateSnapshot.current = readDom("checked");
    onMemberMounted(el);
    // A snapshot the adapter did not consume (it queues one read per commit, before this).
    if (late) {
      queueMicrotask(() => {
        lateSnapshot.current = null;
      });
    }
  };

  // The state's `value` is in document order (design 14.6: Item values are unique).
  const { renderedValue } = useItemOrder({
    optimistic,
    initial: NO_ORDER,
    read: () => ({ order: readItems(fieldsetRef.current, name).map((item) => item.value) }),
    duplicateMessage:
      isDev &&
      ((duplicate) =>
        `CheckboxGroup.Item: two Items share the value "${duplicate}" in one ` +
        `CheckboxGroup.Root. Item values must be unique; both boxes follow the same value.`),
  });

  const itemsRequired =
    required &&
    (items === null ? optimistic.size === 0 : ![...optimistic].some((v) => items.get(v) === true));
  // Inside a Field: the Items' `checked` and derived `required` are written by React after the
  // click's `change` (a Parent checks Items with no event of their own), so the Field re-reads
  // validity and `validate` after the commit (design/components/field-form.md 7.2).
  useFieldValueChange(`${[...optimistic].sort().join("\u0000")}|${String(itemsRequired)}`);

  // `aria-invalid` is not supported on role `group` (ARIA 1.2 made it widget-specific): inside a
  // Field it goes on every Item (a `checkbox`) instead; the fieldset keeps `data-invalid` and
  // `aria-describedby`, read when focus enters the group.
  const { "aria-invalid": fieldInvalid, ...groupAttributes } = field.attributes;

  const state: CheckboxGroupRootState = { value: renderedValue, pending, disabled };

  const context: CheckboxGroupContextValue = {
    name,
    form,
    fieldInvalid,
    required: itemsRequired,
    disabledItems,
    registerItem,
    optimistic,
    committed,
    state,
    defaultValue: value === undefined ? (defaultSet ?? EMPTY_SET) : undefined,
    onItemMounted,
    reportParent: (values, checked) => {
      parentReports.current.push({ values, checked });
    },
    sortByDocument,
    toggle: (item, checked, event) => {
      // No-op rule against the optimistic set (conventions 2.3 item 8).
      if (optimistic.has(item) === checked) return;
      const patch = checked ? { added: [item], removed: [] } : { added: [], removed: [item] };
      dispatchPatch(optimistic, patch, "activate", event);
    },
    apply: (patch, event) => {
      const added = patch.added.filter((v) => !optimistic.has(v));
      const removed = patch.removed.filter((v) => optimistic.has(v));
      if (added.length === 0 && removed.length === 0) return;
      dispatchPatch(optimistic, { added, removed }, "activate", event);
    },
  };

  const element = useRender<ComponentPropsWithRef<"fieldset">, CheckboxGroupRootState>({
    defaultElement: "fieldset",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: {
      ...groupAttributes,
      disabled,
      form,
      "data-pending": dataAttr(pending),
      "data-disabled": dataAttr(disabled),
    },
    ref: rootRef,
  });

  return <CheckboxGroupContext value={context}>{element}</CheckboxGroupContext>;
}

CheckboxGroupRoot.displayName = "CheckboxGroupRoot";

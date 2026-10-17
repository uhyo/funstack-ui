"use client";
import {
  useCallback,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { useControllableAction } from "../internal/use-controllable-action.js";
import { useNativeGroupReconciliation } from "../internal/use-native-group-reconciliation.js";
import { useRender } from "../internal/use-render.js";
import { CheckboxGroupContext } from "./checkbox-group-context.js";
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
   * Optimistic checked values, in document order of the Items (as of the last commit; values
   * with no Item last). Content rendered from it must not suspend.
   */
  readonly value: readonly string[];
  /** An action dispatched through this group is in flight. */
  readonly pending: boolean;
  /** The `disabled` prop. */
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
   * value is checked, and on none once one is. Not exposed on the fieldset (ARIA does not allow
   * `aria-required` on role `group`): say it in the `Label` or through `aria-describedby`.
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

type ValueSet = ReadonlySet<string>;

const EMPTY: ValueSet = new Set();

function toSet(value: readonly string[]): ValueSet {
  return new Set(value);
}

function setsEqual(a: ValueSet, b: ValueSet): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/** The optimistic reducer (design 5.2): apply a patch, so stacked dispatches re-base. */
function reduce(set: ValueSet, patch: CheckboxGroupPatch): ValueSet {
  const next = new Set(set);
  for (const v of patch.removed) next.delete(v);
  for (const v of patch.added) next.add(v);
  return next;
}

/**
 * `values` sorted by `order` (the Items' values in document order); values not in `order` keep
 * their iteration order, after the others.
 */
function sortByOrder(values: Iterable<string>, order: readonly string[]): string[] {
  const wanted = new Set(values);
  const sorted: string[] = [];
  for (const v of order) if (wanted.delete(v)) sorted.push(v);
  for (const v of wanted) sorted.push(v);
  return sorted;
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

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
 * Owned keys (conventions 1.2): `disabled`, `form`, `data-pending`, `data-disabled`.
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
  required = false,
  disabled = false,
  className,
  style,
  children,
  render,
  ...rest
}: CheckboxGroupRootProps) {
  const fallbackName = useId();
  const name = nameProp ?? fallbackName;
  const fieldsetRef = useRef<HTMLFieldSetElement | null>(null);
  const warnedElement = useRef(false);
  const warnedDuplicate = useRef(false);
  /** Parent reports waiting for the next mount read (design 8.1). */
  const parentReports = useRef<{ values: readonly string[]; checked: boolean }[]>([]);

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
    initialValue: EMPTY,
    action:
      valueChangeAction && ((next, details) => valueChangeAction(sortByDocument(next), details)),
    transitionTypes: (_next, _prev, details) => [
      ...transitionTypes("checkbox-group"),
      ...(details.added.length > 0 ? ["fsui-checkbox-group-check"] : []),
      ...(details.removed.length > 0 ? ["fsui-checkbox-group-uncheck"] : []),
    ],
    reducer: (prev, _next, details) => reduce(prev, details),
    warn: { component: "CheckboxGroup.Root", prop: "value" },
  });
  // Deliberately no warning when neither `value` nor `defaultValue` is given: an empty group is
  // the HTML default (design 3.1).

  /** What the user intends: the latest in-flight dispatch, else optimistic (conventions 3.8 rule 1). */
  const base = (): ValueSet => {
    const inFlight = latestInFlight();
    return inFlight === null ? optimistic : inFlight.next;
  };

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
    dispatch(reduce(from, details), details);
  };

  /**
   * The group as the DOM shows it (`checked`) or as a form reset leaves it (`defaultChecked`),
   * laid over `base()` so that values with no Item are kept (they have no DOM to read).
   */
  const readGroup = (prop: "checked" | "defaultChecked"): Set<string> => {
    const next = new Set(base());
    for (const item of readItems(fieldsetRef.current, name)) {
      if (item[prop]) next.add(item.value);
      else next.delete(item.value);
    }
    return next;
  };

  // The residual browser paths (design section 8): one dispatch per group, from here. Items and
  // Parents that mount after the Root report through `onItemMounted`.
  const { onItemMounted } = useNativeGroupReconciliation<ValueSet>({
    element: fieldsetRef,
    readCurrent: () => {
      const next = readGroup("checked");
      // A Parent clicked before hydration means "check / uncheck all of its values" (8.1).
      for (const report of parentReports.current) {
        for (const v of report.values) {
          if (report.checked) next.add(v);
          else next.delete(v);
        }
      }
      parentReports.current = [];
      return next;
    },
    readDefault: () => readGroup("defaultChecked"),
    base,
    equals: setsEqual,
    onPlatformChange: (next, event) => {
      const from = base();
      const added = [...next].filter((v) => !from.has(v));
      const removed = [...from].filter((v) => !next.has(v));
      dispatchPatch(from, { added, removed }, "platform", event);
    },
  });

  // The state's `value` is in document order. Render cannot read the DOM, so the Items' order is
  // kept in state, refreshed after a commit only when the rendered `value` would change (a value
  // given out of document order, Items reordered or added). The first render, and the server,
  // use the value's own order.
  const [itemOrder, setItemOrder] = useState<readonly string[]>([]);
  const renderedValue = sortByOrder(optimistic, itemOrder);
  // After every commit (Items may move without the Root re-rendering). The comparison ends the
  // chain: the re-render it causes renders exactly the value just compared against.
  const syncItemOrder = useEffectEvent(() => {
    const order = readItems(fieldsetRef.current, name).map((item) => item.value);
    if (!arraysEqual(sortByOrder(optimistic, order), renderedValue)) setItemOrder(order);

    // Dev only: Item values must be unique within the Root (design 14.6).
    if (!isDev || warnedDuplicate.current) return;
    const duplicate = order.find((v, i) => order.indexOf(v) !== i);
    if (duplicate !== undefined) {
      warnedDuplicate.current = true;
      console.error(
        `CheckboxGroup.Item: two Items share the value "${duplicate}" in one ` +
          `CheckboxGroup.Root. Item values must be unique; both boxes follow the same value.`,
      );
    }
  });
  useLayoutEffect(() => {
    syncItemOrder();
  });

  const libraryRef = useCallback((el: HTMLFieldSetElement) => {
    fieldsetRef.current = el;
    if (isDev && !warnedElement.current && el.tagName !== "FIELDSET") {
      warnedElement.current = true;
      console.error(
        `CheckboxGroup.Root: expected to render a <fieldset> element but got ` +
          `<${el.tagName.toLowerCase()}>. The platform semantics (legend naming, disabled ` +
          `inheritance, form reset) need a real <fieldset>.`,
      );
    }
    return () => {
      fieldsetRef.current = null;
    };
  }, []);

  const context: CheckboxGroupContextValue = {
    name,
    form,
    required: required && optimistic.size === 0,
    optimistic,
    committed,
    pending,
    disabled,
    defaultValue: value === undefined ? (defaultSet ?? EMPTY) : undefined,
    onItemMounted,
    reportParent: (values, checked) => {
      parentReports.current.push({ values, checked });
    },
    value: renderedValue,
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

  const state: CheckboxGroupRootState = {
    value: renderedValue,
    pending,
    disabled,
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
      disabled,
      form,
      "data-pending": dataAttr(pending),
      "data-disabled": dataAttr(disabled),
    },
    ref: libraryRef,
  });

  return <CheckboxGroupContext value={context}>{element}</CheckboxGroupContext>;
}

CheckboxGroupRoot.displayName = "CheckboxGroupRoot";

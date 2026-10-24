"use client";
import { createContext, use } from "react";
import type { SetPatch } from "../internal/value-set.js";
import type { CheckboxGroupRootState } from "./checkbox-group-root.js";

/** A change to the group's set of checked values (design/components/checkbox-group.md 5.2). */
export type CheckboxGroupPatch = SetPatch;

export interface CheckboxGroupContextValue {
  /** The `name` shared by every Item of the group (prop or `useId()`). */
  readonly name: string;
  readonly form: string | undefined;
  /** Inside a `Field.Root`: the Field's `aria-invalid`, rendered on every Item. Else `undefined`. */
  readonly fieldInvalid: "true" | "false" | undefined;
  /**
   * The Root's `required` while no value of an enabled Item is checked (design section 7):
   * rendered as native `required` on every Item. Before the Items have registered (server render,
   * hydration render) it is `required && optimistic.size === 0`, which is what the server can
   * compute.
   */
  readonly required: boolean;
  /** Optimistic checked values: Items and Parents render from it. */
  readonly optimistic: ReadonlySet<string>;
  /** Committed checked values. For per-part pending and the Parent's restore memory only. */
  readonly committed: ReadonlySet<string>;
  /**
   * The Root's state. Its `disabled` is `Root disabled`, which reaches the boxes natively through
   * `<fieldset disabled>`.
   */
  readonly state: CheckboxGroupRootState;
  /**
   * Uncontrolled mode: the latest `defaultValue` as a set, mirrored by each Item into
   * `el.defaultChecked` (and by each Parent, derived) so that a form reset returns to it.
   * `undefined` in controlled mode, where React's mount-time value stays the reset target
   * (conventions 3.8 rule 6).
   */
  readonly defaultValue: ReadonlySet<string> | undefined;
  /**
   * Item click. No-op when `optimistic.has(value) === checked`. Checks neither `disabled` nor
   * `defaultPrevented` (the Item's `guardCheckableChange` does).
   */
  readonly toggle: (value: string, checked: boolean, event: Event) => void;
  /** Parent click: a whole patch. No-op when it changes nothing against the optimistic set. */
  readonly apply: (patch: CheckboxGroupPatch, event: Event) => void;
  /**
   * Values whose every mounted Item has its own `disabled` prop (`Root disabled` is not counted).
   * A Parent leaves them alone (design 6.2). Empty until the Items registered.
   */
  readonly disabledItems: ReadonlySet<string>;
  /**
   * Stable. Each Item calls it from a layout effect with its value and its own `disabled` prop;
   * returns the unregister function.
   */
  readonly registerItem: (value: string, disabled: boolean) => () => void;
  /** From `useNativeGroupReconciliation`; Items and Parents call it from their mount layout effect. */
  readonly onItemMounted: (element: HTMLInputElement | null) => void;
  /**
   * A Parent mounted with a DOM `checked` that differs from its derivation (a click before
   * hydration). Folded into the Root's next mount read as "check all" / "uncheck all" of
   * `values` (design 8.1). Call before `onItemMounted`.
   */
  readonly reportParent: (values: readonly string[], checked: boolean) => void;
  /**
   * Sorts values by the current document order of the group's Items (a DOM read); values with no
   * Item keep their iteration order, after them. Call from handlers and effects only.
   */
  readonly sortByDocument: (values: Iterable<string>) => string[];
}

/**
 * The values a Parent over `values` acts on and derives from: those not in `disabledItems`
 * (values with no Item included). When that leaves nothing (every value has only disabled
 * Items), all of `values`: a Parent the consumer left enabled over disabled Items still shows and
 * changes their state (disable the Parent to make it inert).
 */
export function enabledValues(
  values: readonly string[],
  disabledItems: ReadonlySet<string>,
): readonly string[] {
  if (disabledItems.size === 0) return values;
  const enabled = values.filter((v) => !disabledItems.has(v));
  return enabled.length > 0 ? enabled : values;
}

export const CheckboxGroupContext = createContext<CheckboxGroupContextValue | null>(null);

export function useCheckboxGroupContext(part: string): CheckboxGroupContextValue {
  const context = use(CheckboxGroupContext);
  if (context === null) {
    throw new Error(`${part} must be rendered inside a CheckboxGroup.Root.`);
  }
  return context;
}

"use client";
import { createContext, use } from "react";

/** A change to the group's set of checked values (design/components/checkbox-group.md 5.2). */
export interface CheckboxGroupPatch {
  readonly added: readonly string[];
  readonly removed: readonly string[];
}

export interface CheckboxGroupContextValue {
  /** The `name` shared by every Item of the group (prop or `useId()`). */
  readonly name: string;
  readonly form: string | undefined;
  /** `required && optimistic.size === 0`: rendered as native `required` on every Item. */
  readonly required: boolean;
  /** Optimistic checked values: Items and Parents render from it. */
  readonly optimistic: ReadonlySet<string>;
  /** Committed checked values. For per-part pending and the Parent's restore memory only. */
  readonly committed: ReadonlySet<string>;
  readonly pending: boolean;
  /** `Root disabled` (reaches the boxes natively through `<fieldset disabled>`). */
  readonly disabled: boolean;
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
  /** From `useNativeGroupReconciliation`; Items and Parents call it from their mount layout effect. */
  readonly onItemMounted: (element: HTMLInputElement | null) => void;
  /**
   * A Parent mounted with a DOM `checked` that differs from its derivation (a click before
   * hydration). Folded into the Root's next mount read as "check all" / "uncheck all" of
   * `values` (design 8.1). Call before `onItemMounted`.
   */
  readonly reportParent: (values: readonly string[], checked: boolean) => void;
  /** The optimistic set as the Root state's `value`: an array in document order. */
  readonly value: readonly string[];
  /**
   * Sorts values by the document order of the group's Items (as of the last commit); values with
   * no Item keep their iteration order, after them. Read from handlers and effects.
   */
  readonly sortByDocument: (values: Iterable<string>) => string[];
}

export const CheckboxGroupContext = createContext<CheckboxGroupContextValue | null>(null);

export function useCheckboxGroupContext(part: string): CheckboxGroupContextValue {
  const context = use(CheckboxGroupContext);
  if (context === null) {
    throw new Error(`${part} must be rendered inside a CheckboxGroup.Root.`);
  }
  return context;
}

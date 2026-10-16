"use client";
import { createContext, use } from "react";

export interface RadioGroupContextValue {
  /** The `name` shared by every radio of the group (prop or `useId()`). */
  readonly name: string;
  readonly form: string | undefined;
  readonly required: boolean;
  /** Optimistic value: Items render `checked` from it. */
  readonly optimistic: string | null;
  readonly pending: boolean;
  /** `Root disabled` (reaches the radios natively through `<fieldset disabled>`). */
  readonly disabled: boolean;
  /**
   * Uncontrolled mode: the latest `defaultValue` (`null` when omitted), mirrored by each Item into
   * `el.defaultChecked` so that a form reset returns to it. `undefined` in controlled mode, where
   * React's mount-time value stays the reset target (conventions 3.8 rule 6).
   */
  readonly defaultValue: string | null | undefined;
  /**
   * Dispatches a user check. No-op when `value` is already the optimistic value. Checks neither
   * `disabled` (a disabled radio fires no click) nor `defaultPrevented` (the Item's
   * `guardCheckableChange` does).
   */
  readonly select: (value: string, event: Event) => void;
  /**
   * Called by each Item from its mount layout effect. An Item that mounts after the Root (under a
   * Suspense boundary, selective hydration) asks the Root to reconcile the group again, so a click
   * made before that Item hydrated is reported once (deduped by the Root's hook).
   */
  readonly onItemMounted: () => void;
}

export const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

export function useRadioGroupContext(part: string): RadioGroupContextValue {
  const context = use(RadioGroupContext);
  if (context === null) {
    throw new Error(`${part} must be rendered inside a RadioGroup.Root.`);
  }
  return context;
}

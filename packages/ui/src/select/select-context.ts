"use client";
import { createContext, use } from "react";

export interface SelectContextValue {
  /** Optimistic value: Options render `data-selected` from it. */
  readonly optimistic: string;
  readonly pending: boolean;
  /** `Root disabled` (natively disables the whole `<select>`). */
  readonly disabled: boolean;
  /**
   * Called by each Option from its mount layout effect with its element and whether that render
   * hydrated server HTML. Late options are re-applied, and hydrated late options reconciled
   * (design/components/select.md 6.2).
   */
  readonly optionMounted: (el: HTMLOptionElement | null, hydrated: boolean) => void;
}

export const SelectContext = createContext<SelectContextValue | null>(null);

export function useSelectContext(part: string): SelectContextValue {
  const context = use(SelectContext);
  if (context === null) {
    throw new Error(`${part} must be rendered inside a Select.Root.`);
  }
  return context;
}

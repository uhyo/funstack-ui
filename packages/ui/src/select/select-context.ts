"use client";
import { createContext, use } from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { DataAttributes } from "../internal/render-element.js";

export interface SelectContextValue {
  /** Optimistic value: Options render `data-selected` from it. */
  readonly optimistic: string;
  readonly pending: boolean;
  /** `Root disabled` (natively disables the whole `<select>`). */
  readonly disabled: boolean;
  /** `Root readOnly` or the Field's: every unselected Option is natively disabled. */
  readonly readOnly: boolean;
  /** Inside a `Field.Root`: an error is shown for the field. `false` outside. */
  readonly invalid: boolean;
  /** Inside a `Select.Group disabled` (`false` outside groups): Options match `:disabled`. */
  readonly groupDisabled: boolean;
  /**
   * Called by each Option from its mount layout effect with its element and whether that render
   * hydrated server HTML. Late options are re-applied, and hydrated late options reconciled
   * (design/components/select.md 6.2).
   */
  readonly optionMounted: (el: HTMLOptionElement | null, hydrated: boolean) => void;
}

export const SelectContext = createContext<SelectContextValue | null>(null);

/**
 * The attributes of a part whose state is the Root's (Trigger, Value, Group, GroupLabel,
 * Separator): `data-pending`, `data-disabled`, `data-readonly` and `data-invalid`, the boolean
 * members of `SelectRootState` (conventions 4.1 rule 2).
 */
export function rootStateAttributes(ctx: SelectContextValue): DataAttributes {
  return {
    "data-pending": dataAttr(ctx.pending),
    "data-disabled": dataAttr(ctx.disabled),
    "data-readonly": dataAttr(ctx.readOnly),
    "data-invalid": dataAttr(ctx.invalid),
  };
}

export function useSelectContext(part: string): SelectContextValue {
  const context = use(SelectContext);
  if (context === null) {
    throw new Error(`${part} must be rendered inside a Select.Root.`);
  }
  return context;
}

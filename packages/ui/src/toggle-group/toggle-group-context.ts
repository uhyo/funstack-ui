"use client";
import { createContext, use } from "react";

export type ToggleGroupOrientation = "horizontal" | "vertical";

export interface ToggleGroupContextValue {
  /** Optimistic pressed values: Items render `aria-pressed` from it. */
  readonly optimistic: ReadonlySet<string>;
  /** Committed pressed values; for per-Item pending only (design 5.3). */
  readonly committed: ReadonlySet<string>;
  readonly pending: boolean;
  /** `Root disabled`. */
  readonly disabled: boolean;
  /** The effective orientation: the Toolbar's inside one. */
  readonly orientation: ToggleGroupOrientation;
  /**
   * The value whose Item renders `focusgroupstart` (standalone group with
   * `experimental_focusgroup`): the first pressed enabled Item in document order, else `null`.
   */
  readonly focusgroupStartValue: string | null;
  /** An Item was activated (stable). Computes the patch of design 5.2 against the optimistic set. */
  readonly toggle: (value: string, event: Event) => void;
  /** Registers an Item's element and value; returns the cleanup (stable; used as a callback ref). */
  readonly register: (element: HTMLElement, value: string) => () => void;
}

export const ToggleGroupContext = createContext<ToggleGroupContextValue | null>(null);

export function useToggleGroupContext(part: string): ToggleGroupContextValue {
  const context = use(ToggleGroupContext);
  if (context === null) {
    throw new Error(`${part} must be rendered inside a ToggleGroup.Root.`);
  }
  return context;
}

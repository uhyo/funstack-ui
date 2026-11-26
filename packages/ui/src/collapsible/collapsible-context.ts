"use client";
import { createContext } from "react";

/** What `Collapsible.Trigger` and `Collapsible.Panel` read from the Root (memoised). */
export interface CollapsibleContextValue {
  /** Library mode (design/components/collapsible.md 2): the Root has `open`, `defaultOpen` or `openChangeAction`. */
  readonly library: boolean;
  readonly disabled: boolean;
  /** The Root's transition is pending (library mode only). */
  readonly pending: boolean;
  /** Committed open state; `undefined` in JS-free mode (browser-owned, unknown to React). */
  readonly committedOpen: boolean | undefined;
  /** Optimistic open state; `undefined` in JS-free mode. */
  readonly optimisticOpen: boolean | undefined;
  /** The Trigger was activated: dispatch `open` with reason "activate" (library mode; stable). */
  readonly dispatch: (open: boolean, event: Event) => void;
}

export const CollapsibleContext = createContext<CollapsibleContextValue | null>(null);

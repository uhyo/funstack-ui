"use client";
import { createContext } from "react";

/** Why a change was dispatched (design 2.2 / 2.3). */
export type AccordionChangeReason = "activate" | "platform";

/**
 * "static": JS-free mode, the browser owns `open`. "library": `open` is driven by React
 * committed state inside the Root's transition (design section 2).
 */
export type AccordionMode = "static" | "library";

export interface AccordionRootContextValue {
  readonly mode: AccordionMode;
  readonly exclusive: boolean;
  /** `name` for every `<details>`; set only in static exclusive mode. */
  readonly name: string | undefined;
  readonly disabled: boolean;
  readonly pending: boolean;
  /** Committed open set (library mode). Empty in static mode. */
  readonly committed: ReadonlySet<string>;
  /** Optimistic open set (library mode). Empty in static mode. */
  readonly optimistic: ReadonlySet<string>;
  /** A Trigger was activated: compute `next` from the optimistic set and dispatch. */
  readonly dispatch: (item: string, open: boolean, event: Event | undefined) => void;
  /** The browser changed `details.open`: compute `next` from the DOM and dispatch (design 2.3). */
  readonly dispatchFromDom: (item: string, open: boolean, event: Event | undefined) => void;
  /** Items register their `<details>` so `dispatchFromDom` can read every item's DOM state. */
  readonly registerItem: (value: string, element: HTMLDetailsElement) => () => void;
  /** Triggers register their `<summary>` for arrow-key navigation (design section 5). */
  readonly registerTrigger: (element: HTMLElement) => () => void;
}

export const AccordionRootContext = createContext<AccordionRootContextValue | null>(null);

export interface AccordionItemContextValue {
  readonly value: string;
  readonly disabled: boolean;
  /** `undefined` in static mode (browser-owned, unknown to React). */
  readonly committedOpen: boolean | undefined;
  /** `undefined` in static mode. */
  readonly optimisticOpen: boolean | undefined;
  readonly pending: boolean;
}

export const AccordionItemContext = createContext<AccordionItemContextValue | null>(null);

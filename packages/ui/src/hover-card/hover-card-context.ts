"use client";
import { createContext, use } from "react";
import type { RefObject } from "react";
import type { PopoverRootValue } from "../internal/overlay/use-overlay-root.js";

/** What `HoverCard.Root` gives its Trigger and Popup (design/components/hover-card.md 12). */
export interface HoverCardContextValue extends PopoverRootValue {
  readonly disabled: boolean;
  /** Written onto the Trigger as `interest-delay-start` / `-end` with `experimental_interestFor`. */
  readonly delay: number;
  readonly closeDelay: number;
  /**
   * "No open until fresh interest" (design 2.4): set by Escape, a press on the Trigger and the
   * library's focus return; cleared when the pointer enters or leaves the Trigger and when it
   * loses focus. Read by the JS path's `focus` listener and by the Popup's `beforetoggle`
   * interception of an interest open (the flagged path). A ref, never React state.
   */
  readonly suppressed: RefObject<boolean>;
  /**
   * Trigger and Popup register their elements here too (besides `triggerRef` / `popupRef`), so
   * the Root's interest effect re-runs when either changes.
   */
  readonly setTriggerElement: (element: HTMLElement | null) => void;
  readonly setPopupElement: (element: HTMLElement | null) => void;
  /**
   * The Trigger reports whether it writes `interestfor` (the flag is on and the Root is not
   * disabled), so the Root's effect re-detects the flagged path.
   */
  readonly setInterestForRequested: (requested: boolean) => void;
  /** The Root's document listeners attach now (an open routed at the Popup's `beforetoggle`). */
  readonly listenDocumentNow: () => void;
}

export const HoverCardContext = createContext<HoverCardContextValue | null>(null);

export function useHoverCardContext(part: string): HoverCardContextValue {
  const context = use(HoverCardContext);
  if (context === null) {
    throw new Error(`${part} must be rendered inside a HoverCard.Root.`);
  }
  return context;
}

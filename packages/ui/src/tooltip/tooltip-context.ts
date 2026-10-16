"use client";
import { createContext, use } from "react";

/** Which accessibility relation the tooltip provides for its trigger (design section 5.1). */
export type TooltipProvides = "description" | "name";

export interface TooltipContextValue {
  /** Id of the Popup; the Trigger references it through `aria-describedby` / `aria-labelledby`. */
  readonly popupId: string;
  readonly disabled: boolean;
  /** Written onto the Trigger as `interest-delay-start` / `-end` on the native path. */
  readonly delay: number;
  readonly closeDelay: number;
  readonly provides: TooltipProvides;
  /** Trigger and Popup register their elements through callback refs (design 12.2). */
  readonly setTriggerElement: (element: HTMLElement | null) => void;
  readonly setPopupElement: (element: HTMLElement | null) => void;
  /**
   * The Trigger reports whether it renders `interestfor`, so the Root's interaction effect re-runs
   * (and re-detects the native path) when `experimental_interestFor` changes after mount.
   */
  readonly setInterestForRequested: (requested: boolean) => void;
}

export const TooltipContext = createContext<TooltipContextValue | null>(null);

export function useTooltipContext(part: string): TooltipContextValue {
  const context = use(TooltipContext);
  if (context === null) {
    throw new Error(`${part} must be rendered inside a Tooltip.Root.`);
  }
  return context;
}

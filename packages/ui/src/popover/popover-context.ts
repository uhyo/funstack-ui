"use client";
import { createContext, use } from "react";
import type { PopoverRootValue } from "../internal/use-overlay-root.js";
import type { PopoverPopupState } from "./popover-popup.js";

export const PopoverContext = createContext<PopoverRootValue | null>(null);

export function usePopoverContext(part: string): PopoverRootValue {
  const context = use(PopoverContext);
  if (context === null) {
    throw new Error(`${part} must be rendered inside a Popover.Root.`);
  }
  return context;
}

/** The Popup's state, for Title and Description rendered inside it. */
export const PopoverPopupContext = createContext<PopoverPopupState | null>(null);

/**
 * The state Title and Description receive: the enclosing Popup's, or (outside a Popup, which
 * `aria-labelledby` allows) the Root's committed open state with the default placement.
 */
export function usePopoverPopupState(ctx: PopoverRootValue): PopoverPopupState {
  return use(PopoverPopupContext) ?? { open: ctx.committed, side: "bottom", align: "center" };
}

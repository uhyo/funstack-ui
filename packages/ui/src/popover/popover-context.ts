"use client";
import { createContext, use } from "react";
import type { PopoverRootValue } from "../internal/overlay/use-overlay-root.js";
import type { TitleDescriptionPresence } from "../internal/use-title-description.js";
import type { PopoverPopupState } from "./popover-popup.js";

/** The Root's popover machinery and which of Title and Description are mounted (#218). */
export interface PopoverContextValue extends PopoverRootValue {
  /** The Popup's `aria-labelledby` / `aria-describedby` name a part only while it is mounted. */
  readonly parts: TitleDescriptionPresence;
}

export const PopoverContext = createContext<PopoverContextValue | null>(null);

export function usePopoverContext(part: string): PopoverContextValue {
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

"use client";
import { createContext, use } from "react";

export type TabsOrientation = "horizontal" | "vertical";
export type TabsActivationMode = "automatic" | "manual";

/** Why a Tabs change was dispatched (design section 3.1). */
export type TabsChangeReason = "activate" | "platform";

export interface TabsContextValue {
  readonly rootId: string;
  /** Committed value: Panels render this. */
  readonly committed: string | null;
  /** Optimistic value: Tabs and the Indicator render this. */
  readonly optimistic: string | null;
  readonly pending: boolean;
  readonly orientation: TabsOrientation;
  readonly activationMode: TabsActivationMode;
  readonly loop: boolean;
  readonly disabled: boolean;
  /** Dispatches a change. No-op if `value` is the optimistic value. Never checks `disabled`. */
  readonly select: (value: string, event: Event | undefined, reason: TabsChangeReason) => void;
}

export const TabsContext = createContext<TabsContextValue | null>(null);

/** What a Tabs.List tells its Tabs about `experimental_focusgroup`. */
export interface TabsListContextValue {
  /** `experimental_focusgroup` is on: the selected Tab carries `focusgroupstart`. */
  readonly focusgroup: boolean;
  /**
   * The flag is on and the engine implements `focusgroup` (detected in an effect, so false during
   * SSR and hydration). Unselected Tabs then drop `tabindex="-1"`: Chromium leaves an element with
   * a negative tabindex out of the focusgroup, so roving tabindex would disable the native arrows.
   */
  readonly nativeFocusgroup: boolean;
}

export const TabsListContext = createContext<TabsListContextValue | null>(null);

export function useTabsContext(part: string): TabsContextValue {
  const context = use(TabsContext);
  if (context === null) {
    throw new Error(`${part} must be rendered inside a Tabs.Root.`);
  }
  return context;
}

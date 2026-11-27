"use client";
import { createContext, use } from "react";
import type { PopoverRootValue } from "../internal/overlay/use-overlay-root.js";

/** The open state of one flyout, owned by `NavigationMenu.Item` (navigation-menu.md 1). */
export const NavigationMenuItemContext = createContext<PopoverRootValue | null>(null);

export function useNavigationMenuItemContext(part: string): PopoverRootValue {
  const context = use(NavigationMenuItemContext);
  if (context === null) {
    throw new Error(`${part} must be rendered inside a NavigationMenu.Item.`);
  }
  return context;
}

/**
 * Set by `NavigationMenu.Popup` around its children: the Item whose panel a `NavigationMenu.Link`
 * closes when followed (navigation-menu.md 4). `null` outside a Popup (a top-level link).
 */
export const NavigationMenuPopupContext = createContext<PopoverRootValue | null>(null);

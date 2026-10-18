"use client";
import { createContext, use } from "react";

/** What a part inside a `Toolbar.Root` learns about it (design/components/toggle-group.md 7.3, 7.4). */
export interface ToolbarContextValue {
  /** The Toolbar's arrow-key axis. */
  readonly orientation: "horizontal" | "vertical";
}

/**
 * Provided by `Toolbar.Root`; read across folders by `ToggleGroup.Root` (joins the Toolbar's
 * sequence instead of running its own engine), `Toolbar.Separator` (perpendicular orientation)
 * and `Menu.Trigger` (opening arrows in a vertical Toolbar). Conventions 7.1.
 */
export const ToolbarContext = createContext<ToolbarContextValue | null>(null);

/** The enclosing Toolbar, or `null` outside one. Works during SSR (context, not DOM). */
export function useToolbarContext(): ToolbarContextValue | null {
  return use(ToolbarContext);
}

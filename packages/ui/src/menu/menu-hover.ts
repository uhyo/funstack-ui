"use client";
import type { MenuContextValue } from "./menu-context.js";

function hovered(element: Element | null): boolean {
  if (element === null) return false;
  try {
    return element.matches(":hover");
  } catch {
    return false;
  }
}

/**
 * Starts the submenu's `closeDelay` (design/components/menu.md 7): on expiry the submenu closes
 * with `"dismiss"` unless the pointer is back over its SubmenuTrigger or Popup, or keyboard focus
 * is inside it (a user who arrowed in and nudged the mouse keeps the submenu).
 */
export function scheduleHoverClose(menu: MenuContextValue, event: Event): void {
  const { popover, timers, closeDelay } = menu;
  timers.close(closeDelay, () => {
    const popup = popover.popupRef.current;
    if (hovered(popover.triggerRef.current) || hovered(popup)) return;
    const active = popup?.ownerDocument.activeElement ?? null;
    if (popup !== null && active !== null && popup.contains(active)) return;
    popover.requestClose(event, "dismiss");
  });
}

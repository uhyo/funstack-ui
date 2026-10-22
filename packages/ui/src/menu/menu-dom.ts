"use client";
// DOM helpers shared by the Menu parts. Items are read from the DOM when they are needed (a key
// press, an open), never registered (design/components/menu.md 13 and 14).

const ITEM_SELECTOR = '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]';

/** The items of `popup` in DOM order, without the items of its submenus. Disabled included. */
export function menuItems(popup: Element): HTMLElement[] {
  return Array.from(popup.querySelectorAll<HTMLElement>(ITEM_SELECTOR)).filter(
    (item) => item.closest('[role="menu"]') === popup,
  );
}

export function isMenuItem(element: Element, popup: Element): boolean {
  return element.matches(ITEM_SELECTOR) && element.closest('[role="menu"]') === popup;
}

/**
 * Disabled by its `disabled` prop. Keys on `data-disabled`, not `aria-disabled`: an item is also
 * `aria-disabled` while its own action is pending (#81), and a pending item is still an enabled
 * item for Home / End, the open focus and typeahead.
 */
export function isDisabledItem(item: Element): boolean {
  return item.hasAttribute("data-disabled");
}

/** The first (or last) enabled item; the first (or last) item if all are disabled. */
export function edgeItem(popup: Element, which: "first" | "last"): HTMLElement | null {
  const items = menuItems(popup);
  const ordered = which === "first" ? items : [...items].reverse();
  return ordered.find((item) => !isDisabledItem(item)) ?? ordered[0] ?? null;
}

/** Keyboard focus: the ring shows even where the engine's heuristic would not (as Tabs). */
export function focusItem(item: HTMLElement): void {
  item.focus({ focusVisible: true } as FocusOptions);
}

/** The text typeahead matches: the item's `label` prop, else its text content. */
export function typeaheadText(item: Element): string {
  return (item.getAttribute("data-typeahead") ?? item.textContent ?? "").trim().toLowerCase();
}

export function isRtl(element: Element): boolean {
  return getComputedStyle(element).direction === "rtl";
}

export function hasModifier(event: { altKey: boolean; ctrlKey: boolean; metaKey: boolean }) {
  return event.altKey || event.ctrlKey || event.metaKey;
}

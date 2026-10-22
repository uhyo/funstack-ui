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
 * `aria-disabled` while its own action is pending (#81). A pending item is an ordinary item for
 * navigation; only the open focus (`edgeItem`) skips items with the `disabled` prop. Arrow keys,
 * Home / End and typeahead skip nothing.
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

/**
 * `setPointerCapture`, which throws `NotFoundError` for a pointer the engine no longer tracks
 * (context-menu.md 2.1). A silent no-op when no button is down.
 */
export function capturePointer(element: Element | null, pointerId: number | undefined): void {
  if (element === null || pointerId === undefined) return;
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Not an active pointer (a synthetic event, a released button): nothing to capture.
  }
}

/** `<input>` types that take no text: their `contextmenu` is not an editing one. */
const NON_TEXT_INPUTS = new Set([
  "button",
  "submit",
  "reset",
  "checkbox",
  "radio",
  "range",
  "color",
  "file",
  "image",
  "hidden",
]);

/**
 * An editable target keeps the browser's own context menu by default (context-menu.md 2.3): a
 * text-taking `<input>`, a `<textarea>`, or editable content.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (target === null || (target as Node).nodeType !== 1) return false;
  const element = target as HTMLElement;
  if (element.closest("textarea") !== null) return true;
  const input = element.closest("input");
  if (input !== null && !NON_TEXT_INPUTS.has(input.type)) return true;
  // `isContentEditable` where implemented (every engine; not jsdom).
  if (typeof element.isContentEditable === "boolean") return element.isContentEditable;
  return element.closest('[contenteditable]:not([contenteditable="false"])') !== null;
}

export function hasModifier(event: { altKey: boolean; ctrlKey: boolean; metaKey: boolean }) {
  return event.altKey || event.ctrlKey || event.metaKey;
}

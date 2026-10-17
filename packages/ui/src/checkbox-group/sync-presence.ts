/**
 * Makes a boolean attribute's presence match `present`. For parts that may hydrate after their
 * Root: hydration keeps server attributes that differ from the client render.
 *
 * No `"use client"` directive: no client-only API (conventions 7.1).
 */
export function syncPresence(el: Element, name: string, present: boolean): void {
  if (el.hasAttribute(name) !== present) {
    if (present) el.setAttribute(name, "");
    else el.removeAttribute(name);
  }
}

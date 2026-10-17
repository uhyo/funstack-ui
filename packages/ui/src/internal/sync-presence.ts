/**
 * Makes a boolean attribute's presence match `present`. For group members that may hydrate after
 * their Root (`RadioGroup.Item`, `CheckboxGroup.Item` / `Parent`): hydration keeps server
 * attributes that differ from the client render (React only warns), and a member hydrating late
 * can render a different state than the server did.
 *
 * No `"use client"` directive: no client-only API (conventions 7.1).
 */
export function syncPresence(el: Element, name: string, present: boolean): void {
  if (el.hasAttribute(name) !== present) {
    if (present) el.setAttribute(name, "");
    else el.removeAttribute(name);
  }
}

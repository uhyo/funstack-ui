"use client";
// Screen-reader announcements (design/components/number-field.md 8.3, conventions 8): through
// `ariaNotify()` where the engine has it, otherwise through one module-level, visually hidden
// `role="status"` live region appended to `document.body` on first use. No part renders a live
// region of its own for these announcements.

type NotifyingElement = Element & { ariaNotify?: (announcement: string) => void };

/** How long the fallback region keeps a message before it is cleared, so a repeat is spoken. */
export const ANNOUNCE_CLEAR_DELAY = 1000;

const REGION_STYLE =
  "position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0; " +
  "overflow: hidden; clip-path: inset(50%); white-space: nowrap;";

let region: HTMLElement | null = null;
let clearTimer: ReturnType<typeof setTimeout> | undefined;

function liveRegion(doc: Document): HTMLElement {
  if (region !== null && region.isConnected && region.ownerDocument === doc) return region;
  const el = doc.createElement("div");
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.setAttribute("aria-atomic", "true");
  el.setAttribute("data-fsui-announcer", "");
  el.setAttribute("style", REGION_STYLE);
  doc.body.append(el);
  region = el;
  return el;
}

/**
 * Speaks `message` in the context of `element`: `element.ariaNotify(message)` where it exists,
 * else the fallback live region. An empty message announces nothing.
 */
export function announce(element: Element, message: string): void {
  if (message === "") return;
  const notifying = element as NotifyingElement;
  if (typeof notifying.ariaNotify === "function") {
    notifying.ariaNotify(message);
    return;
  }
  const doc = element.ownerDocument;
  if (doc.body === null) return;
  const el = liveRegion(doc);
  el.textContent = message;
  if (clearTimer !== undefined) clearTimeout(clearTimer);
  clearTimer = setTimeout(() => {
    clearTimer = undefined;
    if (region !== null) region.textContent = "";
  }, ANNOUNCE_CLEAR_DELAY);
}

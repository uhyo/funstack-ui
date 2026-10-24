"use client";
// Screen-reader announcements (design/components/number-field.md 8.3, conventions 8): through
// `ariaNotify()`, which every supported engine has (Chrome 141, Firefox 150, Safari 27). No live
// region fallback (docs/vision.md: no fallbacks; #113 A1): a region in `document.body` would be
// inert under a modal dialog anyway. No part renders a live region for these announcements.

/** `ariaNotify()` on an element or a document, where the engine has it (not in the DOM types yet). */
export interface AriaNotifyTarget {
  ariaNotify?: (announcement: string, options?: { priority?: "normal" | "high" }) => void;
}

type NotifyingElement = Element & AriaNotifyTarget;

/**
 * Speaks `message` in the context of `element` through `element.ariaNotify(message)`. An empty
 * message, or an engine without `ariaNotify` (jsdom, a lagging test build), announces nothing.
 */
export function announce(element: Element, message: string): void {
  if (message === "") return;
  const notifying = element as NotifyingElement;
  if (typeof notifying.ariaNotify === "function") notifying.ariaNotify(message);
}

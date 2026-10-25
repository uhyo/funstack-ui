// Directive-free: screen-reader announcements (design/components/number-field.md 8.3,
// conventions 8) through `ariaNotify()`, which every supported engine has (Chrome 141,
// Firefox 150, Safari 27). No live region fallback (docs/vision.md: no fallbacks): a region in
// `document.body` would be inert under a modal dialog anyway. No part renders a live region for
// these announcements.

/** `ariaNotify()` on an element or a document, where the engine has it (not in the DOM types yet). */
interface AriaNotifyTarget {
  ariaNotify?: (announcement: string, options?: { priority?: "normal" | "high" }) => void;
}

/** Whether `target` has `ariaNotify()` (not jsdom, nor a lagging test build). */
export function canAnnounce(target: Element | Document): boolean {
  return typeof (target as AriaNotifyTarget).ariaNotify === "function";
}

/**
 * Speaks `message` in the context of `target` through `target.ariaNotify()`, with `priority`
 * when given. An empty message, or an engine without `ariaNotify`, announces nothing.
 */
export function announce(
  target: Element | Document,
  message: string,
  priority?: "normal" | "high",
): void {
  if (message === "") return;
  const notifying = target as AriaNotifyTarget;
  if (typeof notifying.ariaNotify !== "function") return;
  if (priority === undefined) notifying.ariaNotify(message);
  else notifying.ariaNotify(message, { priority });
}

"use client";
// Screen-reader announcements (design/components/number-field.md 8.3, conventions 8): through
// `ariaNotify()` where the engine has it, otherwise through one module-level, visually hidden
// `role="status"` live region appended to `document.body` on first use. No part renders a live
// region of its own for these announcements.

/** `ariaNotify()` on an element or a document, where the engine has it (not in the DOM types yet). */
export interface AriaNotifyTarget {
  ariaNotify?: (announcement: string, options?: { priority?: "normal" | "high" }) => void;
}

type NotifyingElement = Element & AriaNotifyTarget;

/** How long the fallback region keeps a message before it is cleared, so a repeat is spoken. */
export const ANNOUNCE_CLEAR_DELAY = 1000;

const REGION_STYLE =
  "position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0; " +
  "overflow: hidden; clip-path: inset(50%); white-space: nowrap;";

/**
 * The delay between clearing the region and writing a message. A region inserted in the same task
 * as its first message is skipped by some screen readers, and an unchanged text is not spoken
 * again; clearing first and writing a tick later makes every message a fresh change.
 */
export const ANNOUNCE_WRITE_DELAY = 100;

let region: HTMLElement | null = null;
let clearTimer: ReturnType<typeof setTimeout> | undefined;
let writeTimer: ReturnType<typeof setTimeout> | undefined;

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
 * else the fallback live region (inserted on first use, cleared, then written
 * `ANNOUNCE_WRITE_DELAY` ms later and cleared again after `ANNOUNCE_CLEAR_DELAY`). An empty
 * message announces nothing; a newer message replaces one not yet written.
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
  el.textContent = "";
  if (clearTimer !== undefined) clearTimeout(clearTimer);
  if (writeTimer !== undefined) clearTimeout(writeTimer);
  clearTimer = undefined;
  writeTimer = setTimeout(() => {
    writeTimer = undefined;
    el.textContent = message;
    clearTimer = setTimeout(() => {
      clearTimer = undefined;
      el.textContent = "";
    }, ANNOUNCE_CLEAR_DELAY);
  }, ANNOUNCE_WRITE_DELAY);
}

/** Tests only: removes the fallback region and cancels its pending writes. */
export function resetAnnouncer(): void {
  if (clearTimer !== undefined) clearTimeout(clearTimer);
  if (writeTimer !== undefined) clearTimeout(writeTimer);
  clearTimer = undefined;
  writeTimer = undefined;
  region?.remove();
  region = null;
}

import type { RefObject } from "react";

const isDev = process.env.NODE_ENV !== "production";

/** The Roots that already warned about a second Trigger, keyed by their `triggerRef`. */
const warned = new WeakSet<RefObject<HTMLElement | null>>();

/**
 * Registers `element` as the Root's one Trigger (`triggerRef`, last mounted wins) and returns
 * the ref cleanup. In development, a second Trigger mounting while another is registered
 * warns once per Root (#113 API3): only the registered one is the popup's `source` (anchor,
 * focus return, `aria-expanded`), so a press on the other while open counts as outside.
 */
export function registerTrigger(
  triggerRef: RefObject<HTMLElement | null>,
  element: HTMLElement,
  part: string,
): () => void {
  // A Trigger's own cleanup clears the ref first (a remount, StrictMode, a ref change), so a
  // registered element here is another, still mounted Trigger.
  if (isDev && triggerRef.current !== null) {
    if (!warned.has(triggerRef)) {
      warned.add(triggerRef);
      console.error(
        `${part}: a second ${part} mounted in the same Root. A Root supports one ${part}: the ` +
          "last one mounted becomes the popup's anchor and focus-return target, and the others " +
          "act as outside the popup. Render one per Root, or a Root per trigger.",
      );
    }
  }
  triggerRef.current = element;
  return () => {
    if (triggerRef.current === element) triggerRef.current = null;
  };
}

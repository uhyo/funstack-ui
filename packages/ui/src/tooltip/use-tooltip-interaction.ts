"use client";
import { useEffect, useEffectEvent } from "react";

export interface TooltipInteractionOptions {
  readonly delay: number;
  readonly closeDelay: number;
  readonly disabled: boolean;
  /** The Trigger renders `interestfor` (flag on and not disabled). Re-runs the detection. */
  readonly interestForRequested: boolean;
}

/**
 * The cross-engine JS path of design section 2.2: hover / keyboard focus with delays,
 * `showPopover({ source })`, Escape and pointerdown-anywhere. Listeners go through
 * `addEventListener` (conventions 7.4) so they can be feature-detected away: where the trigger
 * renders `interestfor` and the element implements `interestForElement`, the browser owns the
 * whole interaction and nothing is attached.
 *
 * Open state is browser-owned (conventions 3.5): every decision reads
 * `popup.matches(":popover-open")`, never a copy. The document listeners are attached right after
 * `showPopover()` (the `toggle` event is queued as a task, so waiting for it would leave a window
 * in which an Escape or pointerdown does nothing) and detached when `toggle` reports a close,
 * including closes the library did not perform (native light dismiss of `popover="hint"`).
 */
export function useTooltipInteraction(
  trigger: HTMLElement | null,
  popup: HTMLElement | null,
  options: TooltipInteractionOptions,
): void {
  const getDelays = useEffectEvent(() => ({
    delay: options.delay,
    closeDelay: options.closeDelay,
  }));
  const { disabled, interestForRequested } = options;

  useEffect(() => {
    if (popup === null) return;
    // Disabling while open hides the popup on both paths (design section 13, Disabled row). On the
    // JS path the previous run's cleanup already did; on the native path nothing else would, and
    // removing `interestfor` does not close an open popover.
    if (disabled) {
      if (isOpen(popup)) popup.hidePopover();
      return;
    }
    if (trigger === null) return;
    // Native path (conventions 8): only when the flag put `interestfor` on the element, and per
    // element, so a `render`ed `<span>` (no `interestForElement`) keeps the JS path. Nothing is
    // attached here, Escape included: the browser's interest handling and the `hint` close watcher
    // decide, so in Chromium an Escape that closes the tooltip may also close an enclosing modal
    // `<dialog>` (the library cannot `preventDefault()` a keydown it never sees).
    if (
      interestForRequested &&
      trigger.hasAttribute("interestfor") &&
      "interestForElement" in trigger
    ) {
      return;
    }

    const doc = trigger.ownerDocument;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const clear = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    };
    const show = () => {
      if (isOpen(popup) || !popup.isConnected || !trigger.isConnected) return;
      popup.showPopover({ source: trigger });
      listenDocument(true);
    };
    const hide = () => {
      // A removed popover is already hidden (`isOpen` is false), so this never throws.
      if (!isOpen(popup)) return;
      popup.hidePopover();
      listenDocument(false);
    };
    const showLater = () => {
      clear();
      timer = setTimeout(() => {
        timer = undefined;
        show();
      }, getDelays().delay);
    };
    const hideLater = () => {
      clear();
      timer = setTimeout(() => {
        timer = undefined;
        hide();
      }, getDelays().closeDelay);
    };
    const hideNow = () => {
      clear();
      hide();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      clear();
      // Escape while closed passes through untouched.
      if (!isOpen(popup)) return;
      hide();
      // This Escape was the tooltip's: an enclosing modal `<dialog>` or `popover="auto"` menu
      // stays open (the close request sees a canceled keydown). A second Escape reaches them.
      event.preventDefault();
    };
    function listenDocument(listen: boolean) {
      if (listen) {
        doc.addEventListener("keydown", onKeyDown);
        doc.addEventListener("pointerdown", hideNow, true);
      } else {
        doc.removeEventListener("keydown", onKeyDown);
        doc.removeEventListener("pointerdown", hideNow, true);
      }
    }
    // Follows opens and closes the library did not perform; reads the DOM, not `newState`, so a
    // toggle task that is stale by the time it runs cannot detach the listeners of an open popup.
    const onToggle = () => {
      listenDocument(isOpen(popup));
    };
    const onTriggerEnter = (event: PointerEvent) => {
      // No hover on touch; the ARIA relation still works for screen-reader focus (design 5.3).
      if (event.pointerType !== "touch") showLater();
    };
    const onTriggerFocus = () => {
      // Pointer focus (a click) does not open; keyboard focus does (design 5.2).
      if (trigger.matches(":focus-visible")) showLater();
    };
    // The document listeners exist only while the popup is open, so before that the trigger
    // itself cancels a pending open: a click or Escape before `delay` elapses must not open the
    // tooltip afterwards. Once open, the document listeners do the hiding.
    const onTriggerKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") clear();
    };

    trigger.addEventListener("pointerenter", onTriggerEnter);
    trigger.addEventListener("pointerleave", hideLater);
    trigger.addEventListener("pointerdown", clear);
    trigger.addEventListener("keydown", onTriggerKeyDown);
    trigger.addEventListener("focus", onTriggerFocus);
    trigger.addEventListener("blur", hideLater);
    popup.addEventListener("pointerenter", clear);
    popup.addEventListener("pointerleave", hideLater);
    popup.addEventListener("toggle", onToggle);

    return () => {
      hideNow();
      listenDocument(false);
      trigger.removeEventListener("pointerenter", onTriggerEnter);
      trigger.removeEventListener("pointerleave", hideLater);
      trigger.removeEventListener("pointerdown", clear);
      trigger.removeEventListener("keydown", onTriggerKeyDown);
      trigger.removeEventListener("focus", onTriggerFocus);
      trigger.removeEventListener("blur", hideLater);
      popup.removeEventListener("pointerenter", clear);
      popup.removeEventListener("pointerleave", hideLater);
      popup.removeEventListener("toggle", onToggle);
    };
  }, [trigger, popup, disabled, interestForRequested]);
}

/** The popover's top-layer state, read from the DOM. A removed popover is never open. */
function isOpen(popup: HTMLElement): boolean {
  return popup.isConnected && popup.matches(":popover-open");
}

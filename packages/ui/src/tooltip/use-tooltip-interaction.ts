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
 * Open state is a local variable fed by the platform's `toggle` event, never React state
 * (conventions 3.5), so it also follows closes the library did not perform (native light dismiss
 * of `popover="hint"`).
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
    if (trigger === null || popup === null || disabled) return;
    // Native path (conventions 8): only when the flag put `interestfor` on the element, and per
    // element, so a `render`ed `<span>` (no `interestForElement`) keeps the JS path.
    if (
      interestForRequested &&
      trigger.hasAttribute("interestfor") &&
      "interestForElement" in trigger
    ) {
      return;
    }

    const doc = trigger.ownerDocument;
    let open = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const clear = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    };
    const showLater = () => {
      clear();
      timer = setTimeout(() => {
        timer = undefined;
        if (!open && popup.isConnected && trigger.isConnected) {
          popup.showPopover({ source: trigger });
        }
      }, getDelays().delay);
    };
    const hideLater = () => {
      clear();
      timer = setTimeout(() => {
        timer = undefined;
        // A removed popover is already hidden; `hidePopover()` would throw on it.
        if (open && popup.isConnected) popup.hidePopover();
      }, getDelays().closeDelay);
    };
    const hideNow = () => {
      clear();
      if (open && popup.isConnected) popup.hidePopover();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hideNow();
    };
    const listenDocument = (listen: boolean) => {
      if (listen) {
        doc.addEventListener("keydown", onKeyDown);
        doc.addEventListener("pointerdown", hideNow, true);
      } else {
        doc.removeEventListener("keydown", onKeyDown);
        doc.removeEventListener("pointerdown", hideNow, true);
      }
    };
    const onToggle = (event: Event) => {
      const next = (event as ToggleEvent).newState === "open";
      if (next === open) return;
      open = next;
      listenDocument(open);
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
    const onTriggerPointerDown = () => {
      if (!open) clear();
    };
    const onTriggerKeyDown = (event: KeyboardEvent) => {
      if (!open && event.key === "Escape") clear();
    };

    trigger.addEventListener("pointerenter", onTriggerEnter);
    trigger.addEventListener("pointerleave", hideLater);
    trigger.addEventListener("pointerdown", onTriggerPointerDown);
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
      trigger.removeEventListener("pointerdown", onTriggerPointerDown);
      trigger.removeEventListener("keydown", onTriggerKeyDown);
      trigger.removeEventListener("focus", onTriggerFocus);
      trigger.removeEventListener("blur", hideLater);
      popup.removeEventListener("pointerenter", clear);
      popup.removeEventListener("pointerleave", hideLater);
      popup.removeEventListener("toggle", onToggle);
    };
  }, [trigger, popup, disabled, interestForRequested]);
}

"use client";
import { useCallback, useRef } from "react";
import { eventSource } from "./invokers.js";
import { isPopoverOpen } from "./popover-open.js";
import type { PopoverRootValue } from "./use-overlay-root.js";

export interface InterestDismiss {
  /** `interest` at the popup: remembers the button that has interest in it. */
  onInterest(event: Event): void;
  /** `loseinterest` at the popup: the lost-interest hide (see `useInterestDismiss`). */
  onLoseInterest(event: Event): void;
  /** The opening `beforetoggle` the Root routes: whether it is the interest invoker's open. */
  noteOpen(event: ToggleEvent): void;
  /** The popup's `toggle` reported it hidden: the interest open is over. */
  noteClosed(): void;
  /** Whether the hide whose `toggle` arrived was the lost-interest hide; clears it. */
  takeLostInterest(): boolean;
  /** The popup element detached: cancels a pending hide and forgets everything. Stable. */
  reset(): void;
}

/**
 * Lost interest of an `interestfor` button naming the popup (library mode; Chromium; popover.md
 * lost-interest amendment), for `usePopoverPopup`. The platform hides only a popover its own
 * interest show opened (`invokedVia == kInterest`), and the library cancels that show and
 * re-shows with `showPopover({ source })`, so the platform never hides: the library does, as a
 * dismissal. Chromium also fires `loseinterest` from inside every hide of the popup while the
 * button has interest (Escape, script, the library's own close), before the state flips, and a
 * `hidePopover()` called from there re-enters the hide and loses its `toggle`: the hide waits one
 * task and runs only if the popup is still shown and still meant to be open, and returns no focus
 * to the Trigger. A pending interest open is cancelled instead.
 */
export function useInterestDismiss(ctx: PopoverRootValue): InterestDismiss {
  const isLibrary = ctx.mode === "library";
  const { popupRef } = ctx;
  // The button that has interest in the popup (`InterestEvent.source`), whether the current open
  // was that button's interest open, the task that hides the popup on its lost interest, and
  // whether the hide in flight is that one.
  const interestInvoker = useRef<Element | null>(null);
  const interestOpen = useRef(false);
  const interestHideTask = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const interestHide = useRef(false);

  const onInterest = (event: Event): void => {
    const element = popupRef.current;
    if (!isLibrary || element === null || event.target !== element) return;
    interestInvoker.current = eventSource(event);
  };

  const onLoseInterest = (event: Event): void => {
    const element = popupRef.current;
    if (!isLibrary || element === null || event.target !== element) return;
    const source = eventSource(event);
    if (source === null || source !== interestInvoker.current) return;
    interestInvoker.current = null;
    if (!interestOpen.current) return;
    if (isPopoverOpen(element)) {
      clearTimeout(interestHideTask.current);
      interestHideTask.current = setTimeout(() => {
        interestHideTask.current = undefined;
        if (!isPopoverOpen(element) || !ctx.intended()) return;
        // Interest regained meanwhile (the pointer came back): the popup stays.
        if (interestInvoker.current !== null) return;
        // Recorded right before the hide, so its one-task clear cannot run first.
        ctx.recordCloseIntent({ reason: "dismiss", event });
        interestHide.current = true;
        element.hidePopover();
      }, 0);
    } else if (ctx.intended()) {
      interestOpen.current = false;
      ctx.requestClose(event, "dismiss");
    }
  };

  const noteOpen = (event: ToggleEvent): void => {
    // Chromium dispatches `interest` and then the interest show in one step, so a show whose
    // `source` is the remembered interest invoker is that button's interest open.
    const source = eventSource(event);
    interestOpen.current = source !== null && source === interestInvoker.current;
  };

  const noteClosed = (): void => {
    interestOpen.current = false;
  };

  const takeLostInterest = (): boolean => {
    const lostInterest = interestHide.current;
    interestHide.current = false;
    return lostInterest;
  };

  const reset = useCallback((): void => {
    clearTimeout(interestHideTask.current);
    interestHideTask.current = undefined;
    interestHide.current = false;
    interestInvoker.current = null;
    interestOpen.current = false;
  }, []);

  return { onInterest, onLoseInterest, noteOpen, noteClosed, takeLostInterest, reset };
}

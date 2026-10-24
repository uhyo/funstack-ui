"use client";
import { useEffect, useEffectEvent } from "react";
import { syncPresence } from "../internal/sync-presence.js";
import { createDelayedPair } from "../internal/use-delayed-pair.js";
import { isPopoverOpen } from "../internal/popover-open.js";

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
 *
 * Skip-delay (design 6, wave 11): while another tooltip is showing anywhere in the document
 * (`[role="tooltip"]:popover-open`, FUNSTACK's or not), a hover or keyboard focus hides it and
 * opens this one at once. Stateless: the DOM is read at the start of each hover or focus.
 *
 * Warm opens (design amendment for #93, wave 12): on **both** paths one `beforetoggle` listener on
 * the popup writes `data-instant` by presence: on an open, iff another tooltip is showing at that
 * moment (the skip-delay condition); on a close, never. `beforetoggle` is synchronous and precedes
 * the top-layer insertion, so the open's first style recalc already sees the attribute and
 * `.tip[data-instant] { transition: none }` creates no transition (a later write would start and
 * cancel one). A DOM write, never React state (conventions 7.4). This hook's only listener on the
 * native path (the popup also has `useResolvedPlacement`'s `toggle`); it handles and cancels
 * nothing.
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
    // Attached before the `disabled` and native-path branches and removed last, so every open and
    // close (the library's below, the browser's, a consumer's through the ref) passes through it.
    const onBeforeToggle = (event: Event) => {
      const opening = (event as ToggleEvent).newState === "open";
      syncPresence(
        popup,
        "data-instant",
        opening && otherOpenTooltip(popup.ownerDocument, popup) !== null,
      );
    };
    popup.addEventListener("beforetoggle", onBeforeToggle);
    // The effect event is called (from the timers this effect sets up), never passed itself.
    const detach = attachInteraction(trigger, popup, disabled, interestForRequested, () =>
      getDelays(),
    );
    return () => {
      detach?.();
      popup.removeEventListener("beforetoggle", onBeforeToggle);
    };
  }, [trigger, popup, disabled, interestForRequested]);
}

/**
 * The rest of the effect: the JS path's interaction listeners, or nothing (disabled, no trigger,
 * the native path). Returns their cleanup, which hides an open popup first.
 */
function attachInteraction(
  trigger: HTMLElement | null,
  popup: HTMLElement,
  disabled: boolean,
  interestForRequested: boolean,
  getDelays: () => { delay: number; closeDelay: number },
): (() => void) | undefined {
  // Disabling while open hides the popup on both paths (design section 13, Disabled row). On the
  // JS path the previous run's cleanup already did; on the native path nothing else would, and
  // removing `interestfor` does not close an open popover.
  if (disabled) {
    if (isOpen(popup)) popup.hidePopover();
    return;
  }
  if (trigger === null) return;
  // Native path (conventions 8): only when the flag put `interestfor` on the element, and per
  // element, so a `render`ed `<span>` (no `interestForElement`) keeps the JS path. No
  // interaction listener is attached here (only the caller's `beforetoggle`), Escape included:
  // the browser's interest handling and the `hint` close watcher decide, so in Chromium an Escape that closes the tooltip may also close an enclosing modal
  // `<dialog>` (the library cannot `preventDefault()` a keydown it never sees).
  if (
    interestForRequested &&
    trigger.hasAttribute("interestfor") &&
    "interestForElement" in trigger
  ) {
    return;
  }

  const doc = trigger.ownerDocument;
  // One pending open or close at a time (the timer helper shared with Menu's hover intent).
  const timers = createDelayedPair();
  const clear = timers.cancel;
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
    timers.open(getDelays().delay, show);
  };
  const hideLater = () => {
    timers.close(getDelays().closeDelay, hide);
  };
  const hideNow = () => {
    clear();
    hide();
  };
  // Another tooltip is showing: open now and hide it, else wait `delay` (design 6). Show first,
  // so this popup's `beforetoggle` still sees the other one open (`data-instant`): the DOM of
  // the native path, where `hint` stacking hides it inside `showPopover` after `beforetoggle`.
  // With `hint` here too that already happened and the guard skips the call. The other Root
  // sees its `toggle` and detaches; its pending close timer finds it closed.
  const showSoon = () => {
    const other = isOpen(popup) ? null : otherOpenTooltip(doc, popup);
    if (other === null) {
      showLater();
      return;
    }
    clear();
    show();
    if (isOpen(other)) other.hidePopover();
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
    if (event.pointerType !== "touch") showSoon();
  };
  const onTriggerFocus = () => {
    // Pointer focus (a click) does not open; keyboard focus does (design 5.2).
    if (trigger.matches(":focus-visible")) showSoon();
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
}

/**
 * A tooltip popover other than `popup` that is showing in the document, or `null` (the warm
 * condition of design 6, the same one the native path's `:root:has()` rule reads). Walks the
 * tooltip popovers and asks each for `:popover-open` rather than one `querySelector`, which the
 * jsdom shim could not answer.
 */
function otherOpenTooltip(doc: Document, popup: HTMLElement): HTMLElement | null {
  for (const element of doc.querySelectorAll<HTMLElement>('[role="tooltip"][popover]')) {
    if (element !== popup && isOpen(element)) return element;
  }
  return null;
}

/** The popover's top-layer state, read from the DOM. A removed popover is never open. */
function isOpen(popup: HTMLElement): boolean {
  return popup.isConnected && isPopoverOpen(popup);
}

"use client";
import { useCallback, useEffect, useEffectEvent, useRef } from "react";
import type { RefObject } from "react";
import { consumeEscape, createEscapeRecord, isEscapeRequest } from "../internal/escape-key.js";
import { containsOpenLayer } from "../internal/overlay/open-layer.js";
import { isPopoverOpen } from "../internal/overlay/popover-open.js";
import type { PopoverRootValue } from "../internal/overlay/use-overlay-root.js";
import { createDelayedPair } from "../internal/use-delayed-pair.js";

export interface HoverCardInterestOptions {
  readonly delay: number;
  readonly closeDelay: number;
  readonly disabled: boolean;
  /** The Trigger writes `interestfor` (flag on, not disabled). Re-runs the detection. */
  readonly interestForRequested: boolean;
  /** "No open until fresh interest" (design 2.4), shared with the Popup's interception. */
  readonly suppressed: RefObject<boolean>;
  /**
   * The document listeners are wanted: the card is intended open or shown (optimistic or
   * committed `open`). They also attach at the dispatch of an open, before that commit.
   */
  readonly active: boolean;
}

/** The Root's requests and refs the interest tracking drives. */
type Root = Pick<
  PopoverRootValue,
  "intended" | "requestOpen" | "requestClose" | "recordCloseIntent" | "hiddenBeforeToggle"
>;

/** What the effect's attached listeners expose to the second effect. */
interface InterestController {
  /** Attach (`true`) or detach the window Escape and document outside-press listeners. */
  readonly listenDocument: (listen: boolean) => void;
}

/**
 * When a HoverCard opens and closes (design/components/hover-card.md 2.2 to 2.4): the JS path's
 * hover and keyboard-focus tracking with the `delay` / `closeDelay` timer pair (the helper
 * Tooltip and Menu use), or, where the Trigger carries `interestfor` and implements
 * `interestForElement`, nothing of that (the browser decides; the Popup hook routes its interest
 * show and lost interest). On both paths: a press on the Trigger closes the card and cancels a
 * coming open, Escape and a press outside close it while it is intended open, and the
 * "no open until fresh interest" flag. Listeners go through `addEventListener` (conventions 7.4),
 * so every `on*` prop of the Trigger passes through.
 *
 * Outcomes go through the Root: an open is `requestOpen(event, "activate")` (a request); a
 * close of a shown card is a dismissal (an intent recorded, then `hidePopover()`; the `toggle`
 * reports the fact, 2.5); a close while the open is still pending is
 * `requestClose(event, "dismiss")`, which supersedes the open.
 */
export function useHoverCardInterest(
  root: Root,
  trigger: HTMLElement | null,
  popup: HTMLElement | null,
  options: HoverCardInterestOptions,
): HoverCardInterest {
  const { disabled, interestForRequested, suppressed, active } = options;
  const getEnv = useEffectEvent(() => ({
    delay: options.delay,
    closeDelay: options.closeDelay,
    active: options.active,
    root,
  }));
  const controller = useRef<InterestController | null>(null);
  // `disabled` of the previous run: becoming disabled closes a shown card (design 3.1).
  const wasDisabled = useRef(disabled);

  useEffect(() => {
    if (popup === null) return;
    const becameDisabled = disabled && !wasDisabled.current;
    wasDisabled.current = disabled;
    const attached = attachInterest(trigger, popup, {
      disabled,
      interestForRequested,
      suppressed,
      // The effect event is called (from the listeners this effect sets up), never passed itself.
      env: () => getEnv(),
    });
    controller.current = attached;
    attached.listenDocument(getEnv().active);
    if (becameDisabled) attached.dismiss(undefined, false);
    return () => {
      attached.detach();
      if (controller.current === attached) controller.current = null;
    };
  }, [trigger, popup, disabled, interestForRequested, suppressed]);

  useEffect(() => {
    controller.current?.listenDocument(active);
  }, [active]);

  const listenDocumentNow = useCallback(() => {
    controller.current?.listenDocument(true);
  }, []);
  return { listenDocumentNow };
}

/** What the Root passes on to its parts. */
export interface HoverCardInterest {
  /**
   * Attach the window Escape and document outside-press listeners now: an open routed at the Popup's
   * `beforetoggle` (the flagged path's interest show), before its optimistic commit. Stable.
   */
  readonly listenDocumentNow: () => void;
}

/**
 * Blurs the element focused inside `popup` (the popup itself included), so a hide that must
 * return no focus to the Trigger leaves it on `<body>`: neither the Popup hook's focus-return
 * fallback nor a `hint` popover's own restore applies (design 6.2). Returns whether focus was
 * inside.
 */
export function blurFocusInside(popup: HTMLElement): boolean {
  const active = popup.ownerDocument.activeElement;
  if (!(active instanceof HTMLElement) || !popup.contains(active)) return false;
  active.blur();
  return true;
}

interface AttachOptions {
  readonly disabled: boolean;
  readonly interestForRequested: boolean;
  readonly suppressed: RefObject<boolean>;
  readonly env: () => {
    readonly delay: number;
    readonly closeDelay: number;
    readonly active: boolean;
    readonly root: Root;
  };
}

interface Attached extends InterestController {
  /** Close now (design 2.2, "close now"); `returnFocus`: Escape's focus return (6.2). */
  readonly dismiss: (event: Event | undefined, returnFocus: boolean) => void;
  readonly detach: () => void;
}

function attachInterest(
  trigger: HTMLElement | null,
  popup: HTMLElement,
  { disabled, interestForRequested, suppressed, env }: AttachOptions,
): Attached {
  const doc = popup.ownerDocument;
  const win = doc.defaultView;
  const timers = createDelayedPair();
  // A text selection dragged out of the card: the close timer starts at the release (2.2).
  let watchingRelease = false;

  const shown = (): boolean => popup.isConnected && isPopoverOpen(popup);

  const dismiss = (event: Event | undefined, returnFocus: boolean): void => {
    const { root } = env();
    stopWatchingRelease();
    if (shown()) {
      const active = doc.activeElement;
      const inside = active instanceof HTMLElement && active !== popup && popup.contains(active);
      const focusInside = inside || active === popup;
      // Lost interest and a press outside never focus the Trigger (6.2). Blurring first keeps
      // the platform from restoring focus too (a `hint` popover restores the element focused at
      // its show when focus is inside at the hide): focus goes to <body>, and a press then puts
      // it where the press lands.
      if (focusInside && !returnFocus && active instanceof HTMLElement) active.blur();
      // Escape with focus inside: the focus return that follows is not interest (2.4). Set
      // before the hide, which may restore focus to the Trigger itself (`hint`).
      if (focusInside && returnFocus) suppressed.current = true;
      // Recorded right before the hide, so its one-task clear cannot run first.
      root.recordCloseIntent({ reason: "dismiss", event });
      popup.hidePopover();
      if (
        focusInside &&
        returnFocus &&
        trigger !== null &&
        trigger.isConnected &&
        doc.activeElement !== trigger
      ) {
        trigger.focus();
      }
    } else if (root.intended() && !root.hiddenBeforeToggle()) {
      // Nothing shown yet: the open is still pending, and this supersedes it. Not a card that
      // was just hidden and whose `toggle` (the fact) has not arrived.
      root.requestClose(event, "dismiss");
    }
    timers.cancel();
  };

  // --- Document listeners, while the card is intended open ------------------------------------

  // Escape: recorded on the window in capture, as a global layer, and decided last (conventions
  // 15 rule 4), so a `stopPropagation()` anywhere does not keep the card open.
  const windowEscape = createEscapeRecord();
  const onWindowKeyDown = (event: KeyboardEvent): void => {
    if (!isEscapeRequest(event)) return;
    if (!shown() && !env().root.intended()) return;
    // The innermost closes first (2.6): a popover or dialog open inside the card takes this
    // Escape; the next one closes the card. Read now: an `auto` popover's close watcher closes
    // it after the dispatch.
    const standDown = containsOpenLayer(popup, event);
    windowEscape.record(
      event,
      () => {
        const isShown = shown();
        if (standDown || (!isShown && !env().root.intended())) return;
        suppressed.current = true;
        dismiss(event, true);
        // This Escape was the card's: an enclosing modal dialog or `auto` popover, a non-modal
        // Dialog or a toast stays open.
        if (isShown) consumeEscape(event);
      },
      { global: true },
    );
  };
  // The presses the document listener handled; the Trigger's own listener sees them next.
  const handled = new WeakSet<Event>();
  const onDocumentPointerDown = (event: PointerEvent): void => {
    const path = event.composedPath();
    if (path.includes(popup)) return;
    if (!shown() && !env().root.intended()) return;
    if (trigger !== null && path.includes(trigger)) suppressed.current = true;
    handled.add(event);
    dismiss(event, false);
  };
  let listening = false;
  const listenDocument = (listen: boolean): void => {
    if (listen === listening) return;
    listening = listen;
    if (listen) {
      win?.addEventListener("keydown", onWindowKeyDown, true);
      doc.addEventListener("pointerdown", onDocumentPointerDown, true);
    } else {
      win?.removeEventListener("keydown", onWindowKeyDown, true);
      windowEscape.cancel();
      doc.removeEventListener("pointerdown", onDocumentPointerDown, true);
    }
  };

  // --- Timers (the JS path) -------------------------------------------------------------------

  const startOpen = (event: Event): void => {
    const { root, delay } = env();
    // Already intended open (the pointer came back, Shift+Tab from the card): stay.
    if (root.intended()) {
      timers.cancel();
      return;
    }
    timers.open(delay, () => {
      if (trigger === null || !trigger.isConnected || !popup.isConnected) return;
      if (env().root.intended()) return;
      listenDocument(true);
      env().root.requestOpen(event, "activate");
    });
  };
  const startClose = (event: Event): void => {
    const { root, closeDelay } = env();
    // Nothing intended and nothing shown: only a coming open to cancel.
    if (!root.intended() && !shown()) {
      timers.cancel();
      return;
    }
    timers.close(closeDelay, () => dismiss(event, false));
  };

  function stopWatchingRelease(): void {
    if (!watchingRelease) return;
    watchingRelease = false;
    doc.removeEventListener("pointerup", onRelease, true);
  }
  function onRelease(event: PointerEvent): void {
    stopWatchingRelease();
    startClose(event);
  }

  // --- Trigger and Popup listeners --------------------------------------------------------------

  const cleanups: (() => void)[] = [];
  const listen = <K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
  ): void => {
    target.addEventListener(type, listener);
    cleanups.push(() => target.removeEventListener(type, listener));
  };

  if (trigger !== null) {
    // Both paths: a press on the Trigger closes the card and cancels a coming open, and nothing
    // opens until fresh interest (2.4). The document's capture listener has already closed a
    // card that is intended open; this covers the open timer and the flagged path's interest.
    listen(trigger, "pointerdown", (event) => {
      suppressed.current = true;
      if (handled.has(event)) timers.cancel();
      else dismiss(event, false);
    });
    // Escape before anything is intended: cancel the coming open. Recorded in capture and
    // decided last (conventions 15 rule 4), so a listener inside that stops the event does not
    // keep the timer running; the event is left alone.
    const triggerEscape = createEscapeRecord();
    const onTriggerKeyDown = (event: KeyboardEvent): void => {
      if (!isEscapeRequest(event)) return;
      triggerEscape.record(event, () => {
        suppressed.current = true;
        timers.cancel();
      });
    };
    trigger.addEventListener("keydown", onTriggerKeyDown, true);
    cleanups.push(() => {
      trigger.removeEventListener("keydown", onTriggerKeyDown, true);
      triggerEscape.cancel();
    });
    // Fresh interest: the pointer comes back, or focus leaves (and later returns).
    const freshInterest = () => {
      suppressed.current = false;
    };
    listen(trigger, "pointerleave", freshInterest);
    listen(trigger, "blur", freshInterest);
    listen(trigger, "pointerenter", freshInterest);

    // Flagged path (conventions 8): the browser decides when interest starts and ends where the
    // flag wrote `interestfor` and the element implements it; a `render`ed element without
    // `interestForElement` keeps the JS path.
    const native =
      interestForRequested &&
      trigger.hasAttribute("interestfor") &&
      "interestForElement" in trigger;
    if (!native && !disabled) {
      listen(trigger, "pointerenter", (event) => {
        // No hover on touch (7): a tap follows the link.
        if (event.pointerType !== "touch") startOpen(event);
      });
      listen(trigger, "focus", (event) => {
        // Keyboard focus only; the library's own focus return is not interest (2.4).
        if (suppressed.current || !trigger.matches(":focus-visible")) return;
        startOpen(event);
      });
      listen(trigger, "pointerleave", startClose);
      listen(trigger, "blur", startClose);
      listen(popup, "pointerenter", () => {
        stopWatchingRelease();
        timers.cancelClose();
      });
      listen(popup, "pointerleave", (event) => {
        if (!shown()) return;
        if (event.buttons !== 0) {
          if (!watchingRelease) {
            watchingRelease = true;
            doc.addEventListener("pointerup", onRelease, true);
          }
          return;
        }
        startClose(event);
      });
      listen(popup, "focusin", () => timers.cancelClose());
      listen(popup, "focusout", (event) => {
        // The platform's focus fixup after a hide is no interest change.
        if (!shown()) return;
        const next = event.relatedTarget;
        if (next instanceof Node && (popup.contains(next) || trigger.contains(next))) return;
        startClose(event);
      });
    }
  }

  return {
    listenDocument,
    dismiss,
    detach: () => {
      timers.cancel();
      stopWatchingRelease();
      listenDocument(false);
      for (const cleanup of cleanups) cleanup();
    },
  };
}

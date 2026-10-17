"use client";
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import type { RefObject, ViewTransitionClass } from "react";
import { exitAnimations, useExitAnimation } from "./use-exit-animation.js";
import type { PopoverRootValue } from "./use-popover-root.js";

export interface UsePopoverPopupOptions {
  /** Public name of the part for development warnings (`"Popover.Popup"`). */
  readonly part: string;
  /** Element to focus on open: a ref, or a selector resolved inside the popup (design 6.1). */
  readonly initialFocus: RefObject<HTMLElement | null> | string | undefined;
  /**
   * Replaces `initialFocus` with a function called right before each library open (Menu: the
   * first or last item by open cause). `null` leaves the choice to the platform.
   */
  readonly resolveInitialFocus?: (popup: HTMLElement) => HTMLElement | null;
  readonly keepMounted: boolean | undefined;
  /** The consumer's `transition`; decides how a library-driven close keeps its content (4.4). */
  readonly transition: ViewTransitionClass | undefined;
  /** Runs after the library's own `beforetoggle` handling (Menu: focus bookkeeping). */
  readonly onBeforeToggle?: (event: ToggleEvent) => void;
  /** Runs after the library's own `toggle` handling (Menu: close the stack on Tab-out). */
  readonly onToggle?: (event: ToggleEvent) => void;
}

export interface PopoverPopupHook {
  /** Callback ref for the popup element; pass as `useRender`'s `ref`. */
  readonly setElement: (element: HTMLElement) => () => void;
  /**
   * Whether the children are shown: committed open, or held while the hide animates (4.4).
   * Library mode only; JS-free mode always renders them.
   */
  readonly visible: boolean;
  /** Whether focus was inside the popup when its last close began (`beforetoggle`, 6.2). */
  readonly focusWasInside: RefObject<boolean>;
}

const isDev = process.env.NODE_ENV !== "production";

function isPopoverOpen(element: Element): boolean {
  try {
    return element.matches(":popover-open");
  } catch {
    return false;
  }
}

/** Resolves `initialFocus` against the popup (a ref, or a selector inside the popup). */
function resolveInitialFocus(
  popup: HTMLElement,
  initialFocus: RefObject<HTMLElement | null> | string,
): HTMLElement | null {
  if (typeof initialFocus === "string") return popup.querySelector<HTMLElement>(initialFocus);
  return initialFocus.current;
}

const TABBABLE =
  "button, input, select, textarea, a[href], area[href], summary, iframe, audio[controls], " +
  "video[controls], [contenteditable], [tabindex]";

/** The first sequentially focusable descendant: enabled, not `tabindex="-1"`, rendered. */
function firstTabbable(popup: HTMLElement): HTMLElement | null {
  for (const element of popup.querySelectorAll<HTMLElement>(TABBABLE)) {
    if (element.tabIndex < 0 || element.matches(":disabled")) continue;
    if (element.contentEditable === "false" && !element.hasAttribute("tabindex")) continue;
    if (typeof element.checkVisibility === "function" && !element.checkVisibility()) continue;
    return element;
  }
  return null;
}

/**
 * The fallback of design 6.1, after the fact and feature-independent: `showPopover()` on a
 * `<dialog>` runs the dialog focusing steps (HTML; verified in Chromium and Firefox). Where focus
 * did not move inside (an engine that skips them, or the jsdom shim), focus what they would have:
 * the `initialFocus` target, else the first sequentially focusable descendant, else the popup.
 * A no-op wherever the platform already did it. A `<div>` popup keeps focus on the Trigger.
 */
function ensureDialogFocus(popup: HTMLElement, target: HTMLElement | null): void {
  if (popup.tagName !== "DIALOG" || !isPopoverOpen(popup)) return;
  const active = popup.ownerDocument.activeElement;
  if (active !== null && popup.contains(active)) return;
  const next = target ?? firstTabbable(popup);
  if (next !== null) {
    next.focus();
    return;
  }
  if (!popup.hasAttribute("tabindex")) popup.setAttribute("tabindex", "-1");
  popup.focus();
}

/** Whether `element` sits inside a popover that is not shown (an outer popup that closed). */
function insideHiddenPopover(element: Element): boolean {
  for (let node = element.parentElement; node !== null; node = node.parentElement) {
    if (node.hasAttribute("popover") && !isPopoverOpen(node)) return true;
  }
  return false;
}

/**
 * Everything in a popover-like Popup except rendering (design/components/popover.md 14.2): mount
 * reconciliation, the apply effect, the native `beforetoggle` / `toggle` / `command` listeners,
 * close intents, the nested focus-return fallback, the JS-free `aria-expanded` sync, the
 * deferred unmount while a hide animates, and `initialFocus`. Shared by Popover and Menu.
 */
export function usePopoverPopup(
  ctx: PopoverRootValue,
  options: UsePopoverPopupOptions,
): PopoverPopupHook {
  const { part, initialFocus, transition, onBeforeToggle: onBeforeToggleOption } = options;
  const onToggleOption = options.onToggle;
  const isLibrary = ctx.mode === "library";
  const { popupRef, triggerRef } = ctx;
  const [popup, setPopup] = useState<HTMLElement | null>(null);

  // The opening `beforetoggle` lets this one through: the library's own `showPopover()`.
  const opening = useRef(false);
  // Set by the synchronous `beforetoggle` of a close, cleared by `toggle` a task later: the
  // popup is hidden but its `toggle` has not arrived, so the apply effect must not re-open it
  // from a commit that lands in between (design 2.5).
  const awaitingClose = useRef(false);
  const focusWasInside = useRef(false);
  const warnedFocus = useRef(false);

  // --- `held`: children stay mounted while the hide animates (design 4.4) -------------------

  const exit = useExitAnimation();

  // A library-driven close commits `false` first and hides in the layout effect, so without
  // `transition` the children are held through the close commit ("previous value in state").
  // With `transition` the close commit unmounts them inside the view transition, whose old
  // snapshot carries the content out.
  const [prevCommitted, setPrevCommitted] = useState(ctx.committed);
  if (prevCommitted !== ctx.committed) {
    setPrevCommitted(ctx.committed);
    if (isLibrary && prevCommitted && transition === undefined) exit.holdDuringRender();
  }

  // --- Element ------------------------------------------------------------------------------

  const setElement = useCallback(
    (element: HTMLElement) => {
      if (isDev && element.tagName !== "DIALOG" && element.tagName !== "DIV") {
        console.error(
          `${part}: expected to render a <dialog> or a <div> but got ` +
            `<${element.tagName.toLowerCase()}>.`,
        );
      }
      popupRef.current = element;
      setPopup(element);
      return () => {
        if (popupRef.current === element) popupRef.current = null;
        setPopup(null);
      };
    },
    [part, popupRef],
  );

  const syncExpanded = (element: HTMLElement): void => {
    // JS-free mode only (design 9): read the DOM, not `newState`, so a stale task cannot lie.
    triggerRef.current?.setAttribute("aria-expanded", String(isPopoverOpen(element)));
  };

  // --- Opening ------------------------------------------------------------------------------

  const resolveFocusTarget = (element: HTMLElement): HTMLElement | null => {
    if (options.resolveInitialFocus !== undefined) {
      const resolved = options.resolveInitialFocus(element);
      return resolved !== null && element.contains(resolved) ? resolved : null;
    }
    if (initialFocus === undefined) return null;
    const target = resolveInitialFocus(element, initialFocus);
    if (target !== null && element.contains(target)) return target;
    if (isDev && !warnedFocus.current) {
      warnedFocus.current = true;
      console.error(
        target === null
          ? `${part}: \`initialFocus\` resolved to no element; the platform picks the focus target.`
          : `${part}: \`initialFocus\` is outside the popup; the platform picks the focus target.`,
      );
    }
    return null;
  };

  const showPopup = (element: HTMLElement): void => {
    const target = resolveFocusTarget(element);
    // The popover focusing steps honour `autofocus` (and run the dialog focusing steps for a
    // <dialog>); React drops `autoFocus` on client-rendered content. Never `.focus()` (6.1).
    const added = target !== null && !target.hasAttribute("autofocus");
    if (added) target.setAttribute("autofocus", "");
    opening.current = true;
    try {
      const source = triggerRef.current;
      element.showPopover(source !== null && source.isConnected ? { source } : undefined);
    } finally {
      opening.current = false;
      if (added) target.removeAttribute("autofocus");
    }
    ensureDialogFocus(element, target);
  };

  // Mount reconciliation (design 2.4): a click before hydration opened the popover natively.
  // Runs before the apply effect; the dispatch makes the apply effect wait for it.
  const reconcileOnMount = useEffectEvent(() => {
    const element = popupRef.current;
    if (element === null) return;
    if (!isLibrary) {
      syncExpanded(element);
      return;
    }
    if (isPopoverOpen(element)) ctx.requestOpen(undefined, "platform");
  });
  useLayoutEffect(() => {
    reconcileOnMount();
  }, []);

  // The apply effect (design 2.5): after every commit, once nothing is in flight, the DOM
  // follows committed state. One effect covers the normal open, `defaultOpen`, a controlled open
  // or close, a library-driven close after `openChangeAction(false)` settled, the re-open of a
  // refused dismissal, and the close after a refused or failed pre-hydration open.
  useLayoutEffect(() => {
    if (!isLibrary) return;
    const element = popupRef.current;
    if (element === null || !element.isConnected) return;
    if (!ctx.pending && ctx.latestInFlight() === null) {
      const shown = isPopoverOpen(element);
      if (ctx.committed && !shown) {
        if (!awaitingClose.current) showPopup(element);
      } else if (!ctx.committed && shown) {
        // An echo: the `toggle` listener finds `false` intended and skips the dispatch.
        ctx.recordCloseIntent(undefined);
        element.hidePopover();
      }
    }
    // A hold the close commit set (or a dismissal's notification commit) that no hide animation
    // is going to release: the popup is already hidden and its `toggle` has been handled.
    if (
      exit.held &&
      !ctx.committed &&
      !exit.waiting() &&
      !awaitingClose.current &&
      !isPopoverOpen(element)
    ) {
      exit.release();
    }
  });

  // JS-free mode: there is no "right before showPopover()" (the browser runs the command), so the
  // `autofocus` attribute stays on the target while it is mounted (as Dialog).
  useEffect(() => {
    if (isLibrary || initialFocus === undefined || popup === null) return;
    const target = resolveInitialFocus(popup, initialFocus);
    if (target === null || !popup.contains(target) || target.hasAttribute("autofocus")) return;
    target.setAttribute("autofocus", "");
    return () => target.removeAttribute("autofocus");
  }, [isLibrary, initialFocus, popup]);

  // --- Native listeners (conventions 7.4; filtered on target: React 19.3.1 emulates bubbling
  // of `toggle`, and a nested popover's events reach this element through the real DOM too) ---

  const onBeforeToggle = useEffectEvent((event: Event) => {
    const element = popupRef.current;
    if (element === null || event.target !== element) return;
    const toggle = event as ToggleEvent;
    if (toggle.newState === "open") {
      // Every open the library did not start itself is routed through the Root (design 2.2):
      // a foreign `show-popover` / `toggle-popover` invoker, a script `showPopover()`.
      if (isLibrary && !opening.current) {
        event.preventDefault();
        ctx.requestOpen(event, "activate");
      }
    } else {
      awaitingClose.current = true;
      const active = element.ownerDocument.activeElement;
      focusWasInside.current = active !== null && element.contains(active);
    }
    onBeforeToggleOption?.(toggle);
  });

  const onToggle = useEffectEvent((event: Event) => {
    const element = popupRef.current;
    if (element === null || event.target !== element) return;
    awaitingClose.current = false;
    if (!isLibrary) syncExpanded(element);

    if (!isPopoverOpen(element)) {
      // Focus return for what the platform leaves out (design 6.2): a nested popover restores
      // nothing, and an opener that is gone leaves focus inside the hidden popup.
      const doc = element.ownerDocument;
      const active = doc.activeElement;
      const wasInside = focusWasInside.current;
      focusWasInside.current = false;
      if (wasInside && (active === null || active === doc.body || element.contains(active))) {
        const trigger = triggerRef.current;
        if (trigger !== null && trigger.isConnected && !insideHiddenPopover(trigger)) {
          trigger.focus();
        } else if (active instanceof HTMLElement && active !== doc.body) {
          active.blur();
        }
      }

      const intent = ctx.takeCloseIntent();
      if (isLibrary) {
        // `false` already intended: the library's own hide (or a dismissal during a pending
        // part-initiated close). With `transition` such a close needs no hold (4.4).
        const echo = !ctx.intended();
        if (!echo || transition === undefined) {
          const animations = exitAnimations(element);
          if (animations.length > 0) {
            // Before the notification, so its commit keeps the children (urgent, internal).
            exit.holdUntil(animations);
          } else {
            // Nothing animates (Firefox, or no CSS exit): release a hold now, in a transition;
            // the commit is invisible, the popup is already `display: none`.
            exit.release();
          }
        }
        ctx.notifyClosed(intent?.event ?? event, intent?.reason ?? "dismiss");
      }
    }
    onToggleOption?.(event as ToggleEvent);
  });

  const onCommand = useEffectEvent((event: Event) => {
    const element = popupRef.current;
    if (element === null || event.target !== element || event.defaultPrevented) return;
    const command = String((event as Event & { command?: string }).command ?? "").toLowerCase();
    // A foreign invoker closing the popup (design 2.3). Opens are caught at `beforetoggle`.
    if (command === "hide-popover" || (command === "toggle-popover" && isPopoverOpen(element))) {
      ctx.recordCloseIntent({ reason: "activate", event });
    }
  });

  useEffect(() => {
    if (popup === null) return;
    const listeners: [string, EventListener][] = [
      ["beforetoggle", onBeforeToggle],
      ["toggle", onToggle],
      ["command", onCommand],
    ];
    for (const [type, listener] of listeners) popup.addEventListener(type, listener);
    return () => {
      for (const [type, listener] of listeners) popup.removeEventListener(type, listener);
    };
  }, [popup]);

  // Development check (design 9): `role="dialog"` needs a name once the popup is (or can be)
  // shown.
  const shown = !isLibrary || ctx.committed;
  const warnedName = useRef(false);
  useEffect(() => {
    if (!isDev || popup === null || !shown || warnedName.current) return;
    if (popup.hasAttribute("aria-label")) return;
    const labelledBy = (popup.getAttribute("aria-labelledby") ?? "").split(/\s+/);
    const doc = popup.ownerDocument;
    if (labelledBy.some((id) => id !== "" && doc.getElementById(id) !== null)) return;
    const role = popup.getAttribute("role");
    if (role !== "dialog" && role !== "alertdialog" && role !== "menu") return;
    warnedName.current = true;
    console.error(
      `${part}: the popup has no accessible name. Render a Title, or give the Popup an ` +
        "`aria-label`.",
    );
  }, [popup, shown, part]);

  return { setElement, visible: ctx.committed || exit.held, focusWasInside };
}

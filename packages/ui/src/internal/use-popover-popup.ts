"use client";
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode, RefObject, ViewTransitionClass } from "react";
import { useContentFocusProbe } from "./content-focus-probe.js";
import { useExitAnimation } from "./use-exit-animation.js";
import type { PopoverRootValue } from "./use-popover-root.js";
import { isPopoverOpen } from "./popover-open.js";
import { useLatest } from "./use-latest.js";
import { useElementCheck } from "./use-element-check.js";

export interface UsePopoverPopupOptions {
  /** Public name of the part for development warnings (`"Popover.Popup"`). */
  readonly part: string;
  /** Element to focus on open: a ref, or a selector resolved inside the popup (design 6.1). */
  readonly initialFocus: RefObject<HTMLElement | null> | string | undefined;
  /**
   * Replaces `initialFocus` with a function called right before each library open (Menu: the
   * first or last item by open cause). `null` leaves the choice to the platform. A
   * `QuietFocusTarget` asks for focus without the focus ring (a pointer-opened menu).
   */
  readonly resolveInitialFocus?: (popup: HTMLElement) => HTMLElement | QuietFocusTarget | null;
  readonly keepMounted: boolean | undefined;
  /** The consumer's `transition`; decides how a library-driven close keeps its content (4.4). */
  readonly transition: ViewTransitionClass | undefined;
  /** Runs after the library's own `beforetoggle` handling (Menu: focus bookkeeping). */
  readonly onBeforeToggle?: (event: ToggleEvent) => void;
  /** Runs after the library's own `toggle` handling (Menu: the outside right-click listeners). */
  readonly onToggle?: (event: ToggleEvent) => void;
  /**
   * The `source` of each library `showPopover({ source })`, read right before the call. Default:
   * the registered Trigger. Menu passes the ContextTrigger region for a point open
   * (design/components/context-menu.md 14).
   */
  readonly source?: () => HTMLElement | null;
}

/**
 * An initial focus target opened by a pointer: where the engine reads `focus({ focusVisible })`,
 * the library focuses it with `focusVisible: false` right after `showPopover()` instead of
 * writing `autofocus` (WebKit shows the ring for an `autofocus` target after a click; review H1).
 * Elsewhere it is an ordinary target.
 */
export interface QuietFocusTarget {
  readonly element: HTMLElement;
  readonly focusVisible: false;
}

export interface PopoverPopupHook {
  /** Callback ref for the popup element; pass as `useRender`'s `ref`. */
  readonly setElement: (element: HTMLElement) => () => void;
  /**
   * Whether the children are shown: committed open, or held while the hide animates (4.4).
   * Library mode only; JS-free mode always renders them.
   */
  readonly visible: boolean;
  /**
   * Wraps the library-mode content: call it only while `visible` (`visible ? wrapContent(x) :
   * null`), or inside the `<Activity>` for `keepMounted`. When a close commit unmounts the
   * content while it holds focus (a library-driven close with `transition`, where the focused
   * element is gone before `hidePopover()` runs and the platform restores nothing), the hide
   * that follows returns focus to the Trigger (design 6.2).
   */
  readonly wrapContent: (children: ReactNode) => ReactNode;
  /**
   * Re-shows a shown popup in place (`hidePopover()` + `showPopover({ source })` under the
   * opening flag, initial focus resolved again): Menu's move to a new point
   * (design/components/context-menu.md 4.3). The platform coalesces the two toggles into one
   * `toggle` (`open` to `open`), so nothing is dispatched. No-op (`false`) when the popup is not
   * shown.
   */
  readonly reshow: () => boolean;
}

const isDev = process.env.NODE_ENV !== "production";

let focusVisibleOption: boolean | undefined;

/**
 * The engine reads the `focusVisible` member of `focus()`'s options (Chromium 145, Firefox 104,
 * Safari 18.4). Detected once through a getter: the bindings convert the dictionary before the
 * method runs, so a detached element is enough and nothing is focused.
 */
function supportsFocusVisibleOption(doc: Document): boolean {
  if (focusVisibleOption === undefined) {
    let read = false;
    try {
      doc.createElement("div").focus({
        get focusVisible() {
          read = true;
          return false;
        },
      } as FocusOptions);
    } catch {
      read = false;
    }
    focusVisibleOption = read;
  }
  return focusVisibleOption;
}

/** Resolves `initialFocus` against the popup (a ref, or a selector inside the popup). */
function resolveInitialFocus(
  popup: HTMLElement,
  initialFocus: RefObject<HTMLElement | null> | string,
): HTMLElement | null {
  if (typeof initialFocus === "string") return popup.querySelector<HTMLElement>(initialFocus);
  return initialFocus.current;
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
 * close intents, the focus-return fallback, the JS-free `aria-expanded` sync, the deferred
 * unmount while a hide animates, and `initialFocus`. Shared by Popover and Menu.
 */
export function usePopoverPopup(
  ctx: PopoverRootValue,
  options: UsePopoverPopupOptions,
): PopoverPopupHook {
  const { part, initialFocus, transition, onBeforeToggle: onBeforeToggleOption } = options;
  const onToggleOption = options.onToggle;
  const isLibrary = ctx.mode === "library";
  const { popupRef, triggerRef } = ctx;

  // The opening `beforetoggle` lets this one through: the library's own `showPopover()`.
  const opening = useRef(false);
  // Set across `reshow()`: the show is not a new open.
  const reshowing = useRef(false);
  // Set by the synchronous `beforetoggle` of a close, cleared by `toggle` a task later: the
  // popup is hidden but its `toggle` has not arrived, so the apply effect must not re-open it
  // from a commit that lands in between (design 2.5).
  const awaitingClose = useRef(false);
  // Whether focus was inside the popup when its last close began (design 6.2 rule 1).
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

  // Whether the content unmounted while holding focus since the popup was last shown (H1).
  const contentProbe = useContentFocusProbe(popupRef);
  const { wrapContent } = contentProbe;

  const syncExpanded = (element: HTMLElement): void => {
    // JS-free mode only (design 9): read the DOM, not `newState`, so a stale task cannot lie.
    triggerRef.current?.setAttribute("aria-expanded", String(isPopoverOpen(element)));
  };

  /**
   * Design 6.2 rule 2, for a close that began with focus inside: when focus is now on `<body>`
   * or still inside the hidden popup, focus the Trigger (connected, not inside a hidden
   * popover), else blur what holds focus.
   */
  const returnFocus = (element: HTMLElement): void => {
    const doc = element.ownerDocument;
    const active = doc.activeElement;
    if (active !== null && active !== doc.body && !element.contains(active)) return;
    const trigger = triggerRef.current;
    if (trigger !== null && trigger.isConnected && !insideHiddenPopover(trigger)) {
      trigger.focus();
    } else if (active instanceof HTMLElement && active !== doc.body) {
      active.blur();
    }
  };

  // --- Opening ------------------------------------------------------------------------------

  const resolveFocusTarget = (element: HTMLElement): HTMLElement | QuietFocusTarget | null => {
    if (options.resolveInitialFocus !== undefined) {
      const resolved = options.resolveInitialFocus(element);
      if (resolved === null) return null;
      const target = resolved instanceof HTMLElement ? resolved : resolved.element;
      return element.contains(target) ? resolved : null;
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
    const resolved = resolveFocusTarget(element);
    const target =
      resolved === null || resolved instanceof HTMLElement ? resolved : resolved.element;
    // A pointer open asks for no focus ring: `focus({ focusVisible: false })` after the show,
    // where the engine reads that option (QuietFocusTarget).
    const quiet =
      target !== null &&
      !(resolved instanceof HTMLElement) &&
      supportsFocusVisibleOption(element.ownerDocument);
    // Otherwise the popover focusing steps honour `autofocus` (and run the dialog focusing steps
    // for a <dialog>, in every engine); React drops `autoFocus` on client-rendered content.
    // Never `.focus()` (6.1) except for the quiet target above.
    const added = target !== null && !quiet && !target.hasAttribute("autofocus");
    if (added) target.setAttribute("autofocus", "");
    opening.current = true;
    try {
      const source = options.source !== undefined ? options.source() : triggerRef.current;
      element.showPopover(source != null && source.isConnected ? { source } : undefined);
    } finally {
      opening.current = false;
      if (added) target.removeAttribute("autofocus");
    }
    if (quiet && isPopoverOpen(element) && element.contains(target)) {
      target.focus({ focusVisible: false } as FocusOptions);
    }
  };

  const reshow = (): boolean => {
    const element = popupRef.current;
    if (!isLibrary || element === null || !isPopoverOpen(element)) return false;
    // The hide half's `beforetoggle` records `awaitingClose` / `focusWasInside`; the coalesced
    // `toggle` finds the popup open again, so it clears `awaitingClose`, returns no focus and
    // notifies nothing. The opening flag covers both halves (conventions 3.5, the move).
    opening.current = true;
    reshowing.current = true;
    try {
      element.hidePopover();
      showPopup(element);
    } finally {
      opening.current = false;
      reshowing.current = false;
    }
    // Whether or not the engine fires the coalesced `toggle`, the close bookkeeping of the hide
    // half is void: the popup is open again.
    awaitingClose.current = false;
    focusWasInside.current = false;
    return isPopoverOpen(element);
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

  // The apply effect (design 2.5): after every commit that re-renders the Popup, once nothing is
  // in flight, the DOM follows committed state. Since the Root's value is memoised (#48) an
  // unrelated Root render does not re-render the Popup, so this does not run for it; every path
  // that makes the DOM diverge from state goes through a dispatch, whose `pending` flips re-render
  // the Popup (review of #48, finding 4). Do not rely on an unrelated render to re-apply state.
  // One effect covers the normal open, `defaultOpen`, a controlled open
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
        // The close commit may have unmounted the focused content before the hide (H1): the
        // platform restores focus only from inside the popover, so do it now.
        if (focusWasInside.current) returnFocus(element);
      }
    }
    // Content that unmounted while the popup stays open (not a close): forget it.
    if (ctx.committed && isPopoverOpen(element)) contentProbe.forget();
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

  // --- Native listeners (conventions 7.4; filtered on target: React 19.3.1 emulates bubbling
  // of `toggle`, and a nested popover's events reach this element through the real DOM too) ---

  const onBeforeToggle = (event: Event): void => {
    const element = popupRef.current;
    if (element === null || event.target !== element) return;
    const toggle = event as ToggleEvent;
    if (toggle.newState === "open") {
      // Every open the library did not start itself is routed through the Root (design 2.2):
      // a foreign `show-popover` / `toggle-popover` invoker, a script `showPopover()`.
      if (isLibrary && !opening.current) {
        event.preventDefault();
        ctx.requestOpen(event, "activate");
      } else if (!reshowing.current) {
        // A Close action that resolves after this open must not close it (design 3.4). A re-show
        // (Menu's move) is the same open: an item action pending across it still closes.
        ctx.nextOpenGeneration();
      }
      contentProbe.forget();
    } else {
      awaitingClose.current = true;
      exit.recordBaseline(element);
      const active = element.ownerDocument.activeElement;
      focusWasInside.current =
        (active !== null && element.contains(active)) || contentProbe.hadFocus();
      contentProbe.forget();
    }
    onBeforeToggleOption?.(toggle);
  };

  const onToggle = (event: Event): void => {
    const element = popupRef.current;
    if (element === null || event.target !== element) return;
    awaitingClose.current = false;
    if (!isLibrary) syncExpanded(element);

    if (!isPopoverOpen(element)) {
      // Focus return for what the platform leaves out (design 6.2): a nested popover restores
      // nothing, and an opener that is gone leaves focus inside the hidden popup.
      const wasInside = focusWasInside.current;
      focusWasInside.current = false;
      if (wasInside) returnFocus(element);

      const intent = ctx.takeCloseIntent();
      if (isLibrary) {
        // `false` already intended: the library's own hide (or a dismissal during a pending
        // part-initiated close). With `transition` such a close needs no hold (4.4).
        const echo = !ctx.intended();
        if (!echo || transition === undefined) {
          const animations = exit.exitAnimations(element);
          if (animations.length > 0) {
            // Before the notification, so its commit keeps the children (urgent, internal).
            exit.holdUntil(animations);
          } else {
            // Nothing animates (Firefox, or no CSS exit): release a hold now; the commit is
            // invisible, the popup is already `display: none`.
            exit.release();
          }
        }
        ctx.notifyClosed(intent?.event ?? event, intent?.reason ?? "dismiss");
      }
    }
    onToggleOption?.(event as ToggleEvent);
  };

  const onCommand = (event: Event): void => {
    const element = popupRef.current;
    if (element === null || event.target !== element || event.defaultPrevented) return;
    const command = String((event as Event & { command?: string }).command ?? "").toLowerCase();
    // A foreign invoker closing the popup (design 2.3). Opens are caught at `beforetoggle`.
    if (command === "hide-popover" || (command === "toggle-popover" && isPopoverOpen(element))) {
      ctx.recordCloseIntent({ reason: "activate", event });
    }
  };

  // The listeners the callback ref attaches call the latest render's handlers. An insertion
  // effect publishes them before refs attach and before any layout effect (whose
  // `hidePopover()` dispatches `beforetoggle` synchronously).
  const handlers = useLatest({ onBeforeToggle, onToggle, onCommand });

  // --- Element ------------------------------------------------------------------------------

  // The listeners attach in the callback ref, so they are in place from the commit that mounts
  // the element (no passive-effect window, no extra render). JS-free mode: there is no "right
  // before showPopover()" (the browser runs the command), so the `autofocus` attribute stays on
  // the `initialFocus` target while it is mounted (as Dialog).
  const checkElement = useElementCheck((element) =>
    element.tagName !== "DIALOG" && element.tagName !== "DIV"
      ? `${part}: expected to render a <dialog> or a <div> but got ` +
        `<${element.tagName.toLowerCase()}>.`
      : null,
  );
  const setElement = useCallback(
    (element: HTMLElement) => {
      checkElement?.(element);
      popupRef.current = element;
      const listeners: [string, EventListener][] = [
        ["beforetoggle", (event) => handlers.current.onBeforeToggle(event)],
        ["toggle", (event) => handlers.current.onToggle(event)],
        ["command", (event) => handlers.current.onCommand(event)],
      ];
      for (const [type, listener] of listeners) element.addEventListener(type, listener);

      let autofocused: HTMLElement | null = null;
      if (!isLibrary && initialFocus !== undefined) {
        const target = resolveInitialFocus(element, initialFocus);
        if (target !== null && element.contains(target) && !target.hasAttribute("autofocus")) {
          target.setAttribute("autofocus", "");
          autofocused = target;
        }
      }

      return () => {
        for (const [type, listener] of listeners) element.removeEventListener(type, listener);
        autofocused?.removeAttribute("autofocus");
        if (popupRef.current === element) popupRef.current = null;
      };
    },
    [checkElement, popupRef, handlers, isLibrary, initialFocus],
  );

  // Development check (design 9): `role="dialog"` needs a name once the popup is (or can be)
  // shown.
  const shown = !isLibrary || ctx.committed;
  const warnedName = useRef(false);
  useEffect(() => {
    const element = popupRef.current;
    if (!isDev || element === null || !shown || warnedName.current) return;
    if (element.hasAttribute("aria-label")) return;
    const labelledBy = (element.getAttribute("aria-labelledby") ?? "").split(/\s+/);
    const doc = element.ownerDocument;
    if (labelledBy.some((id) => id !== "" && doc.getElementById(id) !== null)) return;
    const role = element.getAttribute("role");
    if (role !== "dialog" && role !== "alertdialog" && role !== "menu") return;
    warnedName.current = true;
    console.error(
      `${part}: the popup has no accessible name. Render a Title, or give the Popup an ` +
        "`aria-label`.",
    );
  }, [popupRef, shown, part]);

  return { setElement, visible: ctx.committed || exit.held, wrapContent, reshow };
}

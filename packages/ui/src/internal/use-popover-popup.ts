"use client";
import { useCallback, useEffectEvent, useLayoutEffect, useRef } from "react";
import type { ReactNode, RefObject, ViewTransitionClass } from "react";
import { useContentFocusProbe } from "./content-focus-probe.js";
import {
  commandOf,
  renderOverlayContent,
  resolveInitialFocus,
  returnFocusToTrigger,
  useCloseHold,
  useInitialFocusTarget,
} from "./overlay-popup.js";
import { isPopoverOpen } from "./popover-open.js";
import { useElementCheck } from "./use-element-check.js";
import { useLatest } from "./use-latest.js";
import { useShownNameWarning } from "./use-name-warning.js";
import type { PopoverRootValue } from "./use-overlay-root.js";

export interface UsePopoverPopupOptions {
  /** Public name of the part for development warnings (`"Popover.Popup"`). */
  readonly part: string;
  /** Element to focus on open: a ref, or a selector resolved inside the popup (design 6.1). */
  readonly initialFocus?: RefObject<HTMLElement | null> | string | undefined;
  /**
   * Replaces `initialFocus` with a function called right before each library open (Menu: the
   * first or last item by open cause). `null` leaves the choice to the platform. A
   * `QuietFocusTarget` asks for focus without the focus ring (a pointer-opened menu).
   */
  readonly resolveInitialFocus?: (popup: HTMLElement) => HTMLElement | QuietFocusTarget | null;
  /** The consumer's `keepMounted`: `renderContent` keeps the children in an `<Activity>`. */
  readonly keepMounted?: boolean | undefined;
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
 * writing `autofocus` (WebKit shows the ring for an `autofocus` target after a click).
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
   * The popup's children by mode, `visible` and `keepMounted` (`renderOverlayContent`), inside
   * the focus probe: when a close commit unmounts the content while it holds focus (a
   * library-driven close with `transition`), the hide that follows returns focus to the Trigger
   * (design 6.2).
   */
  readonly renderContent: (children: () => ReactNode) => ReactNode;
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

/** The popup roles that require a name (a listbox's name is checked on the List). */
function needsName(element: Element): boolean {
  const role = element.getAttribute("role");
  return role === "dialog" || role === "alertdialog" || role === "menu";
}

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

/** Tests only: forget the detection, so the next pointer open detects the option again. */
export function resetFocusVisibleOption(): void {
  focusVisibleOption = undefined;
}

/**
 * Whether the `ToggleEvent.source` of a close (Chromium 140, Firefox 145, Safari 26.5; not in
 * TypeScript's DOM lib) is a `popovertarget` invoker of `popup`. A `commandfor` or `interestfor`
 * invoker sets `source` too (Chromium's lost-interest hide, a dismissal), and so names no
 * `popovertarget` here.
 */
function closedByPopoverTarget(event: ToggleEvent, popup: HTMLElement): boolean {
  const source = (event as ToggleEvent & { readonly source?: Element | null }).source;
  return (
    (source instanceof HTMLButtonElement || source instanceof HTMLInputElement) &&
    source.popoverTargetElement === popup
  );
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
 * reconciliation, the apply effect, the native `beforetoggle` / `toggle` / `command` listeners
 * (and `interest` / `loseinterest`, #127), close intents, the focus-return fallback, the JS-free
 * `data-open` sync, the deferred unmount while a hide animates, and `initialFocus`. Shared by
 * Popover and Menu.
 */
export function usePopoverPopup(
  ctx: PopoverRootValue,
  options: UsePopoverPopupOptions,
): PopoverPopupHook {
  const { part, initialFocus, transition, onBeforeToggle: onBeforeToggleOption } = options;
  const onToggleOption = options.onToggle;
  const isLibrary = ctx.mode === "library";
  const { popupRef, triggerRef, setShown } = ctx;

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
  const initialFocusTarget = useInitialFocusTarget(part, "popup");
  // `interestfor` (library mode, amendment #127): the button that has interest in the popup
  // (`InterestEvent.source`), whether the current open was that button's interest open, the
  // task that hides the popup on its lost interest, and whether the hide in flight is that one.
  const interestInvoker = useRef<Element | null>(null);
  const interestOpen = useRef(false);
  const interestHideTask = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const interestHide = useRef(false);

  // `held`: children stay mounted while the hide animates (design 4.4).
  const exit = useCloseHold(ctx.committed, isLibrary, transition);

  // Whether the content unmounted while holding focus since the popup was last shown.
  const contentProbe = useContentFocusProbe(popupRef);
  const { wrapContent } = contentProbe;

  const syncOpen = (element: HTMLElement): void => {
    // JS-free mode only (design 9, #121): read the DOM, not `newState`, so a stale task cannot
    // lie.
    triggerRef.current?.toggleAttribute("data-open", isPopoverOpen(element));
  };

  // Design 6.2 rule 2, for a close that began with focus inside; not to a Trigger inside a
  // hidden popover.
  const returnFocus = (element: HTMLElement): void =>
    returnFocusToTrigger(element, triggerRef.current, (trigger) => !insideHiddenPopover(trigger));

  // --- Opening ------------------------------------------------------------------------------

  const resolveFocusTarget = (element: HTMLElement): HTMLElement | QuietFocusTarget | null => {
    if (options.resolveInitialFocus !== undefined) {
      const resolved = options.resolveInitialFocus(element);
      if (resolved === null) return null;
      const target = resolved instanceof HTMLElement ? resolved : resolved.element;
      return element.contains(target) ? resolved : null;
    }
    return initialFocusTarget(element, initialFocus);
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
      syncOpen(element);
      return;
    }
    if (isPopoverOpen(element)) ctx.requestOpen(undefined, "platform");
  });
  useLayoutEffect(() => {
    reconcileOnMount();
  }, []);

  // The apply effect (design 2.5): after every commit that re-renders the Popup, once nothing is
  // in flight, the DOM follows committed state. One effect covers the normal open, `defaultOpen`,
  // a controlled open or close, a library-driven close after `openChangeAction(false)` settled,
  // the re-open of a refused dismissal, and the close after a refused or failed pre-hydration
  // open. The Root's value is memoised, so an unrelated Root render does not re-render the Popup
  // and does not run this; every path that makes the DOM diverge from state goes through a
  // dispatch, whose `pending` flips do. Do not rely on an unrelated render to re-apply state.
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
        // The close commit may have unmounted the focused content before the hide: the
        // platform restores focus only from inside the popover, so do it now.
        if (focusWasInside.current) returnFocus(element);
      }
    }
    // Content that unmounted while the popup stays open (not a close): forget it.
    if (ctx.committed && isPopoverOpen(element)) contentProbe.forget();
    exit.releaseIfIdle(ctx.committed, awaitingClose.current, isPopoverOpen(element));
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
        // Chromium dispatches `interest` and then the interest show in one step, so a show whose
        // `source` is the remembered interest invoker is that button's interest open (#127).
        const source = (toggle as ToggleEvent & { readonly source?: Element | null }).source;
        interestOpen.current = source != null && source === interestInvoker.current;
        ctx.requestOpen(event, "activate");
      } else if (!reshowing.current) {
        // A Close action that resolves after this open must not close it (design 3.4). A re-show
        // (Menu's move) is the same open: an item action pending across it still closes.
        ctx.nextOpenGeneration();
      }
      contentProbe.forget();
    } else {
      // A foreign `popovertarget` invoker closing the popup (design 2.3, #125): `source` is the
      // button, and `null` for Escape, light dismiss and script. The library's own parts never
      // get here with a source (their clicks are cancelled; their closes are `hidePopover()`). A
      // button with `commandfor` as well runs its command, whose intent comes first and stays.
      if (isLibrary && closedByPopoverTarget(toggle, element)) {
        ctx.recordCloseIntent({ reason: "activate", event }, { unlessRecorded: true });
      }
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
    const lostInterest = interestHide.current;
    interestHide.current = false;
    // JS-free mode writes the Trigger's `data-open` (#121); library mode mirrors into the Root,
    // which non-button Triggers and the Combobox Input render as `aria-expanded` (#118).
    if (isLibrary) setShown(isPopoverOpen(element));
    else syncOpen(element);

    if (!isPopoverOpen(element)) {
      interestOpen.current = false;
      // Focus return for what the platform leaves out (design 6.2): a nested popover restores
      // nothing, and an opener that is gone leaves focus inside the hidden popup. Not after a
      // lost-interest hide: the platform never focuses the invoker there, and focusing a Trigger
      // with `interestfor` would give it interest again and re-open the popup (#127).
      const wasInside = focusWasInside.current;
      focusWasInside.current = false;
      if (wasInside && !lostInterest) returnFocus(element);

      const intent = ctx.takeCloseIntent();
      if (isLibrary) {
        // An echo: `false` already intended (the library's own hide, or a dismissal during a
        // pending part-initiated close).
        exit.afterClose(element, !ctx.intended());
        ctx.notifyClosed(intent?.event ?? event, intent?.reason ?? "dismiss");
      }
    }
    onToggleOption?.(event as ToggleEvent);
  };

  const onCommand = (event: Event): void => {
    const element = popupRef.current;
    if (element === null || event.target !== element || event.defaultPrevented) return;
    const command = commandOf(event);
    // A foreign `commandfor` invoker closing the popup (design 2.3). Opens are caught at
    // `beforetoggle`.
    // The `command` event fires whatever the popover's state (HTML): a `hide-popover` at a
    // hidden popup closes nothing and must leave no intent for a later close.
    if ((command === "hide-popover" || command === "toggle-popover") && isPopoverOpen(element)) {
      ctx.recordCloseIntent({ reason: "activate", event });
    }
  };

  /** The `source` of an `interest` / `loseinterest` event (`InterestEvent`, not in the DOM lib). */
  const interestSource = (event: Event): Element | null =>
    (event as Event & { readonly source?: Element | null }).source ?? null;

  const onInterest = (event: Event): void => {
    const element = popupRef.current;
    if (!isLibrary || element === null || event.target !== element) return;
    interestInvoker.current = interestSource(event);
  };

  /**
   * Lost interest of an `interestfor` button naming the popup (Chromium; amendment #127). The
   * platform hides only a popover its own interest show opened (`invokedVia == kInterest`), and
   * the library cancels that show and re-shows with `showPopover({ source })`, so the platform
   * never hides: the library does, as a dismissal. Chromium also fires `loseinterest` from
   * inside every hide of the popup while the button has interest (Escape, script, the library's
   * own close), before the state flips, and a `hidePopover()` called from there re-enters the
   * hide and loses its `toggle`: the hide waits one task and runs only if the popup is still
   * shown and still meant to be open, and returns no focus to the Trigger. A pending interest
   * open is cancelled instead.
   */
  const onLoseInterest = (event: Event): void => {
    const element = popupRef.current;
    if (!isLibrary || element === null || event.target !== element) return;
    const source = interestSource(event);
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

  // The listeners the callback ref attaches call the latest render's handlers. An insertion
  // effect publishes them before refs attach and before any layout effect (whose
  // `hidePopover()` dispatches `beforetoggle` synchronously).
  const handlers = useLatest({ onBeforeToggle, onToggle, onCommand, onInterest, onLoseInterest });

  // --- Element ------------------------------------------------------------------------------

  // The listeners attach in the callback ref, so they are in place from the commit that mounts
  // the element (no passive-effect window, no extra render). JS-free mode: there is no "right
  // before showPopover()" (the browser runs the command), so the `autofocus` attribute stays on
  // the `initialFocus` target while it is mounted (as Dialog).
  const checkElement = useElementCheck(
    isDev &&
      ((element) =>
        element.tagName !== "DIALOG" && element.tagName !== "DIV"
          ? `${part}: expected to render a <dialog> or a <div> but got ` +
            `<${element.tagName.toLowerCase()}>.`
          : null),
  );
  const setElement = useCallback(
    (element: HTMLElement) => {
      checkElement?.(element);
      popupRef.current = element;
      const listeners: [string, EventListener][] = [
        ["beforetoggle", (event) => handlers.current.onBeforeToggle(event)],
        ["toggle", (event) => handlers.current.onToggle(event)],
        ["command", (event) => handlers.current.onCommand(event)],
        // Fired only where `interestfor` exists (Chromium).
        ["interest", (event) => handlers.current.onInterest(event)],
        ["loseinterest", (event) => handlers.current.onLoseInterest(event)],
      ];
      for (const [type, listener] of listeners) element.addEventListener(type, listener);
      // A pre-hydration open is shown from the first commit; a popup removed while open fires no
      // `toggle`, so the detach clears the mirror (#118).
      if (isLibrary) setShown(isPopoverOpen(element));

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
        clearTimeout(interestHideTask.current);
        interestHideTask.current = undefined;
        interestHide.current = false;
        interestInvoker.current = null;
        interestOpen.current = false;
        if (isLibrary) setShown(false);
        autofocused?.removeAttribute("autofocus");
        if (popupRef.current === element) popupRef.current = null;
      };
    },
    [checkElement, popupRef, setShown, handlers, isLibrary, initialFocus],
  );

  // Development check (design 9): `role="dialog"` needs a name once the popup is (or can be)
  // shown.
  useShownNameWarning(
    popupRef,
    !isLibrary || ctx.committed,
    isDev &&
      `${part}: the popup has no accessible name. Render a Title, or give the Popup an ` +
        "`aria-label`.",
    needsName,
  );

  const visible = ctx.committed || exit.held;
  const renderContent = (children: () => ReactNode): ReactNode =>
    renderOverlayContent(
      { isLibrary, keepMounted: options.keepMounted, visible, wrapContent },
      children,
    );
  return { setElement, visible, renderContent, reshow };
}

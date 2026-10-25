"use client";
import { useCallback, useEffectEvent, useLayoutEffect, useRef } from "react";
import type { ReactNode, RefObject, ViewTransitionClass } from "react";
import { useContentFocusProbe } from "./content-focus-probe.js";
import { closedByPopoverTarget } from "./invokers.js";
import { supportsFocusVisibleOption } from "./focus-visible.js";
import type { QuietFocusTarget } from "./focus-visible.js";
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
import { useInterestDismiss } from "./use-interest-dismiss.js";
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
  /**
   * Installs listeners that live while the popup is shown (Menu: the outside right-click
   * listeners; Menu and Combobox: the foreign invoker press guard) and returns their cleanup.
   * Called at the `toggle` that finds the popup shown, and again when the ref attaches to a
   * shown popup; the cleanup runs at the `toggle` of the close and when the element detaches.
   */
  readonly whileShown?: ((popup: HTMLElement) => () => void) | undefined;
  /**
   * The `source` of each library `showPopover({ source })`, read right before the call. Default:
   * the registered Trigger. Menu passes the ContextTrigger region for a point open
   * (design/components/context-menu.md 14).
   */
  readonly source?: () => HTMLElement | null;
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
 * (and `interest` / `loseinterest`), close intents, the focus-return fallback, the JS-free
 * `data-open` sync, the deferred unmount while a hide animates, and `initialFocus`. Shared by
 * Popover, Menu and Combobox.
 */
export function usePopoverPopup(
  ctx: PopoverRootValue,
  options: UsePopoverPopupOptions,
): PopoverPopupHook {
  const { part, initialFocus, transition } = options;
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
  // `interestfor` (library mode, popover.md lost-interest amendment).
  const interest = useInterestDismiss(ctx);
  // The cleanup of `whileShown` while the popup is shown.
  const stopWhileShown = useRef<(() => void) | null>(null);
  const stopListeningWhileShown = (): void => {
    stopWhileShown.current?.();
    stopWhileShown.current = null;
  };

  // `held`: children stay mounted while the hide animates (design 4.4).
  const exit = useCloseHold(ctx.committed, isLibrary, transition);

  // Whether the content unmounted while holding focus since the popup was last shown.
  const contentProbe = useContentFocusProbe(popupRef);
  const { wrapContent } = contentProbe;

  const syncOpen = (element: HTMLElement): void => {
    // JS-free mode only (design 9): read the DOM, not `newState`, so a stale task cannot
    // lie.
    triggerRef.current?.toggleAttribute("data-open", isPopoverOpen(element));
  };

  // Design 6.2 rule 2, for a close that began with focus inside; not to a Trigger inside a
  // hidden popover.
  const returnFocus = (element: HTMLElement): void =>
    returnFocusToTrigger(element, triggerRef.current, (trigger) => !insideHiddenPopover(trigger));

  // --- Opening ------------------------------------------------------------------------------

  // The initial focus target inside the popup, and whether it is focused without the focus ring.
  const resolveFocusTarget = (
    element: HTMLElement,
  ): { readonly target: HTMLElement; readonly quiet: boolean } | null => {
    if (options.resolveInitialFocus !== undefined) {
      const resolved = options.resolveInitialFocus(element);
      if (resolved === null) return null;
      const target = resolved instanceof HTMLElement ? resolved : resolved.element;
      if (!element.contains(target)) return null;
      // A pointer open asks for no focus ring: `focus({ focusVisible: false })` after the show,
      // where the engine reads that option (QuietFocusTarget).
      const quiet =
        !(resolved instanceof HTMLElement) && supportsFocusVisibleOption(element.ownerDocument);
      return { target, quiet };
    }
    const target = initialFocusTarget(element, initialFocus);
    return target === null ? null : { target, quiet: false };
  };

  const showPopup = (element: HTMLElement): void => {
    const focus = resolveFocusTarget(element);
    // Otherwise the popover focusing steps honour `autofocus` (and run the dialog focusing steps
    // for a <dialog>, in every engine); React drops `autoFocus` on client-rendered content.
    // Never `.focus()` (6.1) except for the quiet target above.
    const autofocused =
      focus !== null && !focus.quiet && !focus.target.hasAttribute("autofocus")
        ? focus.target
        : null;
    autofocused?.setAttribute("autofocus", "");
    opening.current = true;
    try {
      const source = options.source !== undefined ? options.source() : triggerRef.current;
      element.showPopover(source != null && source.isConnected ? { source } : undefined);
    } finally {
      opening.current = false;
      autofocused?.removeAttribute("autofocus");
    }
    if (focus?.quiet === true && isPopoverOpen(element) && element.contains(focus.target)) {
      focus.target.focus({ focusVisible: false } as FocusOptions);
    }
  };

  const reshow = (): boolean => {
    const element = popupRef.current;
    if (!isLibrary || element === null || !isPopoverOpen(element)) return false;
    // The hide half's `beforetoggle` records `awaitingClose` / `focusWasInside`; the coalesced
    // `toggle` finds the popup open again, so it clears `awaitingClose`, returns no focus and
    // notifies nothing. The show half runs under `showPopup`'s opening flag (conventions 3.5, the
    // move); the hide half needs none, only an opening `beforetoggle` reads it.
    reshowing.current = true;
    try {
      element.hidePopover();
      showPopup(element);
    } finally {
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
        interest.noteOpen(toggle);
        ctx.requestOpen(event, "activate");
      } else if (!reshowing.current) {
        // A Close action that resolves after this open must not close it (design 3.4). A re-show
        // (Menu's move) is the same open: an item action pending across it still closes.
        ctx.nextOpenGeneration();
      }
      contentProbe.forget();
    } else {
      // A foreign `popovertarget` invoker closing the popup (design 2.3): `source` is the
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
  };

  const onToggle = (event: Event): void => {
    const element = popupRef.current;
    if (element === null || event.target !== element) return;
    awaitingClose.current = false;
    const lostInterest = interest.takeLostInterest();
    // JS-free mode writes the Trigger's `data-open`; library mode mirrors into the Root, which
    // non-button Triggers and the Combobox Input render as `aria-expanded`.
    if (isLibrary) setShown(isPopoverOpen(element));
    else syncOpen(element);

    if (!isPopoverOpen(element)) {
      interest.noteClosed();
      // Focus return for what the platform leaves out (design 6.2): a nested popover restores
      // nothing, and an opener that is gone leaves focus inside the hidden popup. Not after a
      // lost-interest hide: the platform never focuses the invoker there, and focusing a Trigger
      // with `interestfor` would give it interest again and re-open the popup.
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
    const { newState } = event as ToggleEvent;
    if (newState === "open" && isPopoverOpen(element)) {
      stopWhileShown.current ??= options.whileShown?.(element) ?? null;
    } else if (newState === "closed") {
      stopListeningWhileShown();
    }
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

  // The listeners the callback ref attaches call the latest render's handlers. An insertion
  // effect publishes them before refs attach and before any layout effect (whose
  // `hidePopover()` dispatches `beforetoggle` synchronously).
  const handlers = useLatest({
    onBeforeToggle,
    onToggle,
    onCommand,
    onInterest: interest.onInterest,
    onLoseInterest: interest.onLoseInterest,
  });
  const latestWhileShown = useLatest(options.whileShown);

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
  const resetInterest = interest.reset;
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
      // `toggle`, so the detach clears the mirror.
      if (isLibrary) setShown(isPopoverOpen(element));
      // The ref re-runs whenever the merged ref changes (an inline consumer `ref`), and its detach
      // stopped the listeners: a popup that is still shown gets them back, as no `toggle` comes.
      if (isPopoverOpen(element)) {
        stopWhileShown.current ??= latestWhileShown.current?.(element) ?? null;
      }

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
        resetInterest();
        stopListeningWhileShown();
        if (isLibrary) setShown(false);
        autofocused?.removeAttribute("autofocus");
        if (popupRef.current === element) popupRef.current = null;
      };
    },
    [
      checkElement,
      popupRef,
      setShown,
      handlers,
      latestWhileShown,
      isLibrary,
      initialFocus,
      resetInterest,
    ],
  );

  // Development check (design 9): a `dialog`, `alertdialog` or `menu` role needs a name once the
  // popup is (or can be) shown.
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

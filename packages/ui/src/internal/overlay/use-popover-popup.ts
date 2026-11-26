"use client";
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode, RefObject, ViewTransitionClass } from "react";
import { useContentFocusProbe } from "./content-focus-probe.js";
import { withCssTransitionCut } from "./css-transition-cut.js";
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
import { createPopupFlags, showWithFocus } from "./overlay-show.js";
import { useApplyOpenState } from "./use-apply-open-state.js";
import { isPopoverOpen } from "./popover-open.js";
import { useElementCheck } from "../use-element-check.js";
import { useInterestDismiss } from "./use-interest-dismiss.js";
import { useLatest } from "../use-latest.js";
import { useShownNameWarning } from "../use-name-warning.js";
import type { PopoverRootValue } from "./use-overlay-root.js";

export interface UsePopoverPopupOptions {
  /** Public name of the part for development warnings (`"Popover.Popup"`). */
  readonly part: string;
  /**
   * Element to focus on open (design 6.1): a ref, or a selector resolved inside the popup (the
   * consumer's `initialFocus`, also written as `autofocus` in JS-free mode); or a function called
   * right before each library open (Menu: the first or last item by open cause; Combobox: none).
   * The function's `null` leaves the choice to the platform, and a `QuietFocusTarget` asks for
   * focus without the focus ring (a pointer-opened menu).
   */
  readonly initialFocus?:
    | RefObject<HTMLElement | null>
    | string
    | ((popup: HTMLElement) => HTMLElement | QuietFocusTarget | null)
    | undefined;
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
  /**
   * Every library show is a no-focus show (HoverCard, design/components/hover-card.md 6.2): no
   * initial focus target, and the popup is `inert` for the `showPopover()` call, as for the
   * re-open of a refused fact, so no focusing step (a consumer's `autofocus`) can move focus.
   */
  readonly quietShow?: boolean | undefined;
  /**
   * Called for every open the library did not start (a foreign invoker, a script
   * `showPopover()`, an interest show) at its `beforetoggle`, before it is routed through the Root.
   * `false` cancels the open and dispatches nothing (HoverCard's "no open until fresh interest",
   * hover-card.md 2.4). Default: every open is routed.
   */
  readonly allowOpen?: ((event: ToggleEvent) => boolean) | undefined;
  /**
   * The tag names the popup element may have (the development element check). Default
   * `["DIALOG", "DIV"]`; HoverCard adds `"SPAN"` for a card inside running text.
   */
  readonly elements?: readonly string[] | undefined;
  /**
   * Called right before the lost-interest hide of an interest-opened popup
   * (`use-interest-dismiss.ts`). HoverCard blurs focus inside the card there, so neither the
   * focus-return fallback nor a `hint` popover's own restore moves focus to the Trigger
   * (hover-card.md 6.2).
   */
  readonly beforeInterestHide?: ((popup: HTMLElement) => void) | undefined;
  /**
   * Called when a routed foreign or interest open passed `allowOpen`, right before it is
   * dispatched (HoverCard attaches its document listeners there).
   */
  readonly onRoutedOpen?: ((event: ToggleEvent) => void) | undefined;
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

const DEFAULT_ELEMENTS: readonly string[] = ["DIALOG", "DIV"];

/** `["DIALOG", "DIV"]` as "a <dialog> or a <div>". */
function describeElements(elements: readonly string[]): string {
  const names = elements.map((tag) => `a <${tag.toLowerCase()}>`);
  return names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} or ${names.at(-1) ?? ""}`;
}

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
  // The consumer's ref or selector; a resolver function is read at each open only.
  const staticFocus = typeof initialFocus === "function" ? undefined : initialFocus;
  const isLibrary = ctx.mode === "library";
  // The library's own shows and hides cut the popup's CSS transitions while a view transition
  // runs (conventions 5.1).
  const hasTransition = transition !== undefined;
  const { popupRef, triggerRef, setShown } = ctx;

  // The opening `beforetoggle` lets this one through: the library's own `showPopover()`.
  const opening = useRef(false);
  // Set across `reshow()`: the show is not a new open.
  const reshowing = useRef(false);
  // `awaitingClose` (design 2.5), the library echo `libraryHide` (conventions 3.9.2) and
  // `refusedFact` (3.9.4; #155: otherwise Tab and Escape could never leave a menu whose parent
  // keeps `open={true}`), as Dialog's.
  const [flags] = useState(createPopupFlags);
  // Whether focus was inside the popup when its last close began (design 6.2 rule 1).
  const focusWasInside = useRef(false);
  const initialFocusTarget = useInitialFocusTarget(part, "popup");
  // `interestfor` (library mode, popover.md lost-interest amendment).
  // The latest render's callback, read at the hide (an insertion-effect ref).
  const beforeInterestHide = useLatest(options.beforeInterestHide);
  const interest = useInterestDismiss(ctx, {
    beforeHide: (element) => beforeInterestHide.current?.(element),
  });
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
    if (typeof initialFocus === "function") {
      const resolved = initialFocus(element);
      // `== null`: a resolver that returns `undefined` leaves the choice to the platform too.
      if (resolved == null) return null;
      const target = resolved instanceof HTMLElement ? resolved : resolved.element;
      if (!element.contains(target)) return null;
      // A pointer open asks for no focus ring: `focus({ focusVisible: false })` after the show,
      // where the engine reads that option (QuietFocusTarget).
      const quiet =
        !(resolved instanceof HTMLElement) && supportsFocusVisibleOption(element.ownerDocument);
      return { target, quiet };
    }
    const target = initialFocusTarget(element, staticFocus);
    return target === null ? null : { target, quiet: false };
  };

  const showPopup = (element: HTMLElement): void => {
    // A refused re-open never moves focus (#155, #156): no initial focus target, and the popup is
    // `inert` for the call (showWithFocus), whether the focusing steps are the dialog focusing
    // steps of a `<dialog>` (Popover's default) or a consumer's own `autofocus` in any popup.
    const refused = flags.takeRefusedFact() || options.quietShow === true;
    const focus = refused ? null : resolveFocusTarget(element);
    // Otherwise the popover focusing steps honour `autofocus` (and run the dialog focusing steps
    // for a <dialog>, in every engine). Never `.focus()` (6.1) except for the quiet target above.
    showWithFocus(element, {
      refused,
      autofocus: focus !== null && !focus.quiet ? focus.target : null,
      show: () => {
        opening.current = true;
        try {
          const source = options.source !== undefined ? options.source() : triggerRef.current;
          withCssTransitionCut(element, hasTransition, () =>
            element.showPopover(source != null && source.isConnected ? { source } : undefined),
          );
        } finally {
          opening.current = false;
        }
      },
    });
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
      // One cut around both halves (the show's own cut, nested, does nothing).
      withCssTransitionCut(element, hasTransition, () => {
        element.hidePopover();
        showPopup(element);
      });
    } finally {
      reshowing.current = false;
    }
    // Whether or not the engine fires the coalesced `toggle`, the close bookkeeping of the hide
    // half is void: the popup is open again.
    flags.endClose();
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

  // The apply effect (design 2.5). Keep this call right after mount reconciliation (as in
  // Dialog.Popup): layout effects run in call order, and at mount the reconciliation's dispatch
  // must come first, so that the first apply sees it in flight and waits.
  useApplyOpenState(ctx, {
    flags,
    exit,
    probe: contentProbe,
    isShown: isPopoverOpen,
    show: showPopup,
    hide: (element) => {
      withCssTransitionCut(element, hasTransition, () => element.hidePopover());
      // The close commit may have unmounted the focused content before the hide: the platform
      // restores focus only from inside the popover, so do it now.
      if (focusWasInside.current) returnFocus(element);
    },
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
        if (options.allowOpen !== undefined && !options.allowOpen(toggle)) {
          contentProbe.forget();
          return;
        }
        interest.noteOpen(toggle);
        options.onRoutedOpen?.(toggle);
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
      flags.beginClose();
      exit.recordBaseline(element);
      const active = element.ownerDocument.activeElement;
      focusWasInside.current =
        (active !== null && element.contains(active)) || contentProbe.hadFocus();
      contentProbe.forget();
    }
  };

  // The work of a `toggle` that finds the popup hidden; also replayed for an element that remounted
  // before its `toggle` (#159; `event` is `undefined` there: no event fired).
  const handleHidden = (
    element: HTMLElement,
    event: Event | undefined,
    echo: boolean,
    lostInterest: boolean,
  ): void => {
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
      exit.afterClose(element, echo);
      // Anything but the library's own hide is a fact: committed `false` now (urgent, this
      // event's commit) and `onOpenChange(false)` (conventions 3.9.3).
      if (!echo) {
        flags.markFact();
        // A recorded intent names its event, `undefined` included (HoverCard's close when it
        // becomes disabled, hover-card.md 2.5); without one it is this `toggle`.
        ctx.notifyClosed(intent !== undefined ? intent.event : event, intent?.reason ?? "dismiss");
      }
    }
  };

  // A fact whose element remounted before its `toggle` (#159), in a timer task: the work that
  // `toggle` would have done. The lost element is hidden; its shown mirror and `whileShown` listeners went at detach.
  const replayLostHide = (element: HTMLElement): void => {
    flags.endClose();
    // Echo `false`: only facts are replayed. `lostInterest` `false`: the detach's `interest.reset()`
    // dropped the mark, as `takeLostInterest()` would read now; a lost-interest hide never has
    // focus inside (interest is lost once focus left), so no focus return follows from it.
    handleHidden(element, undefined, false, false);
  };

  // Whether the Popup is mounted, for the #159 replay. A passive effect: a Suspense hide detaches
  // the element's ref (and runs layout cleanups) but keeps passive effects, so a hidden Popup
  // still counts as mounted.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const onToggle = (event: Event): void => {
    const element = popupRef.current;
    if (element === null || event.target !== element) return;
    flags.endClose();
    // Consumed by every `toggle`, whatever it reports: a hide the engine coalesced with a show
    // must not mark a later dismissal as the library's.
    const echo = flags.takeLibraryClose();
    const lostInterest = interest.takeLostInterest();
    // JS-free mode writes the Trigger's `data-open`; library mode mirrors into the Root, which
    // non-button Triggers and the Combobox Input render as `aria-expanded`.
    if (isLibrary) setShown(isPopoverOpen(element));
    else syncOpen(element);

    if (!isPopoverOpen(element)) handleHidden(element, event, echo, lostInterest);
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
    replayLostHide,
    onInterest: interest.onInterest,
    onLoseInterest: interest.onLoseInterest,
  });
  const latestWhileShown = useLatest(options.whileShown);

  // --- Element ------------------------------------------------------------------------------

  // The listeners attach in the callback ref, so they are in place from the commit that mounts
  // the element (no passive-effect window, no extra render). JS-free mode: there is no "right
  // before showPopover()" (the browser runs the command), so the `autofocus` attribute stays on
  // the `initialFocus` target while it is mounted (as Dialog).
  const elements = options.elements ?? DEFAULT_ELEMENTS;
  const checkElement = useElementCheck(
    isDev &&
      ((element) =>
        !elements.includes(element.tagName)
          ? `${part}: expected to render ${describeElements(elements)} but got ` +
            `<${element.tagName.toLowerCase()}>.`
          : null),
  );
  const resetInterest = interest.reset;
  const setElement = useCallback(
    (element: HTMLElement) => {
      checkElement?.(element);
      popupRef.current = element;
      // A new element (a remount mid-hide): the old one's `toggle` never comes (#159). A lost
      // fact is replayed a timer task later, unless the Popup unmounted meanwhile; also while a
      // Suspense boundary hides it (the fact happened before the hide).
      flags.attach(element, (lost) => {
        if (mounted.current) handlers.current.replayLostHide(lost as HTMLElement);
      });
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
      if (!isLibrary && staticFocus !== undefined) {
        const target = resolveInitialFocus(element, staticFocus);
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
      flags,
      setShown,
      handlers,
      latestWhileShown,
      isLibrary,
      staticFocus,
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

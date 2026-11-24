"use client";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { createActionDetails } from "./action-details.js";
import { callUrgentHandler } from "./call-urgent-handler.js";
import { isPopoverOpen } from "./popover-open.js";
import { transitionTypes } from "./transition-types.js";
import type { ActionDetails, ChangeAction, ChangeReason, UrgentChangeHandler } from "./types.js";
import { intendedValue, useControllableAction } from "./use-controllable-action.js";
import { useDevWarning } from "./use-dev-warning.js";
import { useMountFixed } from "./use-mount-fixed.js";
import { useLatest } from "./use-latest.js";

const isDev = process.env.NODE_ENV !== "production";

/**
 * "static": JS-free mode, the browser owns open and close through Invoker Commands. "library":
 * opening and part-initiated closing are library-owned requests (transitions keyed on committed
 * state, `openChangeAction`); dismissals are the browser's facts, adopted urgently and reported to
 * `onOpenChange` (design/components/popover.md section 2, conventions 3.9).
 */
export type OverlayMode = "static" | "library";

/**
 * What caused the next close, recorded just before it happens (design 2.3). The `toggle` event
 * names no cause beyond its invoker (`ToggleEvent.source`: a `popovertarget`, `commandfor` or
 * `interestfor` button); without an intent a close is a `"dismiss"`.
 */
export interface OverlayCloseIntent {
  readonly reason: ChangeReason;
  readonly event: Event | undefined;
}

/**
 * The `details` every overlay `openChangeAction` and `onOpenChange` receives (Dialog's adds
 * `returnValue`).
 */
export interface OverlayDetails extends ActionDetails {
  readonly reason: ChangeReason;
}

/**
 * The Root's state and machinery, shared by Popover, Menu, Combobox (design 14) and Dialog. The
 * component puts it in its own context (the popover-like ones extend it, `PopoverRootValue`).
 * `Popup` is the popup element's type; `CloseArgs` are the extra arguments of a close (Dialog's
 * `returnValue`), passed on to the `details` builder.
 */
export interface OverlayRootValue<Popup extends HTMLElement, CloseArgs extends unknown[]> {
  readonly mode: OverlayMode;
  /** `useId`-based ids: the popup, its Title and its Description. */
  readonly ids: { readonly popup: string; readonly title: string; readonly description: string };
  /** Committed open state (library mode); `false` in JS-free mode. */
  readonly committed: boolean;
  /** Optimistic open state (library mode); `false` in JS-free mode. */
  readonly optimistic: boolean;
  /** The Root's transition is pending (library mode). */
  readonly pending: boolean;
  /**
   * Grows with every fact (`notifyClosed`). Part of the memoised value so that a fact always
   * re-renders the parts, even when a controlled parent keeps `open={true}` and nothing else
   * changed: the Popup's apply effect then re-opens the popup (design 2.4).
   */
  readonly epoch: number;
  /**
   * What the user already intends: the latest in-flight dispatch's `next`, else the optimistic
   * value of the last commit. Safe to call from handlers and effects (layout effects included,
   * also in the commit that changed it), and after an `await`. Not during render.
   */
  readonly intended: () => boolean;
  /**
   * A counter that grows with every open (a requested open, or the popup being shown). A part
   * whose close runs after an `await` records it first and drops the close when it changed: the
   * user dismissed and re-opened meanwhile (Popover.Close, design 3.4). Handlers only.
   */
  readonly openGeneration: () => number;
  /** Advance `openGeneration` (the Popup's `beforetoggle` for an open). */
  readonly nextOpenGeneration: () => void;
  /**
   * Open through the Root's transition (library mode): a Trigger click, a foreign open caught at
   * `beforetoggle`, or mount reconciliation. A no-op when `true` is already intended.
   */
  readonly requestOpen: (event: Event | undefined, reason: ChangeReason) => void;
  /**
   * A library-owned close (library mode): a Trigger click while open, a Close part, Menu's item
   * activation. `openChangeAction(false)` is awaited and the popup hides in the commit. A no-op
   * when `false` is already intended.
   */
  readonly requestClose: (
    event: Event | undefined,
    reason: ChangeReason,
    ...args: CloseArgs
  ) => void;
  /**
   * A fact (#148, conventions 3.9.2): the browser hid the popup and the library did not
   * hide it (the caller has already excluded the library's own hide). Supersedes every request in
   * flight, writes committed `false` urgently (uncontrolled), and calls `onOpenChange(false,
   * details)` synchronously through the handler rule (`callUrgentHandler`). Call it from the
   * platform event's listener (`toggle` / `close`), never inside a transition.
   */
  readonly notifyClosed: (
    event: Event | undefined,
    reason: ChangeReason,
    ...args: CloseArgs
  ) => void;
  /** From `useControllableAction`: the latest in-flight intent, or `null`. */
  readonly latestInFlight: () => { readonly next: boolean } | null;
  /** The registered Trigger: `showPopover({ source })` and the focus-return fallback. */
  readonly triggerRef: RefObject<HTMLElement | null>;
  /** The popup element, set by the Popup's ref; how Close reaches `hidePopover()` / `close()`. */
  readonly popupRef: RefObject<Popup | null>;
  /**
   * Record what causes the next close. Cleared after a task if the popover did not close.
   * `unlessRecorded`: keep an intent already recorded for this close (the `command` listener runs
   * before the `beforetoggle` of the same click).
   */
  readonly recordCloseIntent: (
    intent: OverlayCloseIntent | undefined,
    options?: { readonly unlessRecorded?: boolean },
  ) => void;
  /** Read and clear the recorded intent (the Popup's `toggle` listener). */
  readonly takeCloseIntent: () => OverlayCloseIntent | undefined;
}

/**
 * The root value of the popover-like components (Popover, Menu, Combobox), from `usePopoverRoot`:
 * the overlay Root plus the `shown` mirror that their Popup (`usePopoverPopup`) writes and their
 * Triggers (`usePopoverTrigger`, Combobox.Trigger) and the Combobox Input read. Dialog has none.
 */
export interface PopoverRootValue extends OverlayRootValue<HTMLElement, []> {
  /**
   * The popup is in the top layer, mirrored from its `toggle` (urgent, conventions 3.5): what
   * `aria-expanded` renders on a non-button Trigger and the Combobox Input (a `<button>`
   * Trigger renders none). Written by the Popup in library mode.
   */
  readonly shown: boolean;
  /** Writes `shown` from the DOM (`:popover-open`); the Popup's `toggle`, ref attach and detach. */
  readonly setShown: (shown: boolean) => void;
  /**
   * The popup was shown at its last `toggle` and the DOM has it hidden now: the browser hid it
   * and its `toggle` has not arrived yet. A non-button Trigger's click lands in that window after
   * light dismiss hid the popup at `pointerup` (#115): it records an `"activate"` intent for the
   * fact instead of requesting a close. Handlers only.
   */
  readonly hiddenBeforeToggle: () => boolean;
}

export interface UseOverlayRootOptions<
  Details extends ActionDetails,
  Popup extends HTMLElement = HTMLElement,
  CloseArgs extends unknown[] = [],
> {
  /** Transition types and messages: `"popover"` gives `fsui-popover`, `fsui-popover-open`, … */
  readonly component: string;
  /** Public name of the Root part for development warnings (`"Popover.Root"`). */
  readonly part: string;
  readonly open: boolean | undefined;
  readonly defaultOpen: boolean | undefined;
  readonly openChangeAction: ChangeAction<boolean, Details> | undefined;
  /** The fact handler (#148): called for a hide the library did not perform. */
  readonly onOpenChange: UrgentChangeHandler<boolean, Details> | undefined;
  /**
   * `"library"` forces library mode whatever the props (Menu, which has no JS-free mode). Default:
   * detected from `open` / `defaultOpen` / `openChangeAction` / `onOpenChange` on the first
   * render.
   */
  readonly mode?: "library";
  /**
   * Called synchronously for every dispatch, before the action runs, and for every fact, before
   * `onOpenChange` (Menu: cancel hover timers, read the open cause).
   */
  readonly onDispatch?: (next: boolean, details: Details) => void;
  /** Builds the `details` of a dispatch (`popoverDetails`: `{ reason }`); an open passes no args. */
  readonly details: (
    event: Event | undefined,
    reason: ChangeReason,
    ...args: CloseArgs | []
  ) => Details;
  /**
   * Whether the popup is shown, for a stale close intent: `:popover-open` (`usePopoverRoot`), a
   * `<dialog>`'s `open` (Dialog).
   */
  readonly isShown: (popup: Popup) => boolean;
}

/** How long a recorded close intent survives when the popup did not close (design 2.3). */
function clearLater<Popup extends HTMLElement>(
  intentRef: { current: OverlayCloseIntent | undefined },
  intent: OverlayCloseIntent,
  popupRef: { current: Popup | null },
  isShown: (popup: Popup) => boolean,
): void {
  setTimeout(() => {
    // Closed: its `toggle` / `close` event (queued as a task) consumes the intent. Still open: the
    // close was cancelled or invalid, so the intent is stale.
    const popup = popupRef.current;
    if (intentRef.current === intent && popup !== null && isShown(popup)) {
      intentRef.current = undefined;
    }
  }, 0);
}

/** What the popup is called in the controlled-without-`onOpenChange` warning. */
const nouns: Record<string, string> = { combobox: "listbox" };

/** The `details` of a popover-like component: `{ reason }` (and `event`). */
export const popoverDetails = (event: Event | undefined, reason: ChangeReason): OverlayDetails =>
  createActionDetails(event, { reason });

/**
 * The Root of an overlay without its public props: mode detection (once, from the first
 * render), `useControllableAction<boolean>`, ids, refs, close intents, the open generation and
 * the intent-aware `requestOpen` / `requestClose`, and `notifyClosed` for facts.
 */
export function useOverlayRoot<
  Details extends ActionDetails,
  Popup extends HTMLElement = HTMLElement,
  CloseArgs extends unknown[] = [],
>(options: UseOverlayRootOptions<Details, Popup, CloseArgs>): OverlayRootValue<Popup, CloseArgs> {
  const {
    component,
    part,
    open,
    defaultOpen,
    openChangeAction,
    onOpenChange,
    details,
    onDispatch,
  } = options;

  // Mode is decided once, from the first render's props (design 2).
  const isLibraryNow =
    options.mode === "library" ||
    open !== undefined ||
    defaultOpen !== undefined ||
    openChangeAction !== undefined ||
    onOpenChange !== undefined;
  const mode = useMountFixed<OverlayMode>(
    isLibraryNow ? "library" : "static",
    isDev &&
      `${part}: the mode changed after mount (\`open\`, \`defaultOpen\`, \`openChangeAction\` ` +
        "and `onOpenChange` were all absent on one render and present on another). Switching " +
        "between JS-free and library mode is not supported.",
  );
  const isLibrary = mode === "library";
  // W1 (conventions 3.9.13): React's `value` without `onChange`. Static only: a handler
  // that adopts late (in a transition, after an `await`) cannot be told from an intentional
  // re-open, so nothing at runtime warns.
  const noun = nouns[component] ?? component;
  useDevWarning(
    isLibrary && open !== undefined && onOpenChange === undefined,
    isDev &&
      `${part}: \`open\` is set without \`onOpenChange\`. The browser can close this ${noun} ` +
        "without asking (Escape, a click outside), and `onOpenChange` is where a controlled Root " +
        `is told. Without it the ${noun} re-opens after every dismissal. Pass ` +
        "`onOpenChange={setOpen}`, or `onOpenChange={() => {}}` if re-opening is what you want.",
  );

  // Hooks cannot be conditional: JS-free mode calls the hook too and never dispatches.
  const { committed, optimistic, pending, dispatch, latestInFlight, adoptFact, epoch } =
    useControllableAction<boolean, Details>({
      controlled: isLibrary ? open : undefined,
      defaultValue: isLibrary ? defaultOpen : undefined,
      initialValue: false,
      action: isLibrary ? openChangeAction : undefined,
      transitionTypes: (next) => transitionTypes(component, next ? "open" : "close"),
      warn: { component: part, prop: "open" },
    });

  const id = useId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const closeIntent = useRef<OverlayCloseIntent | undefined>(undefined);

  // The optimistic value of the last commit, for callers that run after an `await` (a Close
  // action's continuation) and would otherwise read the value of the render they were created in.
  // An insertion effect runs in the mutation phase, before any layout effect of the same commit
  // (a child's included), so `intended()` is current there too.
  const committedOptimistic = useLatest(optimistic);
  // `details`, `onDispatch` and `isShown` are usually inline functions: read the committed render's
  // through a ref so that the functions below, and with them the returned value, stay stable.
  const callbacks = useLatest({ details, onDispatch, onOpenChange, isShown: options.isShown });
  const generation = useRef(0);
  const openGeneration = useCallback(() => generation.current, []);
  const nextOpenGeneration = useCallback(() => {
    generation.current++;
  }, []);

  const recordCloseIntent = useCallback(
    (intent: OverlayCloseIntent | undefined, options?: { readonly unlessRecorded?: boolean }) => {
      if (options?.unlessRecorded === true && closeIntent.current !== undefined) return;
      closeIntent.current = intent;
      if (intent !== undefined) {
        clearLater(closeIntent, intent, popupRef, callbacks.current.isShown);
      }
    },
    [callbacks],
  );
  const takeCloseIntent = useCallback(() => {
    const intent = closeIntent.current;
    closeIntent.current = undefined;
    return intent;
  }, []);

  // Conventions 3.8 rule 1: judge no-ops against what the user already intends. That also
  // deduplicates the StrictMode re-run of the mount reconciliation and recognises the library's
  // own `hidePopover()` echoing back through `toggle`.
  const intended = useCallback(
    (): boolean => intendedValue(latestInFlight, committedOptimistic.current),
    [latestInFlight, committedOptimistic],
  );

  const send = useCallback(
    (next: boolean, event: Event | undefined, reason: ChangeReason, args: CloseArgs | []): void => {
      const { details, onDispatch } = callbacks.current;
      const built = details(event, reason, ...args);
      if (next) nextOpenGeneration();
      onDispatch?.(next, built);
      dispatch(next, built);
    },
    [callbacks, nextOpenGeneration, dispatch],
  );

  const requestOpen = useCallback(
    (event: Event | undefined, reason: ChangeReason): void => {
      if (!isLibrary || intended()) return;
      send(true, event, reason, []);
    },
    [isLibrary, intended, send],
  );

  const requestClose = useCallback(
    (event: Event | undefined, reason: ChangeReason, ...args: CloseArgs): void => {
      if (!isLibrary || !intended()) return;
      send(false, event, reason, args);
    },
    [isLibrary, intended, send],
  );

  const notifyClosed = useCallback(
    (event: Event | undefined, reason: ChangeReason, ...args: CloseArgs): void => {
      if (!isLibrary) return;
      const { details, onDispatch, onOpenChange } = callbacks.current;
      const built = details(event, reason, ...args);
      onDispatch?.(false, built);
      // Supersede the requests in flight and write committed `false` (urgent), then tell the
      // consumer; both in the platform event, so one discrete commit follows (design 2.3).
      adoptFact(false);
      callUrgentHandler(onOpenChange, false, built);
    },
    [isLibrary, callbacks, adoptFact],
  );

  const ids = useMemo(
    () => ({ popup: id, title: `${id}-title`, description: `${id}-description` }),
    [id],
  );

  // Memoised: every function above is stable, so the value changes only with the open state and
  // pending, and the components' context values built on it are reused otherwise.
  return useMemo(
    () => ({
      mode,
      ids,
      committed: isLibrary && committed,
      optimistic: isLibrary && optimistic,
      pending: isLibrary && pending,
      epoch,
      intended,
      openGeneration,
      nextOpenGeneration,
      requestOpen,
      requestClose,
      notifyClosed,
      latestInFlight,
      triggerRef,
      popupRef,
      recordCloseIntent,
      takeCloseIntent,
    }),
    [
      mode,
      ids,
      isLibrary,
      committed,
      optimistic,
      pending,
      epoch,
      intended,
      openGeneration,
      nextOpenGeneration,
      requestOpen,
      requestClose,
      notifyClosed,
      latestInFlight,
      recordCloseIntent,
      takeCloseIntent,
    ],
  );
}

/**
 * The Root of a popover-like component (Popover, Menu, Combobox): `useOverlayRoot` over a
 * `popover` element (`:popover-open`), plus the `shown` mirror and `hiddenBeforeToggle`.
 */
export function usePopoverRoot<Details extends ActionDetails>(
  options: Omit<UseOverlayRootOptions<Details>, "isShown">,
): PopoverRootValue {
  const root = useOverlayRoot<Details>({ ...options, isShown: isPopoverOpen });
  const { popupRef } = root;

  const [shown, setShownState] = useState(false);
  // The last value written, for handlers (`hiddenBeforeToggle`).
  const shownNow = useRef(false);
  const setShown = useCallback((next: boolean) => {
    shownNow.current = next;
    setShownState(next);
  }, []);
  const hiddenBeforeToggle = useCallback((): boolean => {
    const popup = popupRef.current;
    return shownNow.current && popup !== null && !isPopoverOpen(popup);
  }, [popupRef]);

  // Changes only with `root` and `shown`, so as rarely as `root` itself does.
  return useMemo(
    () => ({ ...root, shown, setShown, hiddenBeforeToggle }),
    [root, shown, setShown, hiddenBeforeToggle],
  );
}

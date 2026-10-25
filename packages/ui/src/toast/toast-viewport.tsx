"use client";
import {
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type { ComponentPropsWithRef, CSSProperties, FocusEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { DialogContext } from "../dialog/dialog-context.js";
import { createActionDetails } from "../internal/action-details.js";
import { announce as speak } from "../internal/announce.js";
import { dataAttr } from "../internal/data-attr.js";
import { isPopoverOpen } from "../internal/popover-open.js";
import type { ChangeReason, RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { animationBaseline } from "../internal/use-exit-animation.js";
import { useLatest } from "../internal/use-latest.js";
import { useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { toast as defaultManager, toastManagerInternals } from "./toast.js";
import type {
  RetainedToast,
  ToastCommand,
  ToastItem,
  ToastListener,
  ToastManager,
  ToastPriority,
} from "./toast.js";
import { ToastViewportContext } from "./toast-context.js";
import type { ToastViewportContextValue } from "./toast-context.js";
import { DEFAULT_HOTKEY, matchesHotkey, regionLabel } from "./toast-hotkey.js";
import { clearToastTimers, syncToastTimers } from "./toast-timers.js";
import type { ToastTimer } from "./toast-timers.js";
import { useModalPortalHost } from "./use-modal-portal-host.js";
import { applyCommands, makeEntry, partition, plainText, withFlags } from "./toast-queue.js";
import type { Entry } from "./toast-queue.js";

export interface ToastViewportState {
  /** Rendered toasts, chronological (oldest first), exiting ones included. */
  readonly toasts: readonly ToastItem[];
  /** Toasts waiting beyond `limit`. */
  readonly queued: number;
  /** A viewport-wide pause holds (pointer over the region, focus inside, hidden document, blurred window). */
  readonly paused: boolean;
}

export interface ToastViewportProps extends Omit<
  ComponentPropsWithRef<"section">,
  | "popover"
  | "className"
  | "style"
  | "children"
  | "onPointerEnter"
  | "onPointerLeave"
  | "onFocus"
  | "onBlur"
  | "onKeyDown"
> {
  /** The queue to render. Default: the module-level `toast`. */
  manager?: ToastManager;
  /** Toasts rendered at once; further ones wait in order (never dropped). Default `3`. */
  limit?: number;
  /** Default `duration` of a toast in milliseconds; `null` for persistent. Default `5000`. */
  duration?: number | null;
  /**
   * Keys that focus the newest toast: `event.code` values and modifier names (`"altKey"`,
   * `"ctrlKey"`, `"metaKey"`, `"shiftKey"`), all of which must match, with no other modifier
   * held. Default `["F8"]`; `null` installs no listener.
   */
  hotkey?: readonly string[] | null;
  /**
   * The text `document.ariaNotify()` speaks for a toast (localisation); `null` announces nothing.
   * A toast's own `announce` wins. Default: the text of its Title and Description.
   */
  announce?: (toast: ToastItem) => string | null;
  /** Usually a function of the state mapping `state.toasts` to `Toast.Root`s. */
  children?: StateValue<ReactNode, ToastViewportState>;
  className?: StateValue<string | undefined, ToastViewportState>;
  style?: StateValue<CSSProperties | undefined, ToastViewportState>;
  /** Must render an element that can carry `popover` (a `<section>` by default). */
  render?: RenderProp<ComponentPropsWithRef<"section">, ToastViewportState>;
}

const isDev = process.env.NODE_ENV !== "production";

/** Document order. */
function byDocumentPosition(a: Element, b: Element): number {
  if (a === b) return 0;
  return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

interface PauseSources {
  hover: boolean;
  focus: boolean;
  hidden: boolean;
  blurred: boolean;
}

function anyPause(sources: PauseSources): boolean {
  return sources.hover || sources.focus || sources.hidden || sources.blurred;
}

/**
 * The toast region: a `<section popover="manual">` named "Notifications (F8)", shown in the top
 * layer while it has toasts. Owns the queue (urgent state fed by `toast()`), the timers and their
 * pausing, the hotkey, focus return, announcements through `document.ariaNotify()`, and the move
 * into the topmost open modal `Dialog` (a region outside it would be inert).
 *
 * Owned keys (conventions 1.2): `popover`, `aria-label` (the consumer's own `aria-label` wins
 * verbatim), `data-paused`, `data-empty`, and the pointer / focus handlers.
 */
export function ToastViewport({
  manager = defaultManager,
  limit = 3,
  duration = 5000,
  hotkey = DEFAULT_HOTKEY,
  announce,
  children,
  className,
  style,
  render,
  ...rest
}: ToastViewportProps) {
  // --- The queue: urgent state, written only from handlers, microtasks and effects -----------
  const [entries, setEntries] = useState<readonly Entry[]>([]);
  // The latest queue, written together with every `setEntries`: the dispatchers read and write
  // it synchronously so a burst of commands composes (and side effects stay out of updaters).
  const entriesRef = useRef<readonly Entry[]>(entries);
  const listener = useRef<ToastListener | null>(null);
  listener.current ??= {
    restore: (toasts: readonly RetainedToast[]) => handlers.current.restore(toasts),
    apply: (commands: readonly ToastCommand[]) => handlers.current.apply(commands),
    retain: () => handlers.current.retain(),
  };
  // A second Viewport on a taken manager renders nothing from its first render on (the effect
  // below confirms or clears it once the subscription is attempted).
  const [rejected, setRejected] = useState(() =>
    toastManagerInternals(manager).isTaken(listener.current!),
  );
  const [, startCloseTransition] = useTransition();

  const regionRef = useRef<HTMLElement | null>(null);
  const roots = useRef(new Map<string, HTMLElement>());
  const suspended = useRef(new Set<string>());
  const timers = useRef(new Map<string, ToastTimer>());
  const pauses = useRef<PauseSources>({
    hover: false,
    focus: false,
    hidden: false,
    blurred: false,
  });
  const [paused, setPaused] = useState(false);
  /** Where focus goes back to once the last toast holding it leaves (design 7). */
  const returnTarget = useRef<HTMLElement | null>(null);
  const lastAnnounced = useRef(new Map<string, string | null>());
  /** Per closing toast: the animations already running before `data-ending` applied. */
  const exitBaselines = useRef(new Map<string, ReadonlySet<Animation>>());
  const announceBatch = useRef<{ text: string; priority: ToastPriority }[]>([]);
  const addedSinceEffect = useRef(false);
  const mounted = useRef(false);

  const latest = useLatest({ limit, duration, hotkey, announce });

  const write = (next: readonly Entry[]): void => {
    entriesRef.current = next;
    setEntries(next);
  };

  // --- Timers (design 6) ----------------------------------------------------------------------

  const syncTimers = (): void => {
    syncToastTimers(timers.current, partition(entriesRef.current, latest.current.limit).visible, {
      halted: !mounted.current || anyPause(pauses.current),
      suspended: suspended.current,
      defaultDuration: latest.current.duration,
      expire: (id) => close([id], "timeout", undefined),
    });
  };

  const setPause = (source: keyof PauseSources, value: boolean): void => {
    if (pauses.current[source] === value) return;
    pauses.current[source] = value;
    // Applied synchronously in the event, before any timer callback can run (design 14 item 9).
    syncTimers();
    setPaused(anyPause(pauses.current));
  };

  // --- Focus ----------------------------------------------------------------------------------

  /** Open toasts' Root elements in document order. */
  const sortedRoots = (exclude?: ReadonlySet<string>): { id: string; element: HTMLElement }[] => {
    const open = new Set(entriesRef.current.filter((e) => !e.ending).map((e) => e.options.id));
    const list: { id: string; element: HTMLElement }[] = [];
    for (const [id, element] of roots.current) {
      if (!open.has(id) || exclude?.has(id) || !element.isConnected) continue;
      list.push({ id, element });
    }
    return list.sort((a, b) => byDocumentPosition(a.element, b.element));
  };

  /**
   * Before toasts close: if focus is inside one of them, move it to the next toast, else the
   * previous one, else where it was before the region was entered, else the body (design 7).
   */
  const moveFocusOut = (closing: ReadonlySet<string>): void => {
    const doc = regionRef.current?.ownerDocument ?? document;
    const active = doc.activeElement;
    if (!(active instanceof HTMLElement)) return;
    const all = sortedRoots();
    const index = all.findIndex(({ element }) => element.contains(active));
    if (index === -1 || !closing.has(all[index]!.id)) return;
    const after = all.slice(index + 1).find(({ id }) => !closing.has(id));
    const before = all
      .slice(0, index)
      .reverse()
      .find(({ id }) => !closing.has(id));
    const target = after ?? before;
    if (target !== undefined) {
      target.element.focus();
      return;
    }
    const stored = returnTarget.current;
    if (stored !== null && stored.isConnected && !regionRef.current?.contains(stored)) {
      stored.focus();
      if (doc.activeElement === stored) return;
    }
    active.blur();
  };

  // --- Queue writes ---------------------------------------------------------------------------

  /**
   * Records the animations running in each closing toast before `data-ending` applies: the exit
   * waits only for the ones the ending state started, not for a running progress bar.
   */
  const snapshotExitBaselines = (ids: Iterable<string>): void => {
    for (const id of ids) {
      const element = roots.current.get(id);
      if (element === undefined) continue;
      exitBaselines.current.set(id, animationBaseline(element));
    }
  };

  const scheduleCloseActions = (
    closed: readonly Entry[],
    reason: ChangeReason,
    event: Event | undefined,
  ): void => {
    for (const entry of closed) {
      const closeAction = entry.options.closeAction;
      if (closeAction === undefined) continue;
      const details = createActionDetails(event, { id: entry.options.id, reason });
      // Not in the closing handler itself: the toast is gone first, then the action runs in the
      // Viewport's own transition (its rejection reaches the boundary above the Viewport).
      queueMicrotask(() => {
        if (!mounted.current) return;
        startCloseTransition(async () => {
          await closeAction(details);
        });
      });
    }
  };

  const close = (ids: readonly string[], reason: ChangeReason, event: Event | undefined): void => {
    const wanted = new Set(ids);
    const closing = entriesRef.current.filter((e) => !e.ending && wanted.has(e.options.id));
    if (closing.length === 0) return;
    const closingIds = new Set(closing.map((e) => e.options.id));
    moveFocusOut(closingIds);
    snapshotExitBaselines(closingIds);
    write(
      entriesRef.current.map((e) =>
        closingIds.has(e.options.id) ? withFlags(e, { ending: true }) : e,
      ),
    );
    syncTimers();
    scheduleCloseActions(closing, reason, event);
  };

  const drop = (id: string): void => {
    const next = entriesRef.current.filter((e) => !(e.ending && e.options.id === id));
    if (next.length === entriesRef.current.length) return;
    lastAnnounced.current.delete(id);
    exitBaselines.current.delete(id);
    write(next);
  };

  const apply = (commands: readonly ToastCommand[]): void => {
    const result = applyCommands(entriesRef.current, commands, (id) => roots.current.has(id));
    for (const id of result.replaced) clearToastTimers(timers.current, id);
    for (const id of result.forgotten) {
      lastAnnounced.current.delete(id);
      exitBaselines.current.delete(id);
    }
    if (result.added) addedSinceEffect.current = true;
    if (isDev) {
      for (const id of result.missing) {
        console.error(`toast.update: no toast with id "${id}"; the update is ignored.`);
      }
    }
    if (result.dismissed.length === 0) {
      write(result.next);
      return;
    }
    moveFocusOut(result.leaving);
    snapshotExitBaselines(result.leaving);
    write(result.next);
    syncTimers();
    scheduleCloseActions(result.dismissed, "dismiss", undefined);
  };

  const setActionPending = (id: string, pending: boolean): void => {
    const index = entriesRef.current.findIndex((e) => e.options.id === id);
    if (index === -1) return;
    const entry = entriesRef.current[index]!;
    if (entry.actionPending === pending) return;
    const next = [...entriesRef.current];
    next[index] = withFlags(entry, { actionPending: pending });
    write(next);
  };

  // --- Announcements (design 5) ---------------------------------------------------------------

  const flushAnnouncements = (): void => {
    const batch = announceBatch.current;
    announceBatch.current = [];
    if (batch.length === 0) return;
    const priority = batch.some((a) => a.priority === "high") ? "high" : "normal";
    speak(
      regionRef.current?.ownerDocument ?? document,
      batch.map((a) => a.text).join(" "),
      priority,
    );
  };

  const queueAnnouncement = (id: string, text: string | null, priority: ToastPriority): void => {
    const map = lastAnnounced.current;
    if (map.has(id) && map.get(id) === text) return;
    map.set(id, text);
    if (text === null || text.trim() === "") return;
    if (announceBatch.current.length === 0) queueMicrotask(flushAnnouncements);
    announceBatch.current.push({ text, priority });
  };

  // The callbacks below read only refs, so one context value serves the Viewport's whole life.
  const restore = (toasts: readonly RetainedToast[]): void => {
    if (entriesRef.current.length > 0) return;
    // Already announced by the previous Viewport: not again on every remount.
    for (const t of toasts) {
      if (t.announced !== undefined) lastAnnounced.current.set(t.options.id, t.announced);
    }
    write(
      toasts.map((t) =>
        makeEntry(t.options, { promisePending: t.pending, actionPending: false, ending: false }),
      ),
    );
    addedSinceEffect.current = true;
  };

  const retain = (): readonly RetainedToast[] => {
    const announced = lastAnnounced.current;
    return entriesRef.current
      .filter((e) => !e.ending)
      .map((e) => ({
        options: e.options,
        pending: e.promisePending,
        announced: announced.has(e.options.id) ? announced.get(e.options.id) : undefined,
      }));
  };

  /** Forgets the queue of the previous manager (its own copy is retained by that manager). */
  const reset = (): void => {
    moveFocusOut(new Set(entriesRef.current.filter((e) => !e.ending).map((e) => e.options.id)));
    clearToastTimers(timers.current);
    lastAnnounced.current.clear();
    exitBaselines.current.clear();
    write([]);
  };

  const handlers = useLatest({
    apply,
    restore,
    retain,
    reset,
    close,
    drop,
    setActionPending,
    queueAnnouncement,
    setPause,
    syncTimers,
  });

  const context = useMemo<ToastViewportContextValue>(
    () => ({
      close: (ids, reason, event) => handlers.current.close(ids, reason, event),
      drop: (id) => handlers.current.drop(id),
      setActionPending: (id, pending) => handlers.current.setActionPending(id, pending),
      setSuspended: (id, value) => {
        if (value) suspended.current.add(id);
        else suspended.current.delete(id);
        handlers.current.syncTimers();
      },
      registerRoot: (id, element) => {
        if (element === null) roots.current.delete(id);
        else roots.current.set(id, element);
      },
      focusSibling: (id, direction) => {
        const all = sortedRoots();
        const index = all.findIndex((r) => r.id === id);
        if (index === -1) return;
        all[index + direction]?.element.focus();
      },
      announce: (id, text, priority) => handlers.current.queueAnnouncement(id, text, priority),
      exitBaseline: (id) => exitBaselines.current.get(id),
      announcer: () => latest.current.announce,
    }),
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- refs only (`sortedRoots` reads refs)
    [handlers, latest],
  );

  // --- Subscription ---------------------------------------------------------------------------

  const subscribedManager = useRef<ToastManager | null>(null);
  useEffect(() => {
    // A new `manager`: the previous one kept its toasts on unsubscribe (the previous run's
    // cleanup); start empty so the new one's retained toasts are restored and no command of
    // one queue reaches the other's toasts. The same manager again (StrictMode, Activity) keeps
    // the entries.
    if (subscribedManager.current !== null && subscribedManager.current !== manager) {
      handlers.current.reset();
    }
    subscribedManager.current = manager;
    const unsubscribe = toastManagerInternals(manager).subscribe(listener.current!);
    if (unsubscribe === null) {
      setRejected(true);
      if (isDev) {
        console.error(
          "Toast.Viewport: another Toast.Viewport already renders this manager; this one renders " +
            "nothing. Use one Viewport per manager, or `createToastManager()` for a second queue.",
        );
      }
      return;
    }
    setRejected(false);
    return unsubscribe;
  }, [manager, handlers]);

  // --- Lifecycle, pause sources, hotkey --------------------------------------------------------

  useEffect(() => {
    if (rejected) return;
    mounted.current = true;
    const doc = regionRef.current?.ownerDocument ?? document;
    const view = doc.defaultView ?? window;
    pauses.current.hidden = doc.visibilityState === "hidden";
    const onVisibility = (): void =>
      handlers.current.setPause("hidden", doc.visibilityState === "hidden");
    // The window's own focus and blur; an element's (which do not bubble) never reach here.
    const onWindowBlur = (event: Event): void => {
      if (!(event.target instanceof Node)) handlers.current.setPause("blurred", true);
    };
    const onWindowFocus = (event: Event): void => {
      if (!(event.target instanceof Node)) handlers.current.setPause("blurred", false);
    };
    doc.addEventListener("visibilitychange", onVisibility);
    view.addEventListener("blur", onWindowBlur);
    view.addEventListener("focus", onWindowFocus);
    handlers.current.syncTimers();
    setPaused(anyPause(pauses.current));
    const map = timers.current;
    return () => {
      mounted.current = false;
      doc.removeEventListener("visibilitychange", onVisibility);
      view.removeEventListener("blur", onWindowBlur);
      view.removeEventListener("focus", onWindowFocus);
      // Unmounting stops the timers; the queue itself is retained by the manager.
      clearToastTimers(map);
    };
  }, [handlers, rejected]);

  const hotkeyKey = hotkey === null ? null : hotkey.join("\u0000");
  useEffect(() => {
    if (hotkeyKey === null || rejected) return;
    const keys = hotkeyKey.split("\u0000");
    const doc = regionRef.current?.ownerDocument ?? document;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || !matchesHotkey(keys, event)) return;
      const all = sortedRoots();
      const newest = all.at(-1);
      if (newest === undefined) return;
      event.preventDefault();
      const active = doc.activeElement;
      if (active instanceof HTMLElement && !regionRef.current?.contains(active)) {
        returnTarget.current = active;
      }
      newest.element.focus();
    };
    doc.addEventListener("keydown", onKeyDown);
    return () => doc.removeEventListener("keydown", onKeyDown);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- `sortedRoots` reads refs only
  }, [hotkeyKey, rejected]);

  // --- The portal host (design 4.3) ------------------------------------------------------------

  // Keep this call before the region layout effect below: the host's move hides the popover
  // (removal steps), which that effect shows again in the same commit. A moved region gets no
  // `pointerleave`: drop the hover pause; a pointer still over it enters it again on its next move.
  const { portalled, host, anchorRef } = useModalPortalHost(() => setPause("hover", false));

  // --- After every commit: region, timers, queued announcements, orphan exits ----------------

  useLayoutEffect(() => {
    const region = regionRef.current;
    const current = entriesRef.current;
    // Focus that left with a remount (a move into or out of a dialog) fires no `focusout`.
    if (
      pauses.current.focus &&
      (region === null || !region.contains(region.ownerDocument.activeElement))
    ) {
      returnTarget.current = null;
      setPause("focus", false);
    }
    if (region !== null && region.isConnected && region.hasAttribute("popover")) {
      const open = isPopoverOpen(region);
      try {
        if (current.length > 0) {
          if (!open) region.showPopover();
          else if (addedSinceEffect.current) {
            // Re-raise to the top of the top layer, above a menu or popover opened since
            // (design 4.2). No style flush in between, so nothing is re-created.
            region.hidePopover();
            region.showPopover();
          }
        } else if (open) {
          region.hidePopover();
        }
      } catch {
        // A render element without popover support; nothing to show.
      }
    }
    // An emptied region is hidden, often right under the pointer (its last toast's Close), and
    // a hidden element gets no `pointerleave`: the next toast must not start paused.
    if (current.length === 0 && pauses.current.hover) setPause("hover", false);
    addedSinceEffect.current = false;

    const { visible, queued } = partition(current, latest.current.limit);
    // Queued toasts are announced on add (design 5): from their plain-text fields, since they
    // have no DOM yet. Visible ones announce from their Root once their content committed.
    for (const entry of queued) {
      const id = entry.options.id;
      if (lastAnnounced.current.has(id)) continue;
      const resolver = entry.options.announce ?? latest.current.announce;
      const text = resolver
        ? resolver(entry.item)
        : [plainText(entry.options.title), plainText(entry.options.description)]
            .filter((t) => t !== "")
            .join(" ");
      queueAnnouncement(id, text, entry.options.priority ?? "normal");
    }
    // An ending toast without a Root (the consumer did not render one) has nothing to animate.
    for (const entry of visible) {
      if (entry.ending && !roots.current.has(entry.options.id)) drop(entry.options.id);
    }
    syncTimers();
  });

  // --- Development checks ---------------------------------------------------------------------

  // A Viewport inside a library Dialog would close (and unmount) with it.
  const insideDialog = use(DialogContext) !== null;
  useDevWarning(
    insideDialog,
    isDev &&
      "Toast.Viewport: rendered inside a Dialog. The region would close with the dialog; render " +
        "the Viewport once near the root of the app (it moves into open modal Dialogs by itself).",
  );

  // --- Render ---------------------------------------------------------------------------------

  const { visible, queued } = partition(entries, limit);
  const state: ToastViewportState = {
    toasts: visible.map((e) => e.item),
    queued: queued.length,
    paused,
  };

  const regionCallbackRef = useCallback((element: HTMLElement) => {
    regionRef.current = element;
    return () => {
      if (regionRef.current === element) regionRef.current = null;
    };
  }, []);

  // Touch lifts the pointer at once (`pointerleave` follows `pointerup`), so a tap never sticks.
  const onPointerEnter = (): void => setPause("hover", true);
  const onPointerLeave = (): void => setPause("hover", false);
  const onFocus = (event: FocusEvent<HTMLElement>): void => {
    const region = event.currentTarget;
    const from = event.relatedTarget;
    if (!(from instanceof Node) || !region.contains(from)) {
      returnTarget.current ??= from instanceof HTMLElement ? from : null;
    }
    setPause("focus", true);
  };
  const onBlur = (event: FocusEvent<HTMLElement>): void => {
    const to = event.relatedTarget;
    if (to instanceof Node && event.currentTarget.contains(to)) return;
    returnTarget.current = null;
    setPause("focus", false);
  };

  const libraryProps: ComponentPropsWithRef<"section"> & DataAttributes = {
    popover: "manual",
    "aria-label": rest["aria-label"] ?? regionLabel(hotkey),
    "data-paused": dataAttr(paused),
    "data-empty": dataAttr(state.toasts.length === 0),
    onPointerEnter,
    onPointerLeave,
    onFocus,
    onBlur,
  };

  const region = useRender<ComponentPropsWithRef<"section">, ToastViewportState>({
    defaultElement: "section",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps,
    ref: regionCallbackRef,
  });

  if (rejected) return null;
  const content = <ToastViewportContext value={context}>{region}</ToastViewportContext>;
  if (!portalled || host === null) return content;
  return (
    <>
      <div ref={anchorRef} style={ANCHOR_STYLE} />
      {createPortal(content, host)}
    </>
  );
}

const ANCHOR_STYLE: CSSProperties = { display: "contents" };

ToastViewport.displayName = "ToastViewport";

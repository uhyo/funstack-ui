"use client";
import { use, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ComponentPropsWithRef, CSSProperties, FocusEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { DialogContext } from "../dialog/dialog-context.js";
import { createActionDetails } from "../internal/action-details.js";
import { callUrgentHandler } from "../internal/call-urgent-handler.js";
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
} from "./toast.js";
import { ToastViewportContext } from "./toast-context.js";
import type { ToastViewportContextValue } from "./toast-context.js";
import { DEFAULT_HOTKEY, regionLabel } from "./toast-hotkey.js";
import { clearToastTimers, syncToastTimers } from "./toast-timers.js";
import type { ToastTimer } from "./toast-timers.js";
import { applyCommands, makeEntry, partition, withFlags } from "./toast-queue.js";
import type { Entry } from "./toast-queue.js";
import { useModalPortalHost } from "./use-modal-portal-host.js";
import { useToastAnnouncements } from "./use-toast-announcements.js";
import { useToastFocus, useToastHotkey } from "./use-toast-focus.js";
import { useToastPauses } from "./use-toast-pauses.js";

/**
 * State of `Toast.Viewport`, passed to the function forms of `className`, `style`, `children` and
 * `render`.
 */
export interface ToastViewportState {
  /** Rendered toasts, chronological (oldest first), exiting ones included. */
  readonly toasts: readonly ToastItem[];
  /** Toasts waiting beyond `limit`. */
  readonly queued: number;
  /** A viewport-wide pause holds (pointer over the region, focus inside, hidden document, blurred window). */
  readonly paused: boolean;
}

/**
 * Props of `Toast.Viewport`.
 *
 * @see https://ui.funstack.work/components/toast
 */
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
  /**
   * The queue to render (from `createToastManager()`).
   *
   * @defaultValue the module-level `toast`
   */
  manager?: ToastManager;
  /**
   * Toasts rendered at once; further ones wait in order (never dropped).
   *
   * @defaultValue `3`
   */
  limit?: number;
  /**
   * Default `duration` of a toast in milliseconds; `null` for persistent.
   *
   * @defaultValue `5000`
   */
  duration?: number | null;
  /**
   * Keys that focus the newest toast: `event.code` values and modifier names (`"altKey"`,
   * `"ctrlKey"`, `"metaKey"`, `"shiftKey"`), all of which must match, with no other modifier
   * held. `null` installs no listener.
   *
   * @defaultValue `["F8"]`
   */
  hotkey?: readonly string[] | null;
  /**
   * The text `document.ariaNotify()` speaks for a toast (localisation); `null` announces nothing.
   * A toast's own `announce` wins.
   *
   * @defaultValue the text of the toast's Title and Description
   */
  announce?: (toast: ToastItem) => string | null;
  /** Usually a function of the state mapping `state.toasts` to `Toast.Root`s. */
  children?: StateValue<ReactNode, ToastViewportState>;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, ToastViewportState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, ToastViewportState>;
  /** Must render an element that can carry `popover` (a `<section>` by default). */
  render?: RenderProp<ComponentPropsWithRef<"section">, ToastViewportState>;
}

const isDev = process.env.NODE_ENV !== "production";

/**
 * The toast region: a `<section popover="manual">` named "Notifications (F8)", shown in the top
 * layer while it has toasts. Owns the queue (urgent state fed by `toast()`), the timers and their
 * pausing, the hotkey, focus return, announcements through `document.ariaNotify()`, and the move
 * into the topmost open modal `Dialog` (a region outside it would be inert).
 *
 * Owned keys (conventions 1.2): `popover`, `aria-label` (the consumer's own `aria-label` wins
 * verbatim), `data-paused`, `data-empty`, and the pointer / focus handlers.
 *
 * @see https://ui.funstack.work/components/toast
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

  const regionRef = useRef<HTMLElement | null>(null);
  const roots = useRef(new Map<string, HTMLElement>());
  const suspended = useRef(new Set<string>());
  const timers = useRef(new Map<string, ToastTimer>());

  // --- Pause sources, focus, announcements (design 5, 6, 7) ---------------------------------
  // `syncTimers` is declared below; the callback only runs from events and effects, after render.
  const pauses = useToastPauses(() => syncTimers());
  const { paused, setPause, watch } = pauses;
  const focus = useToastFocus({ entriesRef, roots, regionRef });
  const { returnTargetRef, sortedRoots, moveFocusOut } = focus;
  const { lastAnnouncedRef, queueAnnouncement, announceQueued } = useToastAnnouncements(regionRef);

  /** Per closing toast: the animations already running before `data-ending` applied. */
  const exitBaselines = useRef(new Map<string, ReadonlySet<Animation>>());
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
      halted: !mounted.current || pauses.anyHeld(),
      suspended: suspended.current,
      defaultDuration: latest.current.duration,
      expire: (id) => close([id], "timeout", undefined),
    });
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

  /**
   * A toast's `onClose` (#148: a handler, not an action): called synchronously where the close is
   * applied to the queue, after the entry is marked ending, outside any transition, and not
   * awaited (`callUrgentHandler`: a throw or a returned promise's rejection goes to
   * `reportError`, the queue write above stands).
   */
  const callCloseHandlers = (
    closed: readonly Entry[],
    reason: ChangeReason,
    event: Event | undefined,
  ): void => {
    for (const entry of closed) {
      const onClose = entry.options.onClose;
      if (onClose === undefined) continue;
      callUrgentHandler(onClose, createActionDetails(event, { id: entry.options.id, reason }));
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
    callCloseHandlers(closing, reason, event);
  };

  const drop = (id: string): void => {
    const next = entriesRef.current.filter((e) => !(e.ending && e.options.id === id));
    if (next.length === entriesRef.current.length) return;
    lastAnnouncedRef.current.delete(id);
    exitBaselines.current.delete(id);
    write(next);
  };

  const apply = (commands: readonly ToastCommand[]): void => {
    const result = applyCommands(entriesRef.current, commands, (id) => roots.current.has(id));
    for (const id of result.replaced) clearToastTimers(timers.current, id);
    for (const id of result.forgotten) {
      lastAnnouncedRef.current.delete(id);
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
    callCloseHandlers(result.dismissed, "dismiss", undefined);
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

  // The callbacks below read only refs, so one context value serves the Viewport's whole life.
  const restore = (toasts: readonly RetainedToast[]): void => {
    if (entriesRef.current.length > 0) return;
    // Already announced by the previous Viewport: not again on every remount.
    for (const t of toasts) {
      if (t.announced !== undefined) lastAnnouncedRef.current.set(t.options.id, t.announced);
    }
    write(
      toasts.map((t) =>
        makeEntry(t.options, { promisePending: t.pending, actionPending: false, ending: false }),
      ),
    );
    addedSinceEffect.current = true;
  };

  const retain = (): readonly RetainedToast[] => {
    const announced = lastAnnouncedRef.current;
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
    lastAnnouncedRef.current.clear();
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
    const unwatch = watch(doc);
    handlers.current.syncTimers();
    const map = timers.current;
    return () => {
      mounted.current = false;
      unwatch();
      // Unmounting stops the timers; the queue itself is retained by the manager.
      clearToastTimers(map);
    };
  }, [handlers, rejected, watch]);

  useToastHotkey({ hotkey, rejected, regionRef, focus });

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
      pauses.holding("focus") &&
      (region === null || !region.contains(region.ownerDocument.activeElement))
    ) {
      returnTargetRef.current = null;
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
    if (current.length === 0 && pauses.holding("hover")) setPause("hover", false);
    addedSinceEffect.current = false;

    const { visible, queued } = partition(current, latest.current.limit);
    // Queued toasts are announced on add (design 5); visible ones announce from their Root
    // once their content committed.
    announceQueued(queued, latest.current.announce);
    // An ending toast without a Root (the consumer did not render one) has nothing to animate.
    for (const entry of visible) {
      if (entry.ending && !roots.current.has(entry.options.id)) drop(entry.options.id);
    }
    syncTimers();
  });

  // --- Development checks ---------------------------------------------------------------------

  // A second Viewport on a taken manager renders nothing (`rejected`, set above).
  useDevWarning(
    rejected,
    isDev &&
      "Toast.Viewport: another Toast.Viewport already renders this manager; this one renders " +
        "nothing. Use one Viewport per manager, or `createToastManager()` for a second queue.",
  );

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
      returnTargetRef.current ??= from instanceof HTMLElement ? from : null;
    }
    setPause("focus", true);
  };
  const onBlur = (event: FocusEvent<HTMLElement>): void => {
    const to = event.relatedTarget;
    if (to instanceof Node && event.currentTarget.contains(to)) return;
    returnTargetRef.current = null;
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

"use client";
import { Suspense, useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ComponentPropsWithRef, CSSProperties, KeyboardEvent, ReactNode } from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { exitAnimations } from "../internal/use-exit-animation.js";
import { useLatest } from "../internal/use-latest.js";
import { resolveStateValue, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import type { ToastItem, ToastPriority } from "./toast.js";
import { ToastRootContext, useToastRootContext, useToastViewportContext } from "./toast-context.js";
import type { ToastRootContextValue } from "./toast-context.js";

export interface ToastRootState {
  readonly toast: ToastItem;
  /** `toast.pending`: its promise is unsettled or its Action runs. */
  readonly pending: boolean;
  /** `toast.ending`: closed, kept for its exit animation. */
  readonly ending: boolean;
  readonly type: string | undefined;
  readonly priority: ToastPriority;
}

export interface ToastRootProps extends Omit<
  ComponentPropsWithRef<"div">,
  "role" | "className" | "style" | "children" | "onKeyDown"
> {
  /** The toast to render: an item of the Viewport's `state.toasts`. */
  toast: ToastItem;
  children?: StateValue<ReactNode, ToastRootState>;
  className?: StateValue<string | undefined, ToastRootState>;
  style?: StateValue<CSSProperties | undefined, ToastRootState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, ToastRootState>;
}

/**
 * The Suspense guard's fallback: renders nothing and tells the Root its content is suspended,
 * so the timer and the announcement wait for the reveal (design 3.5).
 */
function SuspenseGuard() {
  const { setSuspended } = useToastRootContext("Toast.Root");
  useLayoutEffect(() => {
    setSuspended(true);
    return () => setSuspended(false);
  }, [setSuspended]);
  return null;
}

/**
 * One toast: a focusable `div[role=dialog]` (`alertdialog` for `priority: "high"`) named by its
 * Title and described by its Description. Escape dismisses it, ArrowDown / ArrowUp move to the
 * next / previous toast. Its children render inside a Suspense guard with an invisible fallback,
 * so a toast whose content suspends does not pull the whole Viewport into a boundary above it.
 * When the toast closes it stays with `data-ending` (and `inert`) until its exit animations end.
 *
 * Owned keys (conventions 1.2): `role`, `tabIndex`, `aria-labelledby`, `aria-describedby`,
 * `inert`, `data-type`, `data-pending`, `data-ending`, `onKeyDown`.
 */
export function ToastRoot({
  toast: item,
  children,
  className,
  style,
  render,
  ...rest
}: ToastRootProps) {
  const viewport = useToastViewportContext("Toast.Root");
  const id = item.id;
  const baseId = useId();
  const ids = useMemo(
    () => ({ title: `${baseId}title`, description: `${baseId}description` }),
    [baseId],
  );
  const elementRef = useRef<HTMLElement | null>(null);
  const titleRef = useRef<HTMLElement | null>(null);
  const descriptionRef = useRef<HTMLElement | null>(null);

  // Action pending, aggregated over the Action parts inside (normally one).
  const pendingTokens = useRef(new Set<object>());
  const [actionPending, setActionPendingState] = useState(false);
  // Suspended content behind the guard: a ref for effects of the same commit, state to re-run
  // the announcement once it reveals.
  const suspendedRef = useRef(false);
  const [suspended, setSuspendedState] = useState(false);

  const idRef = useLatest(id);
  // The Root's announcement effect has run once: later Title / Description commits are reveals.
  const announcedOnce = useRef(false);
  const revealQueued = useRef(false);

  const setActionPending = useCallback(
    (token: object, pending: boolean) => {
      const tokens = pendingTokens.current;
      if (pending) tokens.add(token);
      else tokens.delete(token);
      const any = tokens.size > 0;
      setActionPendingState(any);
      viewport.setActionPending(idRef.current, any);
    },
    [viewport, idRef],
  );

  const setSuspended = useCallback(
    (value: boolean) => {
      suspendedRef.current = value;
      setSuspendedState(value);
      viewport.setSuspended(idRef.current, value);
    },
    [viewport, idRef],
  );

  const close = useCallback(
    (reason: Parameters<ToastRootContextValue["close"]>[0], event: Event | undefined) =>
      viewport.close([idRef.current], reason, event),
    [viewport, idRef],
  );

  const registerTitle = useCallback((element: HTMLElement | null) => {
    titleRef.current = element;
  }, []);
  const registerDescription = useCallback((element: HTMLElement | null) => {
    descriptionRef.current = element;
  }, []);

  const pending = item.pending || actionPending;
  const priority = item.priority ?? "normal";

  // Announce once the content has committed un-suspended (design 5): the Title and Description
  // text exists now. The Viewport skips text it already announced for this toast and speaks the
  // batch a microtask later.
  const announceNow = (): void => {
    if (item.ending || suspendedRef.current) return;
    const resolver = item.announce ?? viewport.announcer();
    let text: string | null;
    if (resolver !== undefined) text = resolver(item);
    else {
      text = [titleRef.current?.textContent, descriptionRef.current?.textContent]
        .map((t) => (t ?? "").trim())
        .filter((t) => t !== "")
        .join(" ");
    }
    viewport.announce(item.id, text, priority);
  };
  const announceRef = useLatest(announceNow);

  // A Title or Description inside the consumer's own `<Suspense>` commits after the Root (the
  // boundary's retry does not re-run the Root's effect). Read once the whole reveal committed,
  // so a Title and a Description revealed together are announced as one text.
  const contentCommitted = useCallback(() => {
    if (!announcedOnce.current || revealQueued.current) return;
    revealQueued.current = true;
    queueMicrotask(() => {
      revealQueued.current = false;
      announceRef.current();
    });
  }, [announceRef]);
  const state = useMemo<ToastRootState>(
    () => ({ toast: item, pending, ending: item.ending, type: item.type, priority }),
    [item, pending, priority],
  );

  const context = useMemo<ToastRootContextValue>(
    () => ({
      toast: item,
      ids,
      state,
      registerTitle,
      registerDescription,
      contentCommitted,
      setActionPending,
      setSuspended,
      close,
    }),
    [
      item,
      ids,
      state,
      registerTitle,
      registerDescription,
      contentCommitted,
      setActionPending,
      setSuspended,
      close,
    ],
  );

  const rootRef = useCallback(
    (element: HTMLElement) => {
      elementRef.current = element;
      viewport.registerRoot(id, element);
      return () => {
        if (elementRef.current === element) elementRef.current = null;
        viewport.registerRoot(id, null);
      };
    },
    [viewport, id],
  );

  // A layout effect, so toasts announce in queue order (before the Viewport's own effect
  // announces the queued ones).
  useLayoutEffect(() => {
    announcedOnce.current = true;
    announceRef.current();
  }, [item, suspended, priority, announceRef]);

  // Exit (design 10.2): keep the ending toast until the animations the ending state started
  // settle, then drop it. Animations that ran before (a progress bar, paused with the region or
  // not) are not waited for: the Viewport recorded them just before marking the toast ending.
  useLayoutEffect(() => {
    if (!item.ending) return;
    const element = elementRef.current;
    const baseline = viewport.exitBaseline(item.id);
    const animations =
      element === null
        ? []
        : exitAnimations(element).filter((animation) => !baseline?.has(animation));
    if (animations.length === 0) {
      viewport.drop(item.id);
      return;
    }
    let cancelled = false;
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      if (!cancelled) viewport.drop(item.id);
    });
    return () => {
      cancelled = true;
    };
  }, [item.ending, item.id, viewport]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.defaultPrevented || item.ending) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close("dismiss", event.nativeEvent);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      viewport.focusSibling(id, event.key === "ArrowDown" ? 1 : -1);
    }
  };

  const libraryProps: ComponentPropsWithRef<"div"> & DataAttributes = {
    role: priority === "high" ? "alertdialog" : "dialog",
    tabIndex: 0,
    "aria-labelledby": ids.title,
    "aria-describedby": ids.description,
    inert: item.ending || undefined,
    "data-type": item.type,
    "data-pending": dataAttr(pending),
    "data-ending": dataAttr(item.ending),
    onKeyDown,
  };

  const element = useRender<ComponentPropsWithRef<"div">, ToastRootState>({
    defaultElement: "div",
    render,
    state,
    className,
    style,
    children: (s: ToastRootState) => (
      <Suspense fallback={<SuspenseGuard />}>{resolveStateValue(children, s)}</Suspense>
    ),
    props: rest,
    libraryProps,
    ref: rootRef,
  });

  return <ToastRootContext value={context}>{element}</ToastRootContext>;
}

ToastRoot.displayName = "ToastRoot";

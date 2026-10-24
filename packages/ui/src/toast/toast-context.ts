"use client";
import { createContext, use } from "react";
import type { ChangeReason } from "../internal/types.js";
import type { ToastItem, ToastPriority } from "./toast.js";
import type { ToastRootState } from "./toast-root.js";

/** What a Root (and the parts under it) need from the Viewport. Stable for the Viewport's life. */
export interface ToastViewportContextValue {
  /** Close toasts (`ending: true`), moving focus out first and scheduling `closeAction`. */
  readonly close: (ids: readonly string[], reason: ChangeReason, event: Event | undefined) => void;
  /** Remove an ending toast once its exit animations finished. */
  readonly drop: (id: string) => void;
  /** An action dispatched through the toast's Action part is (no longer) in flight. */
  readonly setActionPending: (id: string, pending: boolean) => void;
  /** The toast's content is (no longer) suspended behind the Root's guard. */
  readonly setSuspended: (id: string, suspended: boolean) => void;
  /** The Root's element, for arrow keys, the hotkey and focus moves; `null` to unregister. */
  readonly registerRoot: (id: string, element: HTMLElement | null) => void;
  /** Focus the next (`1`) or previous (`-1`) toast's Root, without wrapping. */
  readonly focusSibling: (id: string, direction: 1 | -1) => void;
  /** Queue an announcement; skipped when `text` equals the last one announced for `id`. */
  readonly announce: (id: string, text: string | null, priority: ToastPriority) => void;
  /** The Viewport's `announce` prop, read at announcement time. */
  readonly announcer: () => ((toast: ToastItem) => string | null) | undefined;
  /**
   * The animations that ran in the toast before it was marked ending (kept until it is dropped
   * or replaced): its exit waits only for the others.
   */
  readonly exitBaseline: (id: string) => ReadonlySet<Animation> | undefined;
}

export const ToastViewportContext = createContext<ToastViewportContextValue | null>(null);

export function useToastViewportContext(part: string): ToastViewportContextValue {
  const context = use(ToastViewportContext);
  if (context === null) {
    throw new Error(`${part} must be rendered inside a Toast.Viewport.`);
  }
  return context;
}

/** What the parts inside a Root need. */
export interface ToastRootContextValue {
  readonly toast: ToastItem;
  readonly ids: { readonly title: string; readonly description: string };
  /** Root state, so Title and Description can resolve their function props against it. */
  readonly state: ToastRootState;
  readonly registerTitle: (element: HTMLElement | null) => void;
  readonly registerDescription: (element: HTMLElement | null) => void;
  /** An Action part's run is (no longer) in flight; `token` identifies the part. */
  readonly setActionPending: (token: object, pending: boolean) => void;
  /**
   * A Title or Description committed: mounted, or shown again by a Suspense boundary inside the
   * Root (the consumer's skeleton), so the Root announces the text that now exists.
   */
  readonly contentCommitted: () => void;
  /** The Suspense guard mounted (`true`) or unmounted (`false`). */
  readonly setSuspended: (suspended: boolean) => void;
  /** Close this toast. */
  readonly close: (reason: ChangeReason, event: Event | undefined) => void;
}

export const ToastRootContext = createContext<ToastRootContextValue | null>(null);

export function useToastRootContext(part: string): ToastRootContextValue {
  const context = use(ToastRootContext);
  if (context === null) {
    throw new Error(`${part} must be rendered inside a Toast.Root.`);
  }
  return context;
}

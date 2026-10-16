"use client";
import { createContext, use } from "react";
import type { RefObject } from "react";
import type { ChangeReason } from "../internal/types.js";

/**
 * "static": JS-free mode, the browser owns open and close through Invoker Commands. "library":
 * open is library-owned (a transition keyed on committed state), close is browser-owned and
 * notified (design section 2).
 */
export type DialogMode = "static" | "library";

/**
 * What caused the next `close` event, recorded just before the close happens (design 2.3). The
 * `close` event carries no source; without an intent the close is a `"dismiss"`.
 */
export interface DialogCloseIntent {
  readonly reason: ChangeReason;
  readonly event: Event | undefined;
}

export interface DialogContextValue {
  readonly mode: DialogMode;
  /** `useId`-based ids: the `<dialog>`, its Title and its Description. */
  readonly ids: { readonly dialog: string; readonly title: string; readonly description: string };
  readonly modal: boolean;
  /** Committed open state (library mode); `false` in static mode. */
  readonly committed: boolean;
  /** Optimistic open state (library mode); `false` in static mode. */
  readonly optimistic: boolean;
  /** The Root's transition is pending (library mode). */
  readonly pending: boolean;
  /**
   * Open the dialog through the Root's transition (library mode): a Trigger click, a foreign
   * `show-modal` command, or mount reconciliation. A no-op when the user already intends `true`.
   */
  readonly requestOpen: (event: Event | undefined, reason: ChangeReason) => void;
  /**
   * The dialog closed natively: dispatch the `false` notification unless the user (or the
   * library's own echo) already intends `false`.
   */
  readonly notifyClosed: (event: Event, reason: ChangeReason, returnValue: string) => void;
  /** From `useControllableAction`: the latest in-flight intent, or `null`. */
  readonly latestInFlight: () => { readonly next: boolean } | null;
  /** The registered Trigger element, for the focus-return fallback (design 6.2). */
  readonly triggerRef: RefObject<HTMLElement | null>;
  /** The `<dialog>`, set by the Popup's ref; how Close and Form reach `close(value)`. */
  readonly dialogRef: RefObject<HTMLDialogElement | null>;
  /** Record what causes the next close. Cleared after a task if the dialog did not close. */
  readonly recordCloseIntent: (intent: DialogCloseIntent | undefined) => void;
  /** Read and clear the recorded intent (the Popup's `close` listener). */
  readonly takeCloseIntent: () => DialogCloseIntent | undefined;
}

export const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialogContext(part: string): DialogContextValue {
  const context = use(DialogContext);
  if (context === null) {
    throw new Error(`${part} must be rendered inside a Dialog.Root.`);
  }
  return context;
}

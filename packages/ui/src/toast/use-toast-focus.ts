"use client";
import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { compareDocumentOrder } from "../internal/dom-order.js";
import { matchesHotkey } from "./toast-hotkey.js";
import type { Entry } from "./toast-queue.js";

export interface ToastFocusOptions {
  /** The Viewport's latest queue. */
  readonly entriesRef: RefObject<readonly Entry[]>;
  /** The mounted Roots by toast id. */
  readonly roots: RefObject<Map<string, HTMLElement>>;
  readonly regionRef: RefObject<HTMLElement | null>;
}

export interface ToastFocus {
  /** Where focus goes back to once the last toast holding it leaves (design 7). */
  readonly returnTargetRef: RefObject<HTMLElement | null>;
  /** Open toasts' Root elements in document order. Reads refs only. */
  readonly sortedRoots: (exclude?: ReadonlySet<string>) => { id: string; element: HTMLElement }[];
  /**
   * Before toasts close: if focus is inside one of them, move it to the next toast, else the
   * previous one, else where it was before the region was entered, else the body (design 7).
   */
  readonly moveFocusOut: (closing: ReadonlySet<string>) => void;
}

/** Focus in and out of `Toast.Viewport`'s toasts (design/components/toast.md 7). */
export function useToastFocus({ entriesRef, roots, regionRef }: ToastFocusOptions): ToastFocus {
  const returnTargetRef = useRef<HTMLElement | null>(null);

  const sortedRoots = (exclude?: ReadonlySet<string>): { id: string; element: HTMLElement }[] => {
    const open = new Set(entriesRef.current.filter((e) => !e.ending).map((e) => e.options.id));
    const list: { id: string; element: HTMLElement }[] = [];
    for (const [id, element] of roots.current) {
      if (!open.has(id) || exclude?.has(id) || !element.isConnected) continue;
      list.push({ id, element });
    }
    return list.sort((a, b) => compareDocumentOrder(a.element, b.element));
  };

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
    const stored = returnTargetRef.current;
    if (stored !== null && stored.isConnected && !regionRef.current?.contains(stored)) {
      stored.focus();
      if (doc.activeElement === stored) return;
    }
    active.blur();
  };

  return { returnTargetRef, sortedRoots, moveFocusOut };
}

export interface ToastHotkeyOptions {
  /** The Viewport's `hotkey`; `null` installs no listener. */
  readonly hotkey: readonly string[] | null;
  /** This Viewport renders nothing (another one renders the manager). */
  readonly rejected: boolean;
  readonly regionRef: RefObject<HTMLElement | null>;
  readonly focus: ToastFocus;
}

/**
 * The hotkey that focuses the newest toast (design/components/toast.md 7), remembering where
 * focus was as the return target.
 */
export function useToastHotkey({ hotkey, rejected, regionRef, focus }: ToastHotkeyOptions): void {
  const { sortedRoots, returnTargetRef } = focus;
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
        returnTargetRef.current = active;
      }
      newest.element.focus();
    };
    doc.addEventListener("keydown", onKeyDown);
    return () => doc.removeEventListener("keydown", onKeyDown);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- `sortedRoots` reads refs only
  }, [hotkeyKey, rejected]);
}

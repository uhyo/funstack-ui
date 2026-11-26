"use client";
import { createContext } from "react";
import { compareDocumentOrder } from "../internal/dom-order.js";

/**
 * What `AlertDialog.Popup` tells the Cancels inside it (design 3.4): whether they are the
 * default initial focus target (the Popup has no `initialFocus`), and where they register their
 * element so that a library open can pick the first enabled one.
 */
export interface AlertDialogCancelContextValue {
  /** The Popup has no `initialFocus`: the first enabled Cancel is the target. */
  readonly defaultFocus: boolean;
  /** Registers a Cancel's element; returns the unregister function. */
  readonly register: (element: HTMLElement) => () => void;
}

export const AlertDialogCancelContext = createContext<AlertDialogCancelContextValue | null>(null);

function isDisabled(element: HTMLElement): boolean {
  return element.matches(":disabled") || element.getAttribute("aria-disabled") === "true";
}

/**
 * The first registered Cancel, in tree order, that belongs to `dialog` (not to a dialog nested
 * in it) and is not disabled; `null` without one, and the platform chooses (design 3.4).
 */
export function firstEnabledCancel(
  dialog: HTMLDialogElement,
  cancels: ReadonlySet<HTMLElement>,
): HTMLElement | null {
  let first: HTMLElement | null = null;
  for (const element of cancels) {
    if (element.closest("dialog") !== dialog || isDisabled(element)) continue;
    if (first === null || compareDocumentOrder(element, first) < 0) first = element;
  }
  return first;
}

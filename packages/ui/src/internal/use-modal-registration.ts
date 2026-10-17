"use client";
import { useLayoutEffect } from "react";
import { pushModal, removeModal } from "./modal-registry.js";

function isModal(dialog: HTMLDialogElement): boolean {
  if (!dialog.isConnected || !dialog.open) return false;
  try {
    return dialog.matches(":modal");
  } catch {
    return false;
  }
}

/**
 * Keeps the modal registry (`modal-registry.ts`) in step with a `<dialog>`: registered while it
 * is open as a modal (`showModal()`), removed when it closes or unmounts. Reads the DOM truth
 * (`:modal`) instead of the component's state, so every way of opening counts.
 *
 * `beforetoggle` fires synchronously inside `showModal()` / `close()`, before the state changes,
 * so that check runs a microtask later; `toggle` and `close` re-check.
 */
export function useModalRegistration(dialog: HTMLDialogElement | null): void {
  useLayoutEffect(() => {
    if (dialog === null) return;
    let active = true;
    const sync = (): void => {
      if (!active) return;
      if (isModal(dialog)) pushModal(dialog);
      else removeModal(dialog);
    };
    const syncSoon = (): void => queueMicrotask(sync);
    dialog.addEventListener("beforetoggle", syncSoon);
    dialog.addEventListener("toggle", sync);
    dialog.addEventListener("close", sync);
    sync();
    return () => {
      active = false;
      dialog.removeEventListener("beforetoggle", syncSoon);
      dialog.removeEventListener("toggle", sync);
      dialog.removeEventListener("close", sync);
      removeModal(dialog);
    };
  }, [dialog]);
}

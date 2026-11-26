"use client";
import { createContext, use } from "react";
import type { ChangeReason } from "../internal/types.js";
import type { OverlayRootValue } from "../internal/overlay/use-overlay-root.js";

/**
 * The Root's machinery (`useOverlayRoot`, as Popover's) with the `<dialog>` as the popup element
 * and a close's `returnValue`. `mode` "static" is JS-free mode, where the browser owns open and
 * close through Invoker Commands; in "library" mode opening and the closes a part asks for are
 * library-owned requests, dismissals browser-owned facts reported to `onOpenChange` (design
 * section 2, conventions 3.9).
 */
export interface DialogContextValue extends OverlayRootValue<
  HTMLDialogElement,
  [returnValue: string]
> {
  readonly modal: boolean;
  /**
   * A library-owned close (library mode, design 2.3): a Close part, a `method="dialog"` submit,
   * a Form's settle close, a foreign close command. Records `returnValue` for the apply effect's
   * `close()` and dispatches `false` (`openChangeAction(false)` awaited). A no-op when `false` is
   * already intended. `notifyClosed` (a fact: a native close) records nothing.
   */
  readonly requestClose: (
    event: Event | undefined,
    reason: ChangeReason,
    returnValue: string,
  ) => void;
  /**
   * Read and clear the `returnValue` of the pending part-initiated close, for the apply effect's
   * `close()`; `""` when there is none (a controlled close).
   */
  readonly takeCloseReturnValue: () => string;
}

export const DialogContext = createContext<DialogContextValue | null>(null);

/**
 * The namespace whose part names a shared part body uses in its messages: `Dialog`, or
 * `AlertDialog` and `Drawer`, whose parts run the Dialog parts' code
 * (design/components/alert-dialog.md 8, drawer.md 9).
 */
export type DialogNamespace = "Dialog" | "AlertDialog" | "Drawer";

/**
 * Development only: where a Close part inside a `Drawer.Popup` reports its element, for the
 * Popup's "another way to close" warning (design/components/drawer.md 7). `null` outside a
 * Drawer. The Close parts of every namespace report: a `Dialog.Close` closes a drawer too.
 */
export const DialogCloseRegistry = createContext<((element: Element) => void) | null>(null);

/**
 * The parts of `Dialog` and `AlertDialog` (design/components/alert-dialog.md 8) share this
 * context. `part` is the public name (`"AlertDialog.Cancel"`); the error names the Root of the
 * same namespace.
 */
export function useDialogContext(part: string): DialogContextValue {
  const context = use(DialogContext);
  if (context === null) {
    const root = rootPartOf(part);
    throw new Error(
      `${part} must be rendered inside ${/^[AEIOU]/.test(root) ? "an" : "a"} ${root}.`,
    );
  }
  return context;
}

/** `"AlertDialog.Cancel"` -> `"AlertDialog.Root"`. */
export function rootPartOf(part: string): string {
  return `${part.slice(0, part.indexOf("."))}.Root`;
}

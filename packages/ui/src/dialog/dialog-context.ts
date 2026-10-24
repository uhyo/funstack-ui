"use client";
import { createContext, use } from "react";
import type { ChangeReason } from "../internal/types.js";
import type { OverlayRootValue } from "../internal/use-overlay-root.js";

/**
 * The Root's machinery (`useOverlayRoot`, as Popover's) with the `<dialog>` as the popup element
 * and a close's `returnValue`. `mode` "static" is JS-free mode, where the browser owns open and
 * close through Invoker Commands; in "library" mode opening and the closes a part asks for are
 * library-owned, dismissals browser-owned and notified (design section 2).
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
   * already intended. `notifyClosed` (a native close) records nothing.
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

export function useDialogContext(part: string): DialogContextValue {
  const context = use(DialogContext);
  if (context === null) {
    throw new Error(`${part} must be rendered inside a Dialog.Root.`);
  }
  return context;
}

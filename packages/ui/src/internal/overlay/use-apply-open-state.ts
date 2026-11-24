"use client";
// The apply effect (design/components/popover.md 2.5, dialog.md 2.5) that usePopoverPopup
// (Popover, Menu, Combobox) and Dialog.Popup share: the same algorithm over a three-member
// platform driver (`isShown`, `show`, `hide`). The platform listeners and mount reconciliation
// stay in each Popup; they differ in order and content.
import { useLayoutEffect } from "react";
import type { RefObject } from "react";
import type { ContentFocusProbeHook } from "./content-focus-probe.js";
import type { CloseHold } from "./overlay-popup.js";
import type { PopupFlags } from "./overlay-show.js";
import type { OverlayRootValue } from "./use-overlay-root.js";

/** What the apply effect reads from the Root (both Popups' contexts have it). */
export type ApplyOpenStateContext<Popup extends HTMLElement> = Pick<
  OverlayRootValue<Popup, never[]>,
  "mode" | "committed" | "pending" | "latestInFlight" | "recordCloseIntent"
> & { readonly popupRef: RefObject<Popup | null> };

export interface ApplyOpenStateOptions<Popup extends HTMLElement> {
  readonly flags: PopupFlags;
  readonly exit: Pick<CloseHold, "releaseIfIdle">;
  readonly probe: Pick<ContentFocusProbeHook, "forget">;
  /** Whether the popup is in the top layer (`:popover-open`, or the dialog's `open`). */
  readonly isShown: (element: Popup) => boolean;
  /** The library's own show: initial focus, the refused re-open, the platform call. */
  readonly show: (element: Popup) => void;
  /**
   * The library's own hide, after the echo was marked: the platform call (with its CSS
   * transition cut), then the focus-return fallback for a close commit that unmounted the
   * focused content (design 6.2 rule 2).
   */
  readonly hide: (element: Popup) => void;
}

/**
 * The apply effect (design 2.5): a dependency-free layout effect that, after every commit that
 * re-renders the Popup, once nothing is in flight, makes the DOM follow committed state. One
 * effect covers the normal open, `defaultOpen`, a controlled open or close, a library-driven close
 * after `openChangeAction(false)` settled, the re-open of a dismissal a controlled parent refused
 * (in the fact's own commit, or once the requests it superseded settled: conventions 3.9.4), and
 * the close after a refused or failed pre-hydration open. The Root's value is memoised, so an
 * unrelated Root render does not re-render the Popup and does not run this; every path that makes
 * the DOM diverge from state goes through a dispatch, whose `pending` flips do, or a fact, whose
 * `epoch` does. Do not rely on an unrelated render to re-apply state.
 *
 * Also forgets content that unmounted while the popup stays open, and releases a `held` no exit
 * animation is going to release (4.4).
 *
 * A layout effect without deps runs in call order among the component's layout effects: call it
 * right after the Popup's mount reconciliation, whose dispatch makes this wait for it.
 */
export function useApplyOpenState<Popup extends HTMLElement>(
  ctx: ApplyOpenStateContext<Popup>,
  { flags, exit, probe, isShown, show, hide }: ApplyOpenStateOptions<Popup>,
): void {
  useLayoutEffect(() => {
    if (ctx.mode !== "library") return;
    const element = ctx.popupRef.current;
    if (element === null || !element.isConnected) return;
    // The fact was adopted (or anything else closed the popup in state): a later show is a new
    // open, with initial focus.
    if (!ctx.committed) flags.factAdopted();
    if (!ctx.pending && ctx.latestInFlight() === null) {
      const shown = isShown(element);
      if (ctx.committed && !shown) {
        // Hidden, but its `toggle` / `close` event has not arrived yet: wait for it.
        if (!flags.awaitingClose()) show(element);
      } else if (!ctx.committed && shown) {
        // The library's own hide: the `toggle` / `close` listener recognises it by the echo
        // marker and reports nothing.
        ctx.recordCloseIntent(undefined);
        flags.markLibraryClose();
        hide(element);
      }
    }
    // Content that unmounted while the popup stays open (not a close): forget it.
    if (ctx.committed && isShown(element)) probe.forget();
    // A hold the close commit set (or a fact's commit) that no exit animation is going to
    // release: the popup is hidden and its close event has been handled.
    exit.releaseIfIdle(ctx.committed, flags.awaitingClose(), isShown(element));
  });
}

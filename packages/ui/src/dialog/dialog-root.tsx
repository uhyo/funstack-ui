"use client";
import { useCallback, useInsertionEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { createActionDetails } from "../internal/action/action-details.js";
import type {
  ActionDetails,
  ChangeAction,
  ChangeReason,
  StateValue,
  UrgentChangeHandler,
} from "../internal/types.js";
import { intendedValue } from "../internal/action/use-controllable-action.js";
import { useOverlayRoot } from "../internal/overlay/use-overlay-root.js";
import { useTitleDescriptionPresence } from "../internal/use-title-description.js";
import { resolveStateValue } from "../internal/use-render.js";
import { DialogContext } from "./dialog-context.js";
import type { DialogContextValue, DialogNamespace } from "./dialog-context.js";

/** Details passed as the second argument of `openChangeAction` and `onOpenChange`. */
export interface DialogOpenChangeDetails extends ActionDetails {
  /**
   * `"activate"`: the user acted on a part: Trigger (open), Close or Form submit (close).
   * `"dismiss"`: the user closed the dialog without a part: Escape, Android back, an assistive-
   * technology dismiss gesture, or a click outside (`lightDismiss` / `closedby="any"`).
   * `"platform"`: the dialog was found open on mount (opened before hydration); `event` is
   * `undefined`.
   */
  readonly reason: ChangeReason;
  /**
   * On close: `dialog.returnValue`: the `value` of the Close button or the form submitter that
   * closed it; for a fact (`onOpenChange`), what the browser left (`""` for Escape or a click
   * outside, the argument of a script `close(value)`). On open: `undefined`.
   */
  readonly returnValue: string | undefined;
}

/** State of `Dialog.Root`, passed to the function forms of `children`. */
export interface DialogRootState {
  /** Optimistic open state (`false` in JS-free mode). Content rendered from it must not suspend. */
  readonly open: boolean;
  /** An `openChangeAction` dispatched through this Dialog is in flight (library mode only). */
  readonly pending: boolean;
  /** The `modal` prop. */
  readonly modal: boolean;
}

/**
 * Props of `Dialog.Root`.
 *
 * @see https://ui.funstack.work/components/dialog
 */
export interface DialogRootProps {
  /**
   * Controlled open state. `undefined` means uncontrolled (and, with `defaultOpen`,
   * `openChangeAction` and `onOpenChange` also absent, JS-free mode). A controlled Root needs
   * `onOpenChange` too: the browser closes the dialog without asking (development warns).
   */
  open?: boolean;
  /**
   * Initial open state in uncontrolled library mode. The dialog opens after hydration, never in
   * the server HTML.
   */
  defaultOpen?: boolean;
  /**
   * Requests only. Awaited for `true` (the dialog opens when it resolves and the content has
   * rendered) and for a `false` the user asked a part for (`Dialog.Close`, a `Dialog.Form`
   * submit or settled action, a foreign close command: the dialog closes with
   * `details.returnValue` when it resolves, with a view transition if the Popup's `transition` is
   * set; a controlled parent that keeps `open` vetoes it). Never called for a dismissal: that goes
   * to `onOpenChange`. May be a Server Function. Rejections reach the nearest Error Boundary
   * above Root.
   *
   * A `setState` placed after your own `await` is not a Transition update; wrap it in
   * `startTransition` (React limitation).
   */
  openChangeAction?: ChangeAction<boolean, DialogOpenChangeDetails>;
  /**
   * Facts only: the dialog was closed without the library closing it (Escape, Android back, an
   * assistive-technology dismiss, a click outside with `lightDismiss`, script `close()` /
   * `requestClose()`). Always `false`, with `returnValue` as the browser left it. Called
   * synchronously in the platform's `close` event, outside any Transition, and not awaited:
   * nothing is pending and no view transition runs; the dialog is already closed and its
   * committed state is already `false` (uncontrolled). A dismissal while a part's close is in
   * flight is reported at once and supersedes that close.
   *
   * Controlled: set your state **directly** here (`onOpenChange={setOpen}`), not in
   * `startTransition` and not after an `await`; a parent that keeps `open={true}` gets the
   * dialog re-opened at once. May return a promise (a Server Function); a rejection or a throw
   * goes to `reportError`.
   */
  onOpenChange?: UrgentChangeHandler<boolean, DialogOpenChangeDetails>;
  /**
   * `showModal()` (top layer, backdrop, inert page, Escape) or `show()`.
   *
   * @defaultValue `true`
   */
  modal?: boolean;
  /** The parts. The function form receives the optimistic state and must not suspend. */
  children?: StateValue<ReactNode, DialogRootState>;
}

const dialogDetails = (
  event: Event | undefined,
  reason: ChangeReason,
  returnValue?: string,
): DialogOpenChangeDetails => createActionDetails(event, { reason, returnValue });

const isDialogOpen = (dialog: HTMLDialogElement): boolean => dialog.open;

/**
 * Owns the ids, the mode, the open state and the context. Renders no DOM, so it has no `ref`,
 * `className` or `style`; `pending` is exposed through `children(state)` and the Trigger.
 *
 * Without `open`, `defaultOpen`, `openChangeAction` and `onOpenChange` the Dialog runs in
 * **JS-free mode**: the Trigger is a native `command="show-modal"` invoker and the browser owns
 * everything. With any of them it runs in **library mode**: opening is a request, a transition
 * (the Trigger shows `data-pending`, content renders from committed state, `showModal()` runs
 * when it has committed), and so is a close a part asks for (Close, Form, a foreign close
 * command: `openChangeAction(false)` is awaited, `close(returnValue)` runs when it has
 * committed). Dismissals (Escape, a click outside) are the browser's facts, reported to
 * `onOpenChange`.
 *
 * @see https://ui.funstack.work/components/dialog
 */
export function DialogRoot({ modal = true, ...props }: DialogRootProps) {
  return useDialogRoot(props, { namespace: "Dialog", modal, component: "dialog" });
}

DialogRoot.displayName = "DialogRoot";

/** What a caller of `useDialogRoot` fixes (design/components/alert-dialog.md 8). */
export interface DialogRootOptions {
  readonly namespace: DialogNamespace;
  readonly modal: boolean;
  /**
   * The component of the transition types (`fsui-<component>`, conventions 5.3): `"dialog"` for
   * Dialog and AlertDialog, `"drawer"` for Drawer (design/components/drawer.md 9).
   */
  readonly component: "dialog" | "drawer";
}

/**
 * The body of `Dialog.Root`, also run by `AlertDialog.Root` with `modal` fixed to `true`
 * (design/components/alert-dialog.md 8) and by `Drawer.Root` with its own transition types
 * (drawer.md 9).
 */
export function useDialogRoot(
  { open, defaultOpen, openChangeAction, onOpenChange, children }: Omit<DialogRootProps, "modal">,
  { namespace, modal, component }: DialogRootOptions,
): ReactNode {
  // The popover machinery (design/components/popover.md 14.1) with the `<dialog>`'s `open` and
  // `returnValue` in the details: an open's `returnValue` is an own `undefined`.
  const root = useOverlayRoot<DialogOpenChangeDetails, HTMLDialogElement, [returnValue: string]>({
    component,
    part: `${namespace}.Root`,
    open,
    defaultOpen,
    openChangeAction,
    onOpenChange,
    details: dialogDetails,
    isShown: isDialogOpen,
  });
  const { mode, intended, latestInFlight, optimistic, requestClose: closeRoot } = root;

  // The `returnValue` of a pending part-initiated close (design 2.3), handed to the apply
  // effect's `close()`. Stale once `true` is intended again (a vetoed close snapped back, or a
  // re-open), so the commit that shows it clears it.
  const closeReturnValue = useRef<string | undefined>(undefined);
  useInsertionEffect(() => {
    if (intendedValue(latestInFlight, optimistic)) closeReturnValue.current = undefined;
  });
  const takeCloseReturnValue = useCallback((): string => {
    const value = closeReturnValue.current;
    closeReturnValue.current = undefined;
    return value ?? "";
  }, []);

  // A library-owned close (design 2.3): `openChangeAction(false)` is awaited and the Popup's
  // apply effect calls `close(returnValue)` in the commit that ends it. A fact's `notifyClosed`
  // records no `returnValue`.
  const requestClose = useCallback(
    (event: Event | undefined, reason: ChangeReason, returnValue: string): void => {
      if (mode !== "library" || !intended()) return;
      closeReturnValue.current = returnValue;
      closeRoot(event, reason, returnValue);
    },
    [mode, intended, closeRoot],
  );

  // Memoised: `root` changes only with the open state and pending, so the value changes only
  // with those and `modal`, and the parts do not re-render for an unrelated render of the Root.
  // The Popup names a Title and a Description only while they are mounted (#218).
  const parts = useTitleDescriptionPresence(root.ids);
  const context = useMemo<DialogContextValue>(
    () => ({ ...root, modal, parts, requestClose, takeCloseReturnValue }),
    [root, modal, parts, requestClose, takeCloseReturnValue],
  );

  const state: DialogRootState = { open: optimistic, pending: root.pending, modal };

  return <DialogContext value={context}>{resolveStateValue(children, state)}</DialogContext>;
}

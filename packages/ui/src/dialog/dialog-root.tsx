"use client";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createActionDetails } from "../internal/action-details.js";
import { transitionTypes } from "../internal/transition-types.js";
import type { ActionDetails, ChangeAction, ChangeReason, StateValue } from "../internal/types.js";
import { useControllableAction } from "../internal/use-controllable-action.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { resolveStateValue } from "../internal/use-render.js";
import { DialogContext } from "./dialog-context.js";
import type { DialogCloseIntent, DialogContextValue, DialogMode } from "./dialog-context.js";

/** Details passed as the second argument of `openChangeAction`. */
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
   * closed it, `""` for a dismiss. On open: `undefined`.
   */
  readonly returnValue: string | undefined;
}

export interface DialogRootState {
  /** Optimistic open state (`false` in JS-free mode). Content rendered from it must not suspend. */
  readonly open: boolean;
  /** An `openChangeAction` dispatched through this Dialog is in flight (library mode only). */
  readonly pending: boolean;
  readonly modal: boolean;
}

export interface DialogRootProps {
  /**
   * Controlled open state. `undefined` means uncontrolled (and, with `defaultOpen` and
   * `openChangeAction` also absent, JS-free mode).
   */
  open?: boolean;
  /**
   * Initial open state in uncontrolled library mode. The dialog opens after hydration, never in
   * the server HTML.
   */
  defaultOpen?: boolean;
  /**
   * Awaited for `true` (the dialog opens when it resolves and the content has rendered); a
   * notification for `false` (the dialog is already closed; the action runs inside the Root's
   * transition). May be a Server Function. Rejections reach the nearest Error Boundary above
   * Root.
   *
   * A controlled parent that does not adopt `false` gets the dialog re-opened once the action
   * settles: closing is the browser's, this is not a veto.
   *
   * A `setState` placed after your own `await` is not a Transition update; wrap it in
   * `startTransition` (React limitation).
   */
  openChangeAction?: ChangeAction<boolean, DialogOpenChangeDetails>;
  /** `showModal()` (top layer, backdrop, inert page, Escape) or `show()`. Default `true`. */
  modal?: boolean;
  children?: StateValue<ReactNode, DialogRootState>;
}

/** How long a recorded close intent survives when the dialog did not close (design 2.3). */
function clearLater(
  intentRef: { current: DialogCloseIntent | undefined },
  intent: DialogCloseIntent,
  dialogRef: { current: HTMLDialogElement | null },
): void {
  setTimeout(() => {
    // The dialog closed: its `close` event (queued as a task) consumes the intent. Still open:
    // the close was cancelled (a prevented `cancel` or `command`), so the intent is stale.
    if (intentRef.current === intent && dialogRef.current?.open === true) {
      intentRef.current = undefined;
    }
  }, 0);
}

/**
 * Owns the ids, the mode, the open state and the context. Renders no DOM, so it has no `ref`,
 * `className` or `style`; `pending` is exposed through `children(state)` and the Trigger.
 *
 * Without `open`, `defaultOpen` and `openChangeAction` the Dialog runs in **JS-free mode**: the
 * Trigger is a native `command="show-modal"` invoker and the browser owns everything. With any of
 * them it runs in **library mode**: opening is a transition (the Trigger shows `data-pending`,
 * content renders from committed state, `showModal()` runs when it has committed); closing is
 * the browser's and `openChangeAction(false)` is a notification.
 */
export function DialogRoot({
  open,
  defaultOpen,
  openChangeAction,
  modal = true,
  children,
}: DialogRootProps) {
  // Mode is decided once, from the first render's props (design 14).
  const isLibraryNow =
    open !== undefined || defaultOpen !== undefined || openChangeAction !== undefined;
  const [mode] = useState<DialogMode>(isLibraryNow ? "library" : "static");
  const isLibrary = mode === "library";
  useDevWarning(
    isLibrary !== isLibraryNow,
    "Dialog.Root: the mode changed after mount (`open`, `defaultOpen` and `openChangeAction` " +
      "were all absent on one render and present on another). Switching between JS-free and " +
      "library mode is not supported.",
  );

  // Hooks cannot be conditional: static mode calls the hook too and never dispatches.
  const { committed, optimistic, pending, dispatch, latestInFlight } = useControllableAction<
    boolean,
    DialogOpenChangeDetails
  >({
    controlled: isLibrary ? open : undefined,
    defaultValue: isLibrary ? defaultOpen : undefined,
    initialValue: false,
    action: isLibrary ? openChangeAction : undefined,
    transitionTypes: (next) => transitionTypes("dialog", next ? "open" : "close"),
    warn: { component: "Dialog.Root", prop: "open" },
  });

  const id = useId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const closeIntent = useRef<DialogCloseIntent | undefined>(undefined);

  const recordCloseIntent = useCallback((intent: DialogCloseIntent | undefined) => {
    closeIntent.current = intent;
    if (intent !== undefined) clearLater(closeIntent, intent, dialogRef);
  }, []);
  const takeCloseIntent = useCallback(() => {
    const intent = closeIntent.current;
    closeIntent.current = undefined;
    return intent;
  }, []);
  // Advanced on every open (the open dispatch and the Popup's native `beforetoggle` to open), so a Close action that
  // settles after the user dismissed and re-opened the dialog does not close the new open (the
  // PO's open-generation rule, design/components/popover.md 3.4; review M2).
  const generation = useRef(0);
  const openGeneration = useCallback(() => generation.current, []);
  const nextOpenGeneration = useCallback(() => {
    generation.current++;
  }, []);

  // What the user already intends: the latest in-flight dispatch, else the optimistic value
  // (conventions 3.8 rule 1). Judging no-ops against it also deduplicates the StrictMode re-run
  // of the mount reconciliation and recognises the library's own `close()` echoing back.
  const intended = useCallback(
    (): boolean => latestInFlight()?.next ?? optimistic,
    [latestInFlight, optimistic],
  );

  const requestOpen = useCallback(
    (event: Event | undefined, reason: ChangeReason): void => {
      if (!isLibrary || intended()) return;
      nextOpenGeneration();
      dispatch(true, createActionDetails(event, { reason, returnValue: undefined }));
    },
    [isLibrary, intended, nextOpenGeneration, dispatch],
  );

  const notifyClosed = useCallback(
    (event: Event, reason: ChangeReason, returnValue: string): void => {
      if (!isLibrary || !intended()) return;
      dispatch(false, createActionDetails(event, { reason, returnValue }));
    },
    [isLibrary, intended, dispatch],
  );

  const openState = isLibrary && optimistic;
  const pendingState = isLibrary && pending;
  const committedState = isLibrary && committed;

  // Memoised (#48): `dispatch` is stable, so the value changes only with the open state, pending
  // and `modal`, and the parts do not re-render for an unrelated render of the Root.
  const context = useMemo<DialogContextValue>(
    () => ({
      mode,
      ids: { dialog: id, title: `${id}-title`, description: `${id}-description` },
      modal,
      committed: committedState,
      optimistic: openState,
      pending: pendingState,
      requestOpen,
      notifyClosed,
      latestInFlight,
      triggerRef,
      dialogRef,
      recordCloseIntent,
      takeCloseIntent,
      openGeneration,
      nextOpenGeneration,
    }),
    [
      mode,
      id,
      modal,
      committedState,
      openState,
      pendingState,
      requestOpen,
      notifyClosed,
      latestInFlight,
      recordCloseIntent,
      takeCloseIntent,
      openGeneration,
      nextOpenGeneration,
    ],
  );

  const state: DialogRootState = {
    open: openState,
    pending: pendingState,
    modal,
  };

  return <DialogContext value={context}>{resolveStateValue(children, state)}</DialogContext>;
}

DialogRoot.displayName = "DialogRoot";

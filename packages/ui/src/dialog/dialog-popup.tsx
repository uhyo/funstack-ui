"use client";
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  ReactNode,
  RefObject,
  ViewTransitionClass,
} from "react";
import { useContentFocusProbe } from "../internal/content-focus-probe.js";
import { withCssTransitionCut } from "../internal/css-transition-cut.js";
import {
  commandOf,
  renderOverlayContent,
  resolveInitialFocus,
  returnFocusToTrigger,
  useCloseHold,
  useInitialFocusTarget,
  useJsFreePropWarnings,
} from "../internal/overlay-popup.js";
import { createPopupFlags, showWithFocus } from "../internal/overlay-show.js";
import { useApplyOpenState } from "../internal/use-apply-open-state.js";
import { eventSource } from "../internal/invokers.js";
import { useTransitionBoundary } from "../internal/transition-boundary.js";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useElementCheck } from "../internal/use-element-check.js";
import { useLatest } from "../internal/use-latest.js";
import { useModalRegistration } from "../internal/use-modal-registration.js";
import { useShownNameWarning } from "../internal/use-name-warning.js";
import { resolveStateValue, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { useDialogContext } from "./dialog-context.js";
import { listenDialogDismiss } from "./dialog-dismiss.js";

/**
 * State of `Dialog.Popup`, passed to the function forms of `className`, `style`, `children` and
 * `render`.
 */
export interface DialogPopupState {
  /** Committed open state (library mode); `false` in JS-free mode. Read `:open` for the DOM truth. */
  readonly open: boolean;
  /** The Root's `modal`. */
  readonly modal: boolean;
}

/**
 * Props of `Dialog.Popup`.
 *
 * @see https://ui.funstack.work/components/dialog
 */
export interface DialogPopupProps extends Omit<
  ComponentPropsWithRef<"dialog">,
  "id" | "open" | "closedby" | "onToggle" | "onBeforeToggle" | "className" | "style" | "children"
> {
  /**
   * Library mode: what happens to the children while the dialog is closed.
   * - `false` (default): not rendered. Mounting them is part of the opening transition, so
   *   content that suspends holds the open until it is ready. Unmount waits for the dialog's
   *   exit animations.
   * - `true`: rendered inside `<Activity mode="hidden">`: DOM and state preserved, effects
   *   stopped, pre-rendered at low priority. Not in the server HTML.
   *
   * Ignored in JS-free mode (always mounted).
   *
   * @defaultValue `false`
   */
  keepMounted?: boolean;
  /**
   * Element to focus when the dialog opens: a ref, or a selector resolved inside the dialog.
   * The library writes `autofocus` on it right before `showModal()` / `show()` and the platform
   * focuses it. Use `tabIndex={-1}` on a heading or wrapper for long or destructive dialogs (APG).
   *
   * In JS-free mode the browser opens the dialog itself, so the attribute is written after
   * hydration and kept while mounted; before hydration only `autoFocus` in the markup works.
   *
   * @defaultValue the platform's choice (first focusable descendant; the dialog itself if none)
   */
  initialFocus?: RefObject<HTMLElement | null> | string;
  /**
   * Close on a click outside the dialog (on the backdrop for modal dialogs).
   * Baseline: JS `pointerdown` + `click` listeners, which close only when both the press and the
   * click land outside (a drag that starts inside, such as selecting text, never closes); with
   * `experimental_closedBy`, native `closedby="any"`, which behaves the same. A click on the
   * Trigger of an open non-modal dialog counts as outside, as it does natively.
   *
   * @defaultValue `false`
   */
  lightDismiss?: boolean;
  /**
   * Experimental (Chrome 134+, Firefox 141+; Safari 27.0 ignores it). Renders `closedby`
   * (`"any"` when `lightDismiss`, else `"closerequest"`) and skips the JS dismiss listeners where
   * `HTMLDialogElement.prototype.closedBy` exists. Elsewhere the JS baseline stays active.
   *
   * @defaultValue `false`
   */
  experimental_closedBy?: boolean;
  /**
   * Library mode only. Forwarded to the `<ViewTransition default>` around the dialog. Animates
   * the opening commit, content changes while open, and every library-driven close (a Close
   * part, a Form submit or settled action, a foreign close command, a controlled
   * `open={false}`), in all engines; dismissals (Escape, a click outside: `onOpenChange`) are the
   * browser's and animate with CSS only, never with a view transition. Ignored (dev warning) in
   * JS-free mode. While a view transition runs, the dialog's CSS transitions are turned off for
   * the moment of the library's own show or close (an inline `transition: none !important`,
   * restored right after), so that show or close runs no CSS transition (a `@keyframes`
   * animation is not cut).
   *
   * Static: setting or unsetting it remounts the element. Any value, `"none"` included, makes a
   * mount or `<Activity>` reveal inside a transition start a document view transition (a ~250 ms
   * page cross-fade that the next transition waits for).
   */
  transition?: ViewTransitionClass;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, DialogPopupState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, DialogPopupState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, DialogPopupState>;
  /** Must render a `<dialog>`. */
  render?: RenderProp<ComponentPropsWithRef<"dialog">, DialogPopupState>;
}

const isDev = process.env.NODE_ENV !== "production";

/** The submitter's or invoker's `value` (`""` without one, or where the engine gives no source). */
function valueOf(element: unknown): string {
  if (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) {
    return element.value;
  }
  return "";
}

/**
 * The dialog itself: a `<dialog>` with the id the Trigger's `commandfor` names, wired to Title
 * and Description through `aria-labelledby` / `aria-describedby`. Never renders `open`: modal
 * opening and closing go through `showModal()` / `close()` only. Style it with `:open` and
 * `:modal`; it emits `data-modal` but no `data-open`.
 *
 * In library mode the children render from committed state, so content that suspends keeps the
 * dialog closed (and the Trigger pending) until it is ready; `showModal()` runs in the layout
 * effect of the commit that mounted them. A close a part asks for (Close, a `method="dialog"`
 * submit, a Form's settle close, a foreign close command) is cancelled and goes through the
 * Root: `openChangeAction(false)` is awaited and `close(returnValue)` runs in the layout effect
 * of the commit that ends it, inside the view transition if `transition` is set. A dismissal
 * (Escape, a click outside, script) is the browser's, a fact: the native `close` event makes
 * committed state `false` urgently and calls `onOpenChange(false, { reason: "dismiss",
 * returnValue })`; no view transition runs for it.
 *
 * Owned keys (conventions 1.2): `id`, `open`, `closedby`, `aria-labelledby` and
 * `aria-describedby` (token-merged), `data-modal`, `suppressHydrationWarning`.
 *
 * @see https://ui.funstack.work/components/dialog
 */
export function DialogPopup({
  keepMounted,
  initialFocus,
  lightDismiss = false,
  experimental_closedBy = false,
  transition,
  className,
  style,
  children,
  render,
  ...rest
}: DialogPopupProps) {
  const ctx = useDialogContext("Dialog.Popup");
  const isLibrary = ctx.mode === "library";
  const { modal, ids, popupRef, triggerRef } = ctx;
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);
  // `awaitingClose` (the `close` event of a close has not arrived), the library echo
  // `libraryClose` (every other close is a fact, dialog.md 2.7, reported the moment it happens,
  // also while a part's close is in flight) and `refusedFact` (conventions 3.9.4), as
  // usePopoverPopup's.
  const [flags] = useState(createPopupFlags);
  const initialFocusTarget = useInitialFocusTarget("Dialog.Popup", "dialog");

  // `held`: children stay mounted while the close animates (design 4.4).
  const exit = useCloseHold(ctx.committed, isLibrary, transition);

  // Whether the content unmounted while holding focus since the dialog was last shown: a close
  // with `transition` removes the focused Close part before `close()` runs (design 6.2 rule 2).
  const contentProbe = useContentFocusProbe(popupRef);
  const { wrapContent } = contentProbe;

  // Toast's Viewport moves its region into the topmost open modal (design/components/toast.md 4.3).
  useModalRegistration(dialog);

  useJsFreePropWarnings("Dialog.Popup", "dialog", isLibrary, transition, keepMounted);

  const checkElement = useElementCheck<HTMLDialogElement>(
    isDev &&
      ((element) =>
        element.tagName !== "DIALOG"
          ? `Dialog.Popup: expected to render a <dialog> element but got <${element.tagName.toLowerCase()}>. ` +
            "Top layer, backdrop, focus and Escape all come from a real <dialog>."
          : null),
  );
  // --- Opening -----------------------------------------------------------------------------

  const openDialog = (element: HTMLDialogElement): void => {
    // A refused re-open of a non-modal dialog never moves focus (#156): no initial focus target,
    // and the dialog is `inert` for the duration of `show()`, so the dialog focusing steps focus
    // nothing (a consumer's own `inert` is left alone). A modal dialog must hold focus: its
    // re-open is a normal open. Two steps on purpose: the flag is taken (and cleared) on every
    // show, a modal one included; `!modal && take()` would leave it set for a modal dialog.
    const wasRefused = flags.takeRefusedFact();
    const refused = wasRefused && !modal;
    // Otherwise the platform's dialog focusing steps honour `autofocus` (design 6.1).
    showWithFocus(element, {
      refused,
      autofocus: refused ? null : initialFocusTarget(element, initialFocus),
      // A view transition animates the open: the CSS enter does not run next to it (conventions
      // 5.1).
      show: () =>
        withCssTransitionCut(element, transition !== undefined, () => {
          if (modal) element.showModal();
          else element.show();
        }),
    });
  };

  // Mount reconciliation (design 2.4): a click before hydration opened the dialog natively.
  // Runs before the apply effect; the dispatch makes the apply effect wait for it.
  const reconcileOnMount = useEffectEvent(() => {
    const element = popupRef.current;
    if (element === null || !element.open) return;
    ctx.requestOpen(undefined, "platform");
  });
  useLayoutEffect(() => {
    if (isLibrary) reconcileOnMount();
  }, [isLibrary]);

  // The apply effect (design 2.5), shared with usePopoverPopup. Keep this call right after mount
  // reconciliation (as there): layout effects run in call order, and at mount the
  // reconciliation's dispatch must come first, so that the first apply sees it in flight and
  // waits. Opens on the user's dispatch, `defaultOpen`, a controlled parent, the re-open of a
  // dismissal a controlled parent refused; closes after a part-initiated close settled, a
  // controlled close, or a refused pre-hydration open.
  useApplyOpenState(ctx, {
    flags,
    exit,
    probe: contentProbe,
    isShown: (element) => element.open,
    show: openDialog,
    hide: (element) => {
      // `close()`, not `requestClose()`: the veto point was `openChangeAction`, not `cancel`. The
      // part's `returnValue` (design 2.3), `""` for a controlled close.
      const returnValue = ctx.takeCloseReturnValue();
      withCssTransitionCut(element, transition !== undefined, () => element.close(returnValue));
      // The close commit may have unmounted the focused content before `close()`: a non-modal
      // dialog restores focus only from inside, so do it now (a modal one always restores it on
      // `close()`).
      if (contentProbe.hadFocus()) {
        contentProbe.forget();
        returnFocusToTrigger(element, triggerRef.current);
      }
    },
  });

  // JS-free mode: there is no "right before showModal()" (the browser runs the command), so the
  // `autofocus` attribute stays on the target while it is mounted.
  useEffect(() => {
    if (isLibrary || initialFocus === undefined || dialog === null) return;
    const target = resolveInitialFocus(dialog, initialFocus);
    if (target === null || !dialog.contains(target) || target.hasAttribute("autofocus")) return;
    target.setAttribute("autofocus", "");
    return () => target.removeAttribute("autofocus");
  }, [isLibrary, initialFocus, dialog]);

  // --- Native listeners (conventions 7.4) ---------------------------------------------------

  const onCommand = useEffectEvent((event: Event) => {
    const element = popupRef.current;
    if (element === null || event.target !== element || event.defaultPrevented) return;
    const command = commandOf(event);
    if (command === "show-modal") {
      // A foreign invoker (design 2.2): opening goes through the library in library mode.
      if (!isLibrary) return;
      event.preventDefault();
      ctx.requestOpen(event, "activate");
    } else if (command === "request-close" || command === "close") {
      if (isLibrary) {
        // A foreign close invoker (design 2.3) goes through the library like a foreign
        // `show-modal`: same markup as Dialog.Close, same behaviour. `source` is the invoker
        // (`""` where an engine gives none).
        event.preventDefault();
        ctx.requestClose(event, "activate", valueOf(eventSource(event)));
      } else if (element.open) {
        // The `command` event fires whatever the dialog's state (HTML): a close at a closed
        // dialog leaves no intent for a later close.
        ctx.recordCloseIntent({ reason: "activate", event });
      }
    }
  });

  // On the dialog's root node (the document, or a shadow root: `submit` is not composed), bubble
  // phase: after React's root listener, so a consumer's `onSubmit` has run (design 8.1).
  const onSubmit = useEffectEvent((event: Event) => {
    const element = popupRef.current;
    const form = event.target;
    if (element === null || !(form instanceof HTMLFormElement)) return;
    if (form.closest("dialog") !== element) return;
    const submitter = (event as SubmitEvent).submitter;
    const formMethod = submitter?.getAttribute("formmethod");
    const method = formMethod != null ? formMethod.toLowerCase() : form.method;
    if (method !== "dialog") return;
    if (!isLibrary) {
      ctx.recordCloseIntent({ reason: "activate", event });
      return;
    }
    // The consumer blocked the submission: the form did not submit, the dialog stays open.
    if (event.defaultPrevented) return;
    // The consumer opted out with `stopPropagation()`: the browser closes the dialog, reported
    // as a fact. Checked explicitly because React's root can be this same node (FUNSTACK
    // Static hydrates the document), where `stopPropagation()` does not stop this listener.
    if (event.cancelBubble) return;
    // Cancel the native close; the library closes once `openChangeAction(false)` settled.
    event.preventDefault();
    ctx.requestClose(event, "activate", valueOf(submitter));
  });

  // The `close` listener's work, also replayed for an element that remounted before its `close`
  // event (#159; `event` is `undefined` there: no event fired).
  const handleClose = (element: HTMLDialogElement, event: Event | undefined): void => {
    flags.endClose();

    // Focus return is the platform's; it leaves focus inside the hidden dialog only when the
    // opener is gone (design 6.2).
    const active = element.ownerDocument.activeElement;
    if (active !== null && element.contains(active)) {
      returnFocusToTrigger(element, triggerRef.current);
    }

    const intent = ctx.takeCloseIntent();
    const echo = flags.takeLibraryClose();
    if (!isLibrary) return;

    // The library's own `close()` is no fact.
    exit.afterClose(element, echo);

    if (echo) return;
    flags.markFact();
    // Closed by the browser: a returnValue a pending part close recorded will never be used.
    ctx.takeCloseReturnValue();
    // A fact, also while a part's close is in flight: it supersedes that request (committed
    // `false` now) and `onOpenChange(false)` is called (conventions 3.9.5, dialog.md 2.7).
    ctx.notifyClosed(intent?.event ?? event, intent?.reason ?? "dismiss", element.returnValue);
  };
  const latestHandleClose = useLatest(handleClose);

  const onClose = useEffectEvent((event: Event) => {
    const element = popupRef.current;
    if (element === null || event.target !== element) return;
    handleClose(element, event);
  });

  // Whether the Popup is mounted, for the #159 replay. A passive effect: a Suspense hide detaches
  // the element's ref (and runs layout cleanups) but keeps passive effects, so a hidden Popup
  // still counts as mounted.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, [mounted]);

  const libraryRef = useCallback(
    (element: HTMLDialogElement) => {
      checkElement?.(element);
      popupRef.current = element;
      // A new element (a remount mid-close): the old one's `close` event never comes (#159). A
      // lost fact is replayed a timer task later, unless the Popup unmounted meanwhile; also while
      // a Suspense boundary hides it (the fact happened before the hide). Here, not in the
      // listener effect's cleanup: that passive cleanup runs after the remount's layout effects,
      // and no apply follows it.
      flags.attach(element, (lost) => {
        if (mounted.current) latestHandleClose.current(lost as HTMLDialogElement, undefined);
      });
      setDialog(element);
      return () => {
        if (popupRef.current === element) popupRef.current = null;
        setDialog(null);
      };
    },
    [checkElement, popupRef, flags, latestHandleClose, mounted],
  );

  const onBeforeToggle = useEffectEvent((event: Event) => {
    const element = popupRef.current;
    if (element === null || event.target !== element) return;
    const newState = (event as ToggleEvent).newState;
    // An open does not end a close (as Popover's): the close's `close` event still comes, HTML
    // queues it whatever follows, and nothing reads the flag while the dialog is shown (#159).
    if (newState === "closed") {
      flags.beginClose();
      // What already runs inside is not the exit.
      exit.recordBaseline(element);
    }
    // Every native open counts as a new opening (design 3.4, as Popover 14.1): foreign,
    // pre-hydration and JS-free opens too, so a Close action from an earlier opening skips its
    // close. Counted here, synchronously inside `showModal()` / `show()`, not at the queued
    // `toggle`: an action settling between the open and that task would otherwise still see the
    // old generation and close the new open.
    if (newState === "open") {
      ctx.nextOpenGeneration();
      contentProbe.forget();
    }
  });

  useEffect(() => {
    if (dialog === null) return;
    // The document, or the shadow root the dialog lives in (`submit` does not cross it).
    const root = dialog.getRootNode();
    // Feature detection only with the flag on, inside an effect (conventions 8).
    const nativeClosedBy = experimental_closedBy && "closedBy" in dialog;

    const listeners: [EventTarget, string, EventListener, boolean][] = [
      [dialog, "command", onCommand, false],
      // Bubble phase on the root node: after React's root listener (the consumer's `onSubmit`).
      [root, "submit", onSubmit, false],
      [dialog, "close", onClose, false],
      [dialog, "beforetoggle", onBeforeToggle, false],
    ];

    for (const [target, type, listener, capture] of listeners) {
      target.addEventListener(type, listener, capture);
    }
    // Escape on a non-modal dialog and light dismiss, where native `closedby` does not do them.
    const stopDismiss = nativeClosedBy
      ? null
      : listenDialogDismiss(dialog, { modal, lightDismiss });
    return () => {
      for (const [target, type, listener, capture] of listeners) {
        target.removeEventListener(type, listener, capture);
      }
      stopDismiss?.();
    };
  }, [dialog, modal, lightDismiss, experimental_closedBy]);

  // Development check (design 9): the dialog has an accessible name when it is (or can be)
  // shown.
  useShownNameWarning(
    dialog,
    !isLibrary || ctx.committed,
    isDev &&
      "Dialog.Popup: the dialog has no accessible name. Render a Dialog.Title, or give the " +
        "Popup an `aria-label`.",
  );

  const state: DialogPopupState = { open: ctx.committed, modal };
  const visible = ctx.committed || exit.held;

  const content = (s: DialogPopupState): ReactNode =>
    renderOverlayContent({ isLibrary, keepMounted, visible, wrapContent }, () =>
      resolveStateValue(children, s),
    );

  const libraryProps: ComponentPropsWithRef<"dialog"> & DataAttributes = {
    id: ids.popup,
    // Never rendered: removing `open` by hand hides a modal dialog without `close` and leaves
    // `:modal` true (research). Owned so a `render` element cannot add it.
    open: undefined,
    closedby: experimental_closedBy ? (lightDismiss ? "any" : "closerequest") : undefined,
    "aria-labelledby": ids.title,
    "aria-describedby": ids.description,
    "data-modal": dataAttr(modal),
    // A pre-hydration open leaves an `open` attribute the server did not render (design 2.4).
    suppressHydrationWarning: true,
  };

  const element = useRender<ComponentPropsWithRef<"dialog">, DialogPopupState>({
    defaultElement: "dialog",
    render,
    state,
    className,
    style,
    children: content,
    props: rest,
    libraryProps,
    ref: libraryRef,
  });

  return useTransitionBoundary("Dialog.Popup", isLibrary ? transition : undefined, element);
}

DialogPopup.displayName = "DialogPopup";

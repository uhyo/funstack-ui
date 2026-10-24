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
import { renderOverlayContent } from "../internal/overlay-popup.js";
import { isPopoverOpen } from "../internal/popover-open.js";
import { useTransitionBoundary } from "../internal/transition-boundary.js";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useElementCheck } from "../internal/use-element-check.js";
import { useExitAnimation } from "../internal/use-exit-animation.js";
import { useModalRegistration } from "../internal/use-modal-registration.js";
import { useShownNameWarning } from "../internal/use-name-warning.js";
import { resolveStateValue, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { useDialogContext } from "./dialog-context.js";

export interface DialogPopupState {
  /** Committed open state (library mode); `false` in JS-free mode. Read `:open` for the DOM truth. */
  readonly open: boolean;
  readonly modal: boolean;
}

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
   */
  keepMounted?: boolean;
  /**
   * Element to focus when the dialog opens: a ref, or a selector resolved inside the dialog.
   * The library writes `autofocus` on it right before `showModal()` / `show()` and the platform
   * focuses it. Default: the platform's choice (first focusable descendant; the dialog itself if
   * none). Use `tabIndex={-1}` on a heading or wrapper for long or destructive dialogs (APG).
   *
   * In JS-free mode the browser opens the dialog itself, so the attribute is written after
   * hydration and kept while mounted; before hydration only `autoFocus` in the markup works.
   */
  initialFocus?: RefObject<HTMLElement | null> | string;
  /**
   * Close on a click outside the dialog (on the backdrop for modal dialogs). Default `false`.
   * Baseline: JS `pointerdown` + `click` listeners, which close only when both the press and the
   * click land outside (a drag that starts inside, such as selecting text, never closes); with
   * `experimental_closedBy`, native `closedby="any"`, which behaves the same.
   */
  lightDismiss?: boolean;
  /**
   * Experimental (Chrome 134+, Firefox 141+; Safari 27.0 ignores it). Renders `closedby`
   * (`"any"` when `lightDismiss`, else `"closerequest"`) and skips the JS dismiss listeners where
   * `HTMLDialogElement.prototype.closedBy` exists. Elsewhere the JS baseline stays active.
   * Default `false`.
   */
  experimental_closedBy?: boolean;
  /**
   * Library mode only. Forwarded to the `<ViewTransition default>` around the dialog. Animates
   * the opening commit, content changes while open, and every library-driven close (a Close
   * part, a Form submit or settled action, a foreign close command, a controlled
   * `open={false}`), in all engines; dismissals (Escape, a click outside) are the browser's and
   * animate with CSS only. Ignored (dev warning) in JS-free mode.
   *
   * Static: setting or unsetting it remounts the element. Any value, `"none"` included, makes a
   * mount or `<Activity>` reveal inside a transition start a document view transition (a ~250 ms
   * page cross-fade that the next transition waits for).
   */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, DialogPopupState>;
  style?: StateValue<CSSProperties | undefined, DialogPopupState>;
  children?: StateValue<ReactNode, DialogPopupState>;
  /** Must render a `<dialog>`. */
  render?: RenderProp<ComponentPropsWithRef<"dialog">, DialogPopupState>;
}

const isDev = process.env.NODE_ENV !== "production";

/** Resolves `initialFocus` against the dialog (a ref, or a selector inside the dialog). */
function resolveInitialFocus(
  dialog: HTMLDialogElement,
  initialFocus: RefObject<HTMLElement | null> | string,
): HTMLElement | null {
  if (typeof initialFocus === "string") return dialog.querySelector<HTMLElement>(initialFocus);
  return initialFocus.current;
}

/** The nearest `<dialog>` around a node (the dialog itself counts). */
function closestDialog(target: EventTarget | null): Element | null {
  return target instanceof Element ? target.closest("dialog") : null;
}

/**
 * An open popover that takes Escape before the dialog: `auto` or `hint` (they have a close
 * watcher). A `manual` popover, or `hint` where the engine maps it to `manual`, does not.
 */
function isOpenLightPopover(element: Element): boolean {
  if (!element.hasAttribute("popover")) return false;
  // The IDL attribute reflects the state the engine applies; jsdom has none.
  const reflected: unknown = (element as HTMLElement).popover;
  const state =
    typeof reflected === "string" ? reflected : element.getAttribute("popover")!.toLowerCase();
  if (state === "manual") return false;
  return isPopoverOpen(element);
}

/**
 * Whether Escape belongs to a layer inside `dialog` that sits above it (design 9: "closes the
 * innermost one only"): the target is inside an open nested `<dialog>` or popover, or an open
 * `auto` / `hint` popover inside the dialog would take the close request (close watchers are
 * per document, not per focus).
 */
function escapeBelongsToInnerLayer(dialog: HTMLDialogElement, target: EventTarget | null): boolean {
  for (
    let node = target instanceof Element ? target : null;
    node !== null && node !== dialog;
    node = node.parentElement
  ) {
    if (node instanceof HTMLDialogElement && node.open) return true;
    if (isOpenLightPopover(node)) return true;
  }
  for (const element of dialog.querySelectorAll("[popover]")) {
    if (isOpenLightPopover(element)) return true;
  }
  return false;
}

/** Whether a pointer event on the dialog itself lies outside its border box (the `::backdrop`). */
function onBackdrop(dialog: HTMLDialogElement, event: Event): boolean {
  if (event.target !== dialog) return false;
  const { clientX, clientY } = event as MouseEvent;
  const rect = dialog.getBoundingClientRect();
  return !(
    rect.top <= clientY &&
    clientY <= rect.bottom &&
    rect.left <= clientX &&
    clientX <= rect.right
  );
}

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
 * (Escape, a click outside) is the browser's: the native `close` event becomes
 * `openChangeAction(false, { reason: "dismiss", returnValue })`.
 *
 * Owned keys (conventions 1.2): `id`, `open`, `closedby`, `aria-labelledby` and
 * `aria-describedby` (token-merged), `data-modal`, `suppressHydrationWarning`.
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
  // Set by the synchronous `beforetoggle` of a close, cleared by the `close` event a task later:
  // the dialog is closed but its notification is not dispatched yet, so the apply effect must
  // not re-open it from a commit that lands in between.
  const awaitingClose = useRef(false);
  // Set right before the library's own `close()` (the apply effect), consumed by the `close`
  // event it causes: the echo is recognised by its source, not by what is intended.
  const libraryClose = useRef(false);
  // A dismissal (Escape, a click outside) that closed the dialog while a part-initiated close
  // was in flight. Its notification was skipped because `false` was intended; if that
  // close then settles with committed `true` (a controlled parent vetoed it), the apply effect
  // sends the dismissal instead of re-opening. Valid only for the open generation it was
  // recorded in: a re-open (Trigger, foreign invoker) supersedes it.
  const dismissedWhilePending = useRef<{
    readonly event: Event;
    readonly returnValue: string;
    readonly generation: number;
  } | null>(null);
  const warnedFocus = useRef(false);

  // --- `held`: children stay mounted while the close animates (design 4.4) -----------------

  const exit = useExitAnimation();

  // A library-driven close commits `false` first and closes in the layout effect, so without
  // `transition` the children are held through the close commit ("previous value in state").
  // With `transition` the close commit unmounts them inside the view transition, whose old
  // snapshot carries the content out. (A dismissal's notification commit sets it too; the apply
  // effect's release rule clears that one.)
  const [prevCommitted, setPrevCommitted] = useState(ctx.committed);
  if (prevCommitted !== ctx.committed) {
    setPrevCommitted(ctx.committed);
    if (isLibrary && prevCommitted && transition === undefined) exit.holdDuringRender();
  }

  // Whether the content unmounted while holding focus since the dialog was last shown: a close
  // with `transition` removes the focused Close part before `close()` runs (design 6.2 rule 2).
  const contentProbe = useContentFocusProbe(popupRef);
  const { wrapContent } = contentProbe;

  // Toast's Viewport moves its region into the topmost open modal (design/components/toast.md 4.3).
  useModalRegistration(dialog);

  useDevWarning(
    !isLibrary && transition !== undefined,
    isDev &&
      "Dialog.Popup: `transition` has no effect in JS-free mode; the browser opens and closes the " +
        "dialog outside any React transition. Animate it with CSS (`@starting-style`).",
  );
  useDevWarning(
    !isLibrary && keepMounted === false,
    isDev &&
      "Dialog.Popup: `keepMounted={false}` cannot be honoured in JS-free mode; the content is " +
        "always mounted so that the server HTML is complete.",
  );

  const checkElement = useElementCheck<HTMLDialogElement>(
    isDev &&
      ((element) =>
        element.tagName !== "DIALOG"
          ? `Dialog.Popup: expected to render a <dialog> element but got <${element.tagName.toLowerCase()}>. ` +
            "Top layer, backdrop, focus and Escape all come from a real <dialog>."
          : null),
  );
  const libraryRef = useCallback(
    (element: HTMLDialogElement) => {
      checkElement?.(element);
      popupRef.current = element;
      setDialog(element);
      return () => {
        if (popupRef.current === element) popupRef.current = null;
        setDialog(null);
      };
    },
    [checkElement, popupRef],
  );

  // --- Opening -----------------------------------------------------------------------------

  const openDialog = (element: HTMLDialogElement): void => {
    let target: HTMLElement | null = null;
    if (initialFocus !== undefined) {
      target = resolveInitialFocus(element, initialFocus);
      if (target === null || !element.contains(target)) {
        if (isDev && !warnedFocus.current) {
          warnedFocus.current = true;
          console.error(
            target === null
              ? "Dialog.Popup: `initialFocus` resolved to no element; the platform picks the focus target."
              : "Dialog.Popup: `initialFocus` is outside the dialog; the platform picks the focus target.",
          );
        }
        target = null;
      }
    }
    // The platform's dialog focusing steps honour `autofocus`; React drops `autoFocus` on
    // client-rendered content (react/react#23301). Never `.focus()` (design 6.1).
    const added = target !== null && !target.hasAttribute("autofocus");
    if (added) target!.setAttribute("autofocus", "");
    try {
      if (modal) element.showModal();
      else element.show();
    } finally {
      if (added) target!.removeAttribute("autofocus");
    }
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

  /**
   * Design 6.2 rule 2, after a close whose commit unmounted the focused content: when focus is
   * now on `<body>` or still inside the closed dialog, focus the Trigger (if connected), else
   * blur what holds focus. A modal dialog never needs it (the platform restores focus on
   * `close()` unconditionally); a non-modal one restores only when focus is inside.
   */
  const returnFocus = (element: HTMLDialogElement): void => {
    const doc = element.ownerDocument;
    const active = doc.activeElement;
    if (active !== null && active !== doc.body && !element.contains(active)) return;
    const trigger = triggerRef.current;
    if (trigger !== null && trigger.isConnected) trigger.focus();
    else if (active instanceof HTMLElement && active !== doc.body) active.blur();
  };

  // The apply effect (design 2.5), as usePopoverPopup's: once nothing is in flight, the DOM
  // follows committed state. Opens on the user's dispatch, `defaultOpen`, a controlled parent,
  // the re-open of a refused dismissal; closes after a part-initiated close settled, a controlled
  // close, or a refused pre-hydration open. Also returns focus after a close whose commit
  // unmounted the focused content, and releases a `held` no exit animation is going to release
  // (4.4). It runs only for commits that re-render the Popup (the Root's context is memoised):
  // do not rely on an unrelated render to re-apply state.
  useLayoutEffect(() => {
    if (!isLibrary) return;
    const element = popupRef.current;
    if (element === null || !element.isConnected) return;
    if (!ctx.pending && ctx.latestInFlight() === null) {
      const dismissed = dismissedWhilePending.current;
      if (ctx.committed && !element.open) {
        // Closed, but its `close` event has not arrived yet: wait for it.
        if (!awaitingClose.current) {
          dismissedWhilePending.current = null;
          if (dismissed !== null && dismissed.generation === ctx.openGeneration()) {
            // The user dismissed the dialog while a part's close was in flight, and that close
            // was vetoed: the dismissal stands and is notified now, instead of the
            // dialog coming back. A parent that keeps `open` again gets it re-opened, as for any
            // refused dismissal.
            ctx.notifyClosed(dismissed.event, "dismiss", dismissed.returnValue);
          } else {
            openDialog(element);
          }
        }
      } else if (!ctx.committed && element.open) {
        // The library's own close: the `close` listener recognises it by `libraryClose` and
        // dispatches nothing. `close()`, not `requestClose()`: the veto point was
        // `openChangeAction`, not `cancel`. The part's `returnValue` (design 2.3), `""` for a
        // controlled close.
        ctx.recordCloseIntent(undefined);
        libraryClose.current = true;
        element.close(ctx.takeCloseReturnValue());
        // The close commit may have unmounted the focused content before `close()`: a
        // non-modal dialog restores focus only from inside, so do it now.
        if (contentProbe.hadFocus()) {
          contentProbe.forget();
          returnFocus(element);
        }
      }
    }
    // The in-flight close settled as a close: the recorded dismissal is moot.
    if (!ctx.committed && dismissedWhilePending.current !== null && ctx.latestInFlight() === null) {
      dismissedWhilePending.current = null;
    }
    // Content that unmounted while the dialog stays open (not a close): forget it.
    if (ctx.committed && element.open) contentProbe.forget();
    // A hold the close commit set (or a dismissal's notification commit) that no exit animation
    // is going to release: the dialog is closed and its `close` event has been handled.
    if (exit.held && !ctx.committed && !exit.waiting() && !awaitingClose.current && !element.open) {
      exit.release();
    }
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
    if (event.target !== popupRef.current || event.defaultPrevented) return;
    const command = String((event as Event & { command?: string }).command ?? "").toLowerCase();
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
        const source = (event as Event & { source?: unknown }).source;
        ctx.requestClose(event, "activate", valueOf(source));
      } else {
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
    // The consumer opted out with `stopPropagation()`: the browser closes the dialog, notified
    // as a dismissal. Checked explicitly because React's root can be this same node (FUNSTACK
    // Static hydrates the document), where `stopPropagation()` does not stop this listener.
    if (event.cancelBubble) return;
    // Cancel the native close; the library closes once `openChangeAction(false)` settled.
    event.preventDefault();
    ctx.requestClose(event, "activate", valueOf(submitter));
  });

  const onClose = useEffectEvent((event: Event) => {
    const element = popupRef.current;
    if (element === null || event.target !== element) return;
    awaitingClose.current = false;

    // Focus return is the platform's; it leaves focus inside the hidden dialog only when the
    // opener is gone (design 6.2).
    const doc = element.ownerDocument;
    const active = doc.activeElement;
    if (active !== null && active !== doc.body && element.contains(active)) {
      const trigger = triggerRef.current;
      if (trigger !== null && trigger.isConnected) trigger.focus();
      else if (active instanceof HTMLElement) active.blur();
    }

    const intent = ctx.takeCloseIntent();
    const echo = libraryClose.current;
    libraryClose.current = false;
    if (!isLibrary) return;

    // The library's own `close()` needs no notification, and with `transition` no hold either:
    // the close commit's view transition carried the content out (4.4).
    if (!echo || transition === undefined) {
      const animations = exit.exitAnimations(element);
      if (animations.length > 0) {
        // Before the notification, so its commit keeps the children (urgent, internal).
        exit.holdUntil(animations);
      } else {
        // Nothing animates (Firefox, or no CSS exit): release a hold now; the commit is
        // invisible, the dialog is already `display: none`.
        exit.release();
      }
    }

    if (echo) return;
    // Closed by the browser: a returnValue a pending part close recorded will never be used.
    ctx.takeCloseReturnValue();
    if (ctx.intended()) {
      ctx.notifyClosed(intent?.event ?? event, intent?.reason ?? "dismiss", element.returnValue);
    } else {
      // A part's close is in flight (design walkthrough 11.13): nothing more to notify unless that
      // close is vetoed (the apply effect).
      dismissedWhilePending.current = {
        event: intent?.event ?? event,
        returnValue: element.returnValue,
        generation: ctx.openGeneration(),
      };
    }
  });

  const onBeforeToggle = useEffectEvent((event: Event) => {
    const element = popupRef.current;
    if (element === null || event.target !== element) return;
    const newState = (event as ToggleEvent).newState;
    awaitingClose.current = newState === "closed";
    // What already runs inside is not the exit.
    if (newState === "closed") exit.recordBaseline(element);
    // Every native open counts as a new opening (design 3.4, as Popover 14.1): foreign,
    // pre-hydration and JS-free opens too, so a Close action from an earlier opening skips its
    // close. Counted here, synchronously inside `showModal()` / `show()`, not at the queued
    // `toggle`: an action settling between the open and that task would otherwise still see the
    // old generation and close the new open.
    if (newState === "open") {
      dismissedWhilePending.current = null;
      ctx.nextOpenGeneration();
      contentProbe.forget();
    }
  });

  useEffect(() => {
    if (dialog === null) return;
    const doc = dialog.ownerDocument;
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

    if (!modal && !nativeClosedBy) {
      // Non-modal dialogs get no close watcher Escape from the platform (design 2.6).
      listeners.push([
        dialog,
        "keydown",
        (event) => {
          const keyboardEvent = event as KeyboardEvent;
          if (keyboardEvent.key !== "Escape" || keyboardEvent.defaultPrevented) return;
          if (!dialog.open || closestDialog(keyboardEvent.target) !== dialog) return;
          // A popover or nested dialog inside takes this Escape (its close watcher); leave the
          // event alone so that it can.
          if (escapeBelongsToInnerLayer(dialog, keyboardEvent.target)) return;
          keyboardEvent.preventDefault();
          dialog.requestClose();
        },
        false,
      ]);
    }

    // Light dismiss needs both the press and the click outside, like native `closedby="any"`: a
    // drag that starts inside (selecting text in an input) and ends on the backdrop or outside
    // fires `click` on the common ancestor and must not close (it would lose a half-filled form).
    let pressedOutside = false;

    const isOutside = (target: EventTarget | null): boolean => {
      if (!(target instanceof Node)) return true;
      if (dialog.contains(target)) return false;
      // The Trigger re-opening a non-modal dialog is not a click outside.
      return !(triggerRef.current?.contains(target) ?? false);
    };
    let outsideAttached = false;
    const onOutsidePointerDown = (event: Event) => {
      pressedOutside = dialog.open && isOutside(event.target);
    };
    const onOutsideClick = (event: Event) => {
      const pressed = pressedOutside;
      pressedOutside = false;
      if (!dialog.open || !pressed || !isOutside(event.target)) return;
      dialog.requestClose();
    };
    const syncOutside = () => {
      const want = dialog.open;
      if (want === outsideAttached) return;
      outsideAttached = want;
      pressedOutside = false;
      if (want) {
        doc.addEventListener("pointerdown", onOutsidePointerDown, true);
        doc.addEventListener("click", onOutsideClick, true);
      } else {
        doc.removeEventListener("pointerdown", onOutsidePointerDown, true);
        doc.removeEventListener("click", onOutsideClick, true);
      }
    };

    if (lightDismiss && !nativeClosedBy) {
      if (modal) {
        // A press or click on the ::backdrop targets the dialog itself, outside its border box.
        listeners.push(
          [
            dialog,
            "pointerdown",
            (event) => {
              pressedOutside = dialog.open && onBackdrop(dialog, event);
            },
            false,
          ],
          [
            dialog,
            "click",
            (event) => {
              const pressed = pressedOutside;
              pressedOutside = false;
              if (!dialog.open || !pressed || !onBackdrop(dialog, event)) return;
              dialog.requestClose();
            },
            false,
          ],
        );
      } else {
        // A document listener only while open, following the native `toggle` (the React
        // `onToggle` prop never fires on a hydrated <dialog>); reads `dialog.open`, not
        // `newState` (coalescing).
        listeners.push([dialog, "toggle", syncOutside, false]);
        syncOutside();
      }
    }

    for (const [target, type, listener, capture] of listeners) {
      target.addEventListener(type, listener, capture);
    }
    return () => {
      for (const [target, type, listener, capture] of listeners) {
        target.removeEventListener(type, listener, capture);
      }
      if (outsideAttached) {
        doc.removeEventListener("pointerdown", onOutsidePointerDown, true);
        doc.removeEventListener("click", onOutsideClick, true);
      }
    };
  }, [dialog, modal, lightDismiss, experimental_closedBy, triggerRef]);

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

"use client";
import {
  Activity,
  startTransition,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  ReactNode,
  RefObject,
  ViewTransitionClass,
} from "react";
import { useTransitionBoundary } from "../internal/transition-boundary.js";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
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
   * Baseline: a JS `click` listener; with `experimental_closedBy`, native `closedby="any"`.
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
   * the opening commit and content changes while open; the close is the browser's and animates
   * with CSS. Ignored (dev warning) in JS-free mode.
   *
   * Static: without `transition` the part renders no `<ViewTransition>`; changing it between
   * `undefined` and a value remounts the element. Any value, `"none"` included, makes a mount or
   * `<Activity>` reveal of this part inside a transition start a document view transition: the
   * page cross-fades for about 250 ms and the next transition commit waits for it (issue #35).
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

/** An animation that ends: infinite ones (a spinner) would hold the content forever. */
function ends(animation: Animation): boolean {
  const end = animation.effect?.getComputedTiming().endTime;
  return typeof end === "number" && Number.isFinite(end);
}

/**
 * The dialog itself: a `<dialog>` with the id the Trigger's `commandfor` names, wired to Title
 * and Description through `aria-labelledby` / `aria-describedby`. Never renders `open`: modal
 * opening and closing go through `showModal()` / `close()` only. Style it with `:open` and
 * `:modal`; it emits `data-modal` but no `data-open`.
 *
 * In library mode the children render from committed state, so content that suspends keeps the
 * dialog closed (and the Trigger pending) until it is ready; `showModal()` runs in the layout
 * effect of the commit that mounted them. Closing is the browser's: the native `close` event
 * becomes `openChangeAction(false, { reason, returnValue })`.
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
  const { modal, ids, dialogRef, triggerRef } = ctx;
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);
  // Children stay mounted while the dialog's exit animation runs (design 4.4).
  const [exiting, setExiting] = useState(false);
  const exitGeneration = useRef(0);
  // Set by the synchronous `beforetoggle` of a close, cleared by the `close` event a task later:
  // the dialog is closed but its notification is not dispatched yet, so the apply effect must
  // not re-open it from a commit that lands in between.
  const awaitingClose = useRef(false);
  const warnedFocus = useRef(false);

  useDevWarning(
    !isLibrary && transition !== undefined,
    "Dialog.Popup: `transition` has no effect in JS-free mode; the browser opens and closes the " +
      "dialog outside any React transition. Animate it with CSS (`@starting-style`).",
  );
  useDevWarning(
    !isLibrary && keepMounted === false,
    "Dialog.Popup: `keepMounted={false}` cannot be honoured in JS-free mode; the content is " +
      "always mounted so that the server HTML is complete.",
  );

  const libraryRef = useCallback(
    (element: HTMLDialogElement) => {
      if (isDev && element.tagName !== "DIALOG") {
        console.error(
          `Dialog.Popup: expected to render a <dialog> element but got <${element.tagName.toLowerCase()}>. ` +
            "Top layer, backdrop, focus and Escape all come from a real <dialog>.",
        );
      }
      dialogRef.current = element;
      setDialog(element);
      return () => {
        if (dialogRef.current === element) dialogRef.current = null;
        setDialog(null);
      };
    },
    [dialogRef],
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
    const element = dialogRef.current;
    if (element === null || !element.open) return;
    ctx.requestOpen(undefined, "platform");
  });
  useLayoutEffect(() => {
    if (isLibrary) reconcileOnMount();
  }, [isLibrary]);

  // The apply effect (design 2.5): after every commit, once nothing is in flight, the DOM
  // follows committed state. Opens on the user's dispatch, `defaultOpen`, a controlled parent,
  // the re-open of a refused or failed close; closes after a controlled close or a refused
  // pre-hydration open.
  useLayoutEffect(() => {
    if (!isLibrary) return;
    const element = dialogRef.current;
    if (element === null || !element.isConnected) return;
    if (ctx.pending || ctx.latestInFlight() !== null) return;
    if (ctx.committed && !element.open) {
      if (awaitingClose.current) return;
      openDialog(element);
    } else if (!ctx.committed && element.open) {
      // An echo: the `close` listener finds nothing intended and skips the dispatch. `close()`,
      // not `requestClose()`: a parent's close is not vetoable.
      ctx.recordCloseIntent(undefined);
      element.close();
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
    if (event.target !== dialogRef.current || event.defaultPrevented) return;
    const command = String((event as Event & { command?: string }).command ?? "").toLowerCase();
    if (command === "show-modal") {
      // A foreign invoker (design 2.2): opening goes through the library in library mode.
      if (!isLibrary) return;
      event.preventDefault();
      ctx.requestOpen(event, "activate");
    } else if (command === "request-close" || command === "close") {
      ctx.recordCloseIntent({ reason: "activate", event });
    }
  });

  const onSubmit = useEffectEvent((event: Event) => {
    const element = dialogRef.current;
    const form = event.target;
    if (element === null || !(form instanceof HTMLFormElement)) return;
    if (form.closest("dialog") !== element) return;
    const submitter = (event as SubmitEvent).submitter;
    const formMethod = submitter?.getAttribute("formmethod");
    const method = formMethod != null ? formMethod.toLowerCase() : form.method;
    if (method !== "dialog") return;
    ctx.recordCloseIntent({ reason: "activate", event });
  });

  const onClose = useEffectEvent((event: Event) => {
    const element = dialogRef.current;
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
    if (!isLibrary) return;

    // Keep the children while the exit animation runs (design 4.4). Firefox has none.
    if (element.isConnected && typeof element.getAnimations === "function") {
      void getComputedStyle(element).opacity; // flush style so the exit transitions exist
      const animations = element.getAnimations({ subtree: true }).filter(ends);
      if (animations.length > 0) {
        const generation = ++exitGeneration.current;
        setExiting(true);
        void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
          if (exitGeneration.current === generation) startTransition(() => setExiting(false));
        });
      }
    }

    ctx.notifyClosed(intent?.event ?? event, intent?.reason ?? "dismiss", element.returnValue);
  });

  const onBeforeToggle = useEffectEvent((event: Event) => {
    if (event.target !== dialogRef.current) return;
    const newState = (event as ToggleEvent).newState;
    awaitingClose.current = newState === "closed";
  });

  useEffect(() => {
    if (dialog === null) return;
    const doc = dialog.ownerDocument;
    // Feature detection only with the flag on, inside an effect (conventions 8).
    const nativeClosedBy = experimental_closedBy && "closedBy" in dialog;

    const listeners: [EventTarget, string, EventListener, boolean][] = [
      [dialog, "command", onCommand, false],
      [dialog, "submit", onSubmit, false],
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
          keyboardEvent.preventDefault();
          dialog.requestClose();
        },
        false,
      ]);
    }

    let outsideAttached = false;
    const onOutsideClick = (event: Event) => {
      if (!dialog.open) return;
      const target = event.target;
      if (target instanceof Node) {
        if (dialog.contains(target)) return;
        // The Trigger re-opening a non-modal dialog is not a click outside.
        if (triggerRef.current?.contains(target)) return;
      }
      dialog.requestClose();
    };
    const syncOutside = () => {
      const want = dialog.open;
      if (want === outsideAttached) return;
      outsideAttached = want;
      if (want) doc.addEventListener("click", onOutsideClick, true);
      else doc.removeEventListener("click", onOutsideClick, true);
    };

    if (lightDismiss && !nativeClosedBy) {
      if (modal) {
        // A click on the ::backdrop targets the dialog itself, outside its border box.
        listeners.push([
          dialog,
          "click",
          (event) => {
            if (event.target !== dialog || !dialog.open) return;
            const { clientX, clientY } = event as MouseEvent;
            const rect = dialog.getBoundingClientRect();
            const inside =
              rect.top <= clientY &&
              clientY <= rect.bottom &&
              rect.left <= clientX &&
              clientX <= rect.right;
            if (!inside) dialog.requestClose();
          },
          false,
        ]);
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
      if (outsideAttached) doc.removeEventListener("click", onOutsideClick, true);
    };
  }, [dialog, modal, lightDismiss, experimental_closedBy, triggerRef]);

  // Development check: the dialog has an accessible name when it is (or can be) shown.
  const shown = !isLibrary || ctx.committed;
  useEffect(() => {
    if (!isDev || dialog === null || !shown) return;
    if (dialog.hasAttribute("aria-label")) return;
    const labelledBy = (dialog.getAttribute("aria-labelledby") ?? "").split(/\s+/);
    const doc = dialog.ownerDocument;
    if (labelledBy.some((id) => id !== "" && doc.getElementById(id) !== null)) return;
    console.error(
      "Dialog.Popup: the dialog has no accessible name. Render a Dialog.Title, or give the " +
        "Popup an `aria-label`.",
    );
  }, [dialog, shown]);

  const state: DialogPopupState = { open: ctx.committed, modal };
  const visible = ctx.committed || exiting;

  const content = (s: DialogPopupState): ReactNode => {
    if (!isLibrary) return resolveStateValue(children, s);
    if (keepMounted === true) {
      // The mode changes with committed state, inside the Root's transition (conventions 5.5);
      // it stays visible while an exit animation runs.
      return (
        <Activity mode={visible ? "visible" : "hidden"}>{resolveStateValue(children, s)}</Activity>
      );
    }
    return visible ? resolveStateValue(children, s) : null;
  };

  const libraryProps: ComponentPropsWithRef<"dialog"> & DataAttributes = {
    id: ids.dialog,
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

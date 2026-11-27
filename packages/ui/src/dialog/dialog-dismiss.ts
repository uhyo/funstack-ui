// Dialog's JS baseline for what the platform gives only behind `closedby`: Escape on a
// non-modal dialog and light dismiss (design/components/dialog.md 2.6). No "use client"
// directive: DOM listeners only (conventions 7.1).
import { isPopoverOpen } from "../internal/overlay/popover-open.js";

/**
 * An open popover that takes Escape before the dialog: `auto` or `hint` (they have a close
 * watcher). A `manual` popover, or `hint` where the engine maps it to `manual`, does not; one
 * that closes on Escape from JS (HoverCard, Tooltip) prevents the `keydown` instead.
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
 * Whether an Escape `keydown`, still being dispatched, is not this dialog's (design 2.6 and 9:
 * "closes the innermost one only"), read from its event path: it did not come from inside
 * `dialog`, or the target is inside a nested `<dialog>` (that dialog's Escape) or an open `auto` /
 * `hint` popover, or an open `auto` / `hint` popover inside the dialog would take the close
 * request (close watchers are per document, not per focus).
 */
function escapeIsNotTheDialogs(dialog: HTMLDialogElement, event: Event): boolean {
  const path = event.composedPath();
  const index = path.indexOf(dialog);
  if (index < 0) return true;
  for (const node of path.slice(0, index)) {
    if (node instanceof HTMLDialogElement) return true;
    if (node instanceof Element && isOpenLightPopover(node)) return true;
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

export interface DialogDismissOptions {
  /** The Root's `modal`. A modal dialog has the platform's close watcher Escape. */
  readonly modal: boolean;
  /** The Popup's `lightDismiss`. */
  readonly lightDismiss: boolean;
}

/**
 * Installs the JS dismissals of `dialog` and returns their cleanup: Escape for a non-modal
 * dialog, and with `lightDismiss` a click outside (on the backdrop for a modal dialog). Each
 * calls `dialog.requestClose()`, so the close is the browser's, a fact (conventions 3.9.2).
 * Not for a dialog where native `closedby` is in use.
 */
export function listenDialogDismiss(
  dialog: HTMLDialogElement,
  { modal, lightDismiss }: DialogDismissOptions,
): () => void {
  const doc = dialog.ownerDocument;
  const listeners: [string, EventListener][] = [];

  // Non-modal dialogs get no close watcher Escape from the platform (design 2.6). The listener
  // is on the window, so it runs after every listener of the elements and of the document: an
  // inner layer that closes on Escape from JS (a `manual` HoverCard or Tooltip, listening on the
  // document) has prevented the event by then, and a prevented `keydown` is no close request,
  // as for the platform's watcher of a modal dialog (#177).
  const onEscape = (event: Event) => {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key !== "Escape" || keyboardEvent.defaultPrevented || !dialog.open) return;
    // A popover with a close watcher or a nested dialog inside takes this Escape; leave the
    // event alone so that it can.
    if (escapeIsNotTheDialogs(dialog, keyboardEvent)) return;
    keyboardEvent.preventDefault();
    dialog.requestClose();
  };
  const escapeTarget: EventTarget | null = modal ? null : (doc.defaultView ?? doc);
  escapeTarget?.addEventListener("keydown", onEscape);

  // Light dismiss needs both the press and the click outside, like native `closedby="any"`: a
  // drag that starts inside (selecting text in an input) and ends on the backdrop or outside
  // fires `click` on the common ancestor and must not close (it would lose a half-filled form).
  let pressedOutside = false;

  const isOutside = (target: EventTarget | null): boolean => {
    // The Trigger counts as outside, as native `closedby="any"` treats it.
    return !(target instanceof Node) || !dialog.contains(target);
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

  if (lightDismiss) {
    if (modal) {
      // A press or click on the ::backdrop targets the dialog itself, outside its border box.
      listeners.push(
        [
          "pointerdown",
          (event) => {
            pressedOutside = dialog.open && onBackdrop(dialog, event);
          },
        ],
        [
          "click",
          (event) => {
            const pressed = pressedOutside;
            pressedOutside = false;
            if (!dialog.open || !pressed || !onBackdrop(dialog, event)) return;
            dialog.requestClose();
          },
        ],
      );
    } else {
      // A document listener only while open, following the native `toggle` (the React
      // `onToggle` prop never fires on a hydrated <dialog>); reads `dialog.open`, not
      // `newState` (coalescing).
      listeners.push(["toggle", syncOutside]);
      syncOutside();
    }
  }

  for (const [type, listener] of listeners) dialog.addEventListener(type, listener);
  return () => {
    for (const [type, listener] of listeners) dialog.removeEventListener(type, listener);
    escapeTarget?.removeEventListener("keydown", onEscape);
    if (outsideAttached) {
      doc.removeEventListener("pointerdown", onOutsidePointerDown, true);
      doc.removeEventListener("click", onOutsideClick, true);
    }
  };
}

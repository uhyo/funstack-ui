// Test-only `<dialog>` shim for jsdom (design/components/dialog.md, 13.1). jsdom 30 has
// `HTMLDialogElement` with an `open` that reflects the attribute, but no `show`, `showModal`,
// `close`, `requestClose`, `returnValue`, no `toggle` / `beforetoggle` / `cancel` / `close` events,
// no Invoker Commands and no `getAnimations`. Installed only where `showModal` is missing, so the
// browser project keeps the real implementation.
//
// It follows the platform where the Dialog can observe the difference:
// - `show()` / `showModal()`: throw `InvalidStateError` when disconnected or open in the other
//   mode; dispatch a cancelable `beforetoggle` synchronously; set `open`; mark the element modal
//   (`matches(":modal")`); queue `toggle`; run a minimal focusing step (`[autofocus]` descendant,
//   else the first focusable descendant, else the dialog).
// - `close(v)`: a non-cancelable `beforetoggle` synchronously, removes `open` and the modal mark,
//   sets `returnValue` when `v` is given, restores focus to the element focused at open (for a
//   non-modal dialog only when focus is inside), queues `toggle` and `close` as tasks.
// - `requestClose(v)`: a cancelable `cancel`, then `close(v)` unless it was prevented.
// - `closedBy` is deliberately NOT defined, so the Dialog's feature detection for
//   `experimental_closedBy` stays false and the JS baseline is what jsdom tests.
// - Invoker Commands: a click on `button[commandfor][command]` that nobody cancelled dispatches a
//   cancelable `command` event (with `command` and `source`) at the target and, unless that is
//   cancelled, runs `show-modal`, `close` or `request-close` with the button's `value`. A submit
//   button in a form does not invoke (the button's activation behaviour submits instead). As in
//   the platform, validity ignores the dialog's state: `show-modal` at an open dialog and `close`
//   / `request-close` at a closed one fire the `command` event, then do nothing (HTML "command
//   steps", #125); an unknown non-custom command fires no event; custom `--commands` always fire.
// - `<form method="dialog">` (or a submitter with `formmethod="dialog"`): a submit that nobody
//   cancelled closes the nearest dialog with the submitter's `value` after every document
//   listener ran (also when its propagation was stopped), and is then cancelled so jsdom does
//   not attempt a navigation.
// - `getAnimations()` returns `[]` (the deferred unmount is a browser-mode test).
// Events queued "as tasks" use `setTimeout(0)`, so fake timers flush them deterministically.
// The invoker emulation itself lives in invoker-shim.ts (shared with the popover shim).
import { dispatchCommand, installInvokerShim, registerCommandHandler } from "./invoker-shim.js";

const modalDialogs = new WeakSet<HTMLDialogElement>();
const returnValues = new WeakMap<HTMLDialogElement, string>();
const previousFocus = new WeakMap<HTMLDialogElement, Element | null>();

const FOCUSABLE =
  "button:not([disabled]), input:not([disabled]), select:not([disabled]), " +
  "textarea:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])";

function toggleEvent(type: string, oldState: string, newState: string, cancelable: boolean): Event {
  const event = new Event(type, { cancelable });
  return Object.assign(event, { oldState, newState });
}

function queue(element: HTMLDialogElement, event: Event): void {
  setTimeout(() => element.dispatchEvent(event), 0);
}

function focusingSteps(dialog: HTMLDialogElement): void {
  const target =
    dialog.querySelector<HTMLElement>("[autofocus]") ??
    dialog.querySelector<HTMLElement>(FOCUSABLE) ??
    dialog;
  target.focus();
}

function open(dialog: HTMLDialogElement, modal: boolean): void {
  if (dialog.open) {
    if (modalDialogs.has(dialog) === modal) return;
    throw new DOMException("The dialog is already open in the other mode.", "InvalidStateError");
  }
  if (!dialog.isConnected) {
    throw new DOMException("The dialog is not connected.", "InvalidStateError");
  }
  const before = toggleEvent("beforetoggle", "closed", "open", true);
  dialog.dispatchEvent(before);
  if (before.defaultPrevented || dialog.open) return;
  previousFocus.set(dialog, dialog.ownerDocument.activeElement);
  dialog.setAttribute("open", "");
  if (modal) modalDialogs.add(dialog);
  queue(dialog, toggleEvent("toggle", "closed", "open", false));
  focusingSteps(dialog);
}

function close(dialog: HTMLDialogElement, returnValue: string | undefined): void {
  if (!dialog.open) return;
  dialog.dispatchEvent(toggleEvent("beforetoggle", "open", "closed", false));
  if (!dialog.open) return;
  const wasModal = modalDialogs.has(dialog);
  dialog.removeAttribute("open");
  modalDialogs.delete(dialog);
  if (returnValue !== undefined) returnValues.set(dialog, returnValue);
  const doc = dialog.ownerDocument;
  const previous = previousFocus.get(dialog);
  previousFocus.delete(dialog);
  const focusInside = doc.activeElement !== null && dialog.contains(doc.activeElement);
  if (previous instanceof HTMLElement && previous.isConnected && (wasModal || focusInside)) {
    previous.focus();
  }
  queue(dialog, toggleEvent("toggle", "open", "closed", false));
  queue(dialog, new Event("close"));
}

function requestClose(dialog: HTMLDialogElement, returnValue: string | undefined): void {
  if (!dialog.open) return;
  const cancel = new Event("cancel", { cancelable: true });
  dialog.dispatchEvent(cancel);
  if (!cancel.defaultPrevented) close(dialog, returnValue);
}

/** Whether the shim considers `dialog` modal (jsdom only). Same as `matches(":modal")`. */
export function isModal(dialog: Element): boolean {
  return modalDialogs.has(dialog as HTMLDialogElement) && (dialog as HTMLDialogElement).open;
}

export { dispatchCommand };

/**
 * The dialog's "is valid command steps" (HTML): invalid commands fire no `command` event. The
 * dialog's state is not considered; the run step checks it.
 */
function isValidDialogCommand(command: string): boolean {
  return command === "show-modal" || command === "close" || command === "request-close";
}

if (typeof HTMLDialogElement !== "undefined" && !("showModal" in HTMLDialogElement.prototype)) {
  const proto = HTMLDialogElement.prototype;
  Object.defineProperty(proto, "returnValue", {
    configurable: true,
    get(this: HTMLDialogElement) {
      return returnValues.get(this) ?? "";
    },
    set(this: HTMLDialogElement, value: string) {
      returnValues.set(this, String(value));
    },
  });
  Object.assign(proto, {
    show(this: HTMLDialogElement) {
      open(this, false);
    },
    showModal(this: HTMLDialogElement) {
      open(this, true);
    },
    close(this: HTMLDialogElement, returnValue?: string) {
      close(this, returnValue);
    },
    requestClose(this: HTMLDialogElement, returnValue?: string) {
      requestClose(this, returnValue);
    },
  });

  if (!("getAnimations" in Element.prototype)) {
    Object.assign(Element.prototype, {
      getAnimations() {
        return [];
      },
    });
  }

  const matches = Element.prototype.matches;
  Element.prototype.matches = function (this: Element, selector: string): boolean {
    if (selector === ":modal") return isModal(this);
    return matches.call(this, selector);
  } as typeof matches;

  // Invoker Commands (shared emulation in invoker-shim.ts): the command runs as the button's
  // activation behaviour, after the click has been dispatched and only if it was not cancelled.
  registerCommandHandler({
    isValid: (target, command) =>
      target instanceof HTMLDialogElement && isValidDialogCommand(command),
    run: (target, command, button) => {
      const dialog = target as HTMLDialogElement;
      if (command === "show-modal") {
        if (!dialog.open) dialog.showModal();
      } else if (!dialog.open) {
        // `close` / `request-close` at a closed dialog: nothing.
      } else if (command === "close") dialog.close(button.value);
      else if (command === "request-close") dialog.requestClose(button.value);
    },
  });
  installInvokerShim();

  // `<form method="dialog">`: the platform closes the dialog as the submission's default action,
  // after the `submit` event was dispatched and only if nobody cancelled it, wherever its
  // propagation was stopped. Emulated by a window bubble listener (the last stop of the path, so
  // every document listener, such as the library's interception in design 8.1, runs first) and,
  // for an event whose propagation was stopped before it got there, a microtask armed by a
  // window capture listener. The bubble path cancels the event so jsdom does not attempt a
  // navigation; the stopped path cannot (jsdom then logs "not implemented").
  const dialogSubmit = (event: Event): HTMLDialogElement | null => {
    if (event.defaultPrevented) return null;
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return null;
    const submitter = (event as SubmitEvent).submitter;
    const formMethod = submitter?.getAttribute("formmethod");
    const method = formMethod != null ? formMethod.toLowerCase() : form.method;
    return method === "dialog" ? form.closest("dialog") : null;
  };
  const submitterValue = (event: Event): string =>
    ((event as SubmitEvent).submitter as HTMLButtonElement | HTMLInputElement | null)?.value ?? "";
  const handled = new WeakSet<Event>();
  window.addEventListener(
    "submit",
    (event) => {
      for (const name of ["stopPropagation", "stopImmediatePropagation"] as const) {
        const original = event[name];
        event[name] = function (this: Event) {
          original.call(this);
          queueMicrotask(() => {
            if (handled.has(event)) return;
            handled.add(event);
            const dialog = dialogSubmit(event);
            if (dialog !== null) close(dialog, submitterValue(event));
          });
        };
      }
    },
    true,
  );
  window.addEventListener("submit", (event) => {
    if (handled.has(event)) return;
    handled.add(event);
    const dialog = dialogSubmit(event);
    if (dialog === null) return;
    event.preventDefault();
    close(dialog, submitterValue(event));
  });
}

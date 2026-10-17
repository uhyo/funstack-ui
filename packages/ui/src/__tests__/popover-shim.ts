// Test-only Popover API shim for jsdom, which has no `showPopover` / `hidePopover` /
// `togglePopover`, no `ToggleEvent`, and parses `:popover-open` without ever matching it
// (design/components/tooltip.md, 13). Installed only where the API is missing, so the browser
// project keeps the real implementation.
//
// It follows the platform where a component could observe the difference:
// - `beforetoggle` is dispatched synchronously; `toggle` is queued as a task (`setTimeout(0)`,
//   so fake timers flush it deterministically) and coalesced like the HTML spec's popover toggle
//   task tracker: a second change before the task runs cancels it and queues one event carrying
//   the first `oldState` and the latest `newState`.
// - Redundant calls return silently (open on `showPopover`, closed on `hidePopover`); a call that
//   would change the state of an element without a `popover` attribute throws `NotSupportedError`,
//   and of a disconnected element `InvalidStateError`.
// - `element.matches(":popover-open")` reflects the shim's state. A removed element is closed (the
//   browser hides a popover on removal without firing events).
// - `beforetoggle` for an **open** is cancelable and `preventDefault()` keeps the popover hidden;
//   a close's `beforetoggle` is not cancelable (design/components/popover.md 13.1).
// - `showPopover({ source })` / `togglePopover({ source })` record the source, readable through
//   `popoverSource(el)` (no anchoring in jsdom).
// - Invoker Commands (invoker-shim.ts): a click on `button[commandfor]` with `show-popover`,
//   `hide-popover` or `toggle-popover` dispatches a cancelable `command` event at the popover and
//   runs the command, with the button as `source`, unless it was cancelled. `show-popover` on an
//   open popover and `hide-popover` on a closed one are invalid (no event).
// - `showPopover()` runs the popover focusing steps (HTML): a `<dialog>` runs the dialog focusing
//   steps (an `autofocus` descendant, else the first sequentially focusable descendant, else the
//   dialog itself), any other popover focuses only itself with `autofocus` or an `autofocus`
//   descendant. Chromium, Firefox and WebKit all do this for `<dialog popover>`
//   (popover.browser.test.tsx, platform probe).
// - Hiding an `auto` popover hides the `auto` popovers nested in it first (DOM descendants, or
//   opened with a `source` inside it), each with its own events: the hide half of "hide all
//   popovers until" (design/components/menu.md 14). Opening one does not close unrelated ones.
// - No focus return on hide, no light dismiss and no close watcher: tests drive dismissals with
//   `hidePopover()`, and the focus left inside a hidden popover stands in for the platform's
//   nested-popover case.
import { installInvokerShim, registerCommandHandler } from "./invoker-shim.js";

/**
 * Marks a shown popover for the shim's stylesheet only. jsdom's UA sheet hides every
 * `[popover]` (its `:popover-open` never matches) and a `<dialog>` without `open`
 * (`showPopover()` never sets it), and jsdom refuses focus under `display: none`, so a shown
 * popover is made `display: block` as in the platform's top layer.
 */
const SHOWN_ATTRIBUTE = "data-popover-shim-open";

const openPopovers = new WeakSet<HTMLElement>();
const sources = new WeakMap<HTMLElement, HTMLElement | null>();

interface PendingToggle {
  readonly oldState: "open" | "closed";
  readonly timer: ReturnType<typeof setTimeout>;
}
const pendingToggles = new WeakMap<HTMLElement, PendingToggle>();

function isOpen(element: HTMLElement): boolean {
  if (!openPopovers.has(element)) return false;
  if (element.isConnected) return true;
  openPopovers.delete(element);
  return false;
}

/** Whether the shim considers `element` open (jsdom only). Same as `matches(":popover-open")`. */
export function isPopoverOpen(element: Element): boolean {
  return isOpen(element as HTMLElement);
}

/**
 * The `source` passed to the last `showPopover({ source })` / `togglePopover({ source })` that
 * opened `element`, or the invoker button for a command (jsdom only). `null` without a source.
 */
export function popoverSource(element: Element): HTMLElement | null {
  return sources.get(element as HTMLElement) ?? null;
}

const SEQUENTIALLY_FOCUSABLE =
  "button, input, select, textarea, a[href], area[href], summary, iframe, audio[controls], " +
  "video[controls], [contenteditable], [tabindex]";

/** The first sequentially focusable descendant: enabled, not `tabindex="-1"`, rendered. */
function firstSequentiallyFocusable(root: HTMLElement): HTMLElement | null {
  for (const element of root.querySelectorAll<HTMLElement>(SEQUENTIALLY_FOCUSABLE)) {
    if (element.tabIndex < 0 || element.matches(":disabled")) continue;
    if (element.matches("input[type=hidden]")) continue;
    if (element.contentEditable === "false" && !element.hasAttribute("tabindex")) continue;
    if (typeof element.checkVisibility === "function" && !element.checkVisibility()) continue;
    return element;
  }
  return null;
}

/** HTML's popover focusing steps, run by `showPopover()` once the popover is shown. */
function popoverFocusingSteps(popover: HTMLElement): void {
  const autofocus = popover.querySelector<HTMLElement>("[autofocus]");
  if (popover.localName === "dialog") {
    const control = autofocus ?? firstSequentiallyFocusable(popover);
    if (control !== null) {
      control.focus();
      return;
    }
    // The dialog itself; jsdom only focuses elements it considers focusable, so lend it a
    // `tabindex` for the call (the platform needs none).
    const hadTabIndex = popover.hasAttribute("tabindex");
    if (!hadTabIndex) popover.setAttribute("tabindex", "-1");
    popover.focus();
    if (!hadTabIndex) popover.removeAttribute("tabindex");
    return;
  }
  const control = popover.hasAttribute("autofocus") ? popover : autofocus;
  control?.focus();
}

function toggleEvent(type: string, oldState: string, newState: string): Event {
  // Only an opening `beforetoggle` is cancelable (HTML, popover show / hide steps).
  const event = new Event(type, { cancelable: type === "beforetoggle" && newState === "open" });
  return Object.assign(event, { oldState, newState });
}

function queueToggle(element: HTMLElement, open: boolean): void {
  const pending = pendingToggles.get(element);
  const oldState = pending?.oldState ?? (open ? "closed" : "open");
  if (pending !== undefined) clearTimeout(pending.timer);
  const timer = setTimeout(() => {
    pendingToggles.delete(element);
    element.dispatchEvent(toggleEvent("toggle", oldState, open ? "open" : "closed"));
  }, 0);
  pendingToggles.set(element, { oldState, timer });
}

function isAuto(element: Element): boolean {
  const value = element.getAttribute("popover");
  return value === "" || value?.toLowerCase() === "auto";
}

/**
 * HTML "hide all popovers until": hiding an `auto` popover first hides the `auto` popovers nested
 * in it (DOM descendants, or opened with a `source` inside it), innermost first, each with its
 * own `beforetoggle` / `toggle` (design/components/menu.md 14, the submenu stack).
 */
function hideNested(element: HTMLElement): void {
  if (!isAuto(element)) return;
  for (const other of element.ownerDocument.querySelectorAll<HTMLElement>(`[${SHOWN_ATTRIBUTE}]`)) {
    if (other === element || !isOpen(other) || !isAuto(other)) continue;
    const source = sources.get(other) ?? null;
    if (element.contains(other) || (source !== null && element.contains(source))) {
      setOpen(other, false);
    }
  }
}

function setOpen(element: HTMLElement, open: boolean, source: HTMLElement | null = null): void {
  if (isOpen(element) === open) return;
  if (!element.hasAttribute("popover")) {
    throw new DOMException("Not a popover.", "NotSupportedError");
  }
  if (!element.isConnected) {
    throw new DOMException("The popover is not connected.", "InvalidStateError");
  }
  if (!open) {
    hideNested(element);
    if (!isOpen(element)) return;
  }
  const before = toggleEvent("beforetoggle", open ? "closed" : "open", open ? "open" : "closed");
  element.dispatchEvent(before);
  // A cancelled open stays hidden; a listener that already changed the state wins.
  if (before.defaultPrevented || isOpen(element) === open) return;
  if (open) {
    openPopovers.add(element);
    sources.set(element, source);
    element.setAttribute(SHOWN_ATTRIBUTE, "");
    popoverFocusingSteps(element);
  } else {
    openPopovers.delete(element);
    element.removeAttribute(SHOWN_ATTRIBUTE);
  }
  queueToggle(element, open);
}

if (typeof HTMLElement !== "undefined" && !("showPopover" in HTMLElement.prototype)) {
  Object.assign(HTMLElement.prototype, {
    showPopover(this: HTMLElement, options?: { source?: HTMLElement }) {
      setOpen(this, true, options?.source ?? null);
    },
    hidePopover(this: HTMLElement) {
      setOpen(this, false);
    },
    togglePopover(this: HTMLElement, force?: boolean | { force?: boolean; source?: HTMLElement }) {
      const forced = typeof force === "object" ? force.force : force;
      const source = typeof force === "object" ? (force.source ?? null) : null;
      const next = forced ?? !isOpen(this);
      setOpen(this, next, source);
      return isOpen(this);
    },
  });

  const style = document.createElement("style");
  // jsdom's `[popover]:not(:popover-open)` and `dialog:not([open])` `display: none` win over
  // normal author rules.
  style.textContent = `[${SHOWN_ATTRIBUTE}] { display: block !important; }`;
  document.head.append(style);

  registerCommandHandler({
    isValid: (target, command) => {
      if (!(target instanceof HTMLElement) || !target.hasAttribute("popover")) return false;
      if (command === "toggle-popover") return true;
      if (command === "show-popover") return !isOpen(target);
      if (command === "hide-popover") return isOpen(target);
      return false;
    },
    run: (target, command, button) => {
      const popover = target as HTMLElement;
      if (command === "show-popover") setOpen(popover, true, button);
      else if (command === "hide-popover") setOpen(popover, false);
      else setOpen(popover, !isOpen(popover), button);
    },
  });
  installInvokerShim();

  const matches = Element.prototype.matches;
  Element.prototype.matches = function (this: Element, selector: string): boolean {
    if (selector === ":popover-open") return isOpen(this as HTMLElement);
    return matches.call(this, selector);
  } as typeof matches;
}

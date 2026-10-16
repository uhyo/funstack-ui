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

const openPopovers = new WeakSet<HTMLElement>();

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

function toggleEvent(type: string, oldState: string, newState: string): Event {
  const event = new Event(type, { cancelable: type === "beforetoggle" });
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

function setOpen(element: HTMLElement, open: boolean): void {
  if (isOpen(element) === open) return;
  if (!element.hasAttribute("popover")) {
    throw new DOMException("Not a popover.", "NotSupportedError");
  }
  if (!element.isConnected) {
    throw new DOMException("The popover is not connected.", "InvalidStateError");
  }
  element.dispatchEvent(
    toggleEvent("beforetoggle", open ? "closed" : "open", open ? "open" : "closed"),
  );
  if (open) openPopovers.add(element);
  else openPopovers.delete(element);
  queueToggle(element, open);
}

if (typeof HTMLElement !== "undefined" && !("showPopover" in HTMLElement.prototype)) {
  Object.assign(HTMLElement.prototype, {
    showPopover(this: HTMLElement, _options?: { source?: HTMLElement }) {
      setOpen(this, true);
    },
    hidePopover(this: HTMLElement) {
      setOpen(this, false);
    },
    togglePopover(this: HTMLElement, force?: boolean | { force?: boolean }) {
      const forced = typeof force === "object" ? force.force : force;
      const next = forced ?? !isOpen(this);
      setOpen(this, next);
      return next;
    },
  });

  const matches = Element.prototype.matches;
  Element.prototype.matches = function (this: Element, selector: string): boolean {
    if (selector === ":popover-open") return isOpen(this as HTMLElement);
    return matches.call(this, selector);
  } as typeof matches;
}

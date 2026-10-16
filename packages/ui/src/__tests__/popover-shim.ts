// Test-only Popover API shim for jsdom, which has no `showPopover` / `hidePopover` /
// `togglePopover`, no `ToggleEvent` and no `:popover-open` (design/components/tooltip.md, 13).
// Installed only where the API is missing, so the browser project keeps the real implementation.
//
// It models just enough for the Tooltip's JS path, which reads open state only from `toggle`:
// a set of open elements, redundant calls ignored, `beforetoggle` and `toggle` dispatched with
// `oldState` / `newState`. Unlike browsers (which queue `toggle` as a task), `toggle` is
// dispatched synchronously so tests stay deterministic under fake timers. `:popover-open` is not
// shimmed; tests assert on calls and on `isPopoverOpen()`.

const openPopovers = new WeakSet<HTMLElement>();

/** Whether the shim considers `element` open (jsdom only). */
export function isPopoverOpen(element: Element): boolean {
  return openPopovers.has(element as HTMLElement);
}

function dispatchToggle(element: HTMLElement, type: string, open: boolean): void {
  const event = new Event(type, { cancelable: type === "beforetoggle" });
  Object.assign(event, {
    oldState: open ? "closed" : "open",
    newState: open ? "open" : "closed",
  });
  element.dispatchEvent(event);
}

function setOpen(element: HTMLElement, open: boolean): void {
  if (openPopovers.has(element) === open) return;
  if (open) openPopovers.add(element);
  else openPopovers.delete(element);
  dispatchToggle(element, "beforetoggle", open);
  dispatchToggle(element, "toggle", open);
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
      const next = forced ?? !openPopovers.has(this);
      setOpen(this, next);
      return next;
    },
  });
}

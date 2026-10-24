// Spies shared by the jsdom overlay tests (Dialog, Popover, Menu, Menu.ContextTrigger, Combobox).
// Every `vi.spyOn` here is restored after each test by vitest.setup.ts.
import { vi } from "vitest";
import type { MockInstance } from "vitest";

/** Spies on `showPopover` (calls through to the shim or the engine). */
export function spyShow(): MockInstance<HTMLElement["showPopover"]> {
  return vi.spyOn(HTMLElement.prototype, "showPopover");
}

/** Spies on `hidePopover` (calls through to the shim or the engine). */
export function spyHide(): MockInstance<HTMLElement["hidePopover"]> {
  return vi.spyOn(HTMLElement.prototype, "hidePopover");
}

/** One `showPopover()` call as `watchShow` records it. */
export interface ShowCall {
  readonly popup: HTMLElement;
  /** The element carrying `autofocus` at the call (the library writes it right before, 6.1). */
  readonly autofocus: Element | null;
  readonly source: unknown;
}

/**
 * Records, for every `showPopover()` call, the popup, the element carrying `autofocus` at that
 * moment (the keyboard path) and the `source`; the call goes through.
 */
export function watchShow(): { calls: ShowCall[]; spy: MockInstance<HTMLElement["showPopover"]> } {
  const calls: ShowCall[] = [];
  const original = HTMLElement.prototype.showPopover;
  const spy = vi.spyOn(HTMLElement.prototype, "showPopover").mockImplementation(function (
    this: HTMLElement,
    options?: ShowPopoverOptions,
  ) {
    const autofocus = this.hasAttribute("autofocus") ? this : this.querySelector("[autofocus]");
    calls.push({ popup: this, autofocus, source: options?.source });
    return original.call(this, options);
  });
  return { calls, spy };
}

/**
 * `defaultPrevented` of every click once it bubbled past React's root listener; `stop()` removes
 * the listener.
 */
export function recordClicks(): { seen: boolean[]; stop: () => void } {
  const seen: boolean[] = [];
  const listener = (event: Event) => seen.push(event.defaultPrevented);
  document.addEventListener("click", listener);
  return { seen, stop: () => document.removeEventListener("click", listener) };
}

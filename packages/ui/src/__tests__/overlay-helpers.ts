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
interface ShowCall {
  readonly popup: HTMLElement;
  /** The element carrying `autofocus` at the call (the library writes it right before, 6.1). */
  readonly autofocus: Element | null;
  readonly source: unknown;
  /** The popup's child element count at the call (whether the content committed before the show). */
  readonly children: number;
}

/**
 * Records, for every `showPopover()` call, the popup, the element carrying `autofocus` at that
 * moment (the keyboard path), the `source` and the popup's child count; the call goes through.
 */
export function watchShow(): { calls: readonly ShowCall[] } {
  const calls: ShowCall[] = [];
  const original = HTMLElement.prototype.showPopover;
  vi.spyOn(HTMLElement.prototype, "showPopover").mockImplementation(function (
    this: HTMLElement,
    options?: ShowPopoverOptions,
  ) {
    const autofocus = this.hasAttribute("autofocus") ? this : this.querySelector("[autofocus]");
    calls.push({
      popup: this,
      autofocus,
      source: options?.source,
      children: this.childElementCount,
    });
    return original.call(this, options);
  });
  return { calls };
}

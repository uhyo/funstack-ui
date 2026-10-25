// Shared browser rows for a real press on a consumer's own invoker of a shown popup (a
// `popovertarget` button, or `commandfor` with a popover command) whose focus must not leave
// (Menu, Combobox; design/components/menu.md 2.2, combobox.md 5.4, conventions 3.5). The Popup
// prevents the press's `mousedown`, so focus stays where it was, the focus-leaving close never
// runs, and the click's native toggle closes the popup as `"activate"`, its event naming the
// button. Without the guard Chromium and Firefox (and Playwright's Linux WebKit, which focuses a
// clicked button) hid it at the press as `"dismiss"`, and the click's toggle re-showed it. One
// outcome on every engine. The press runs outside React's act environment, with real timing.
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { centre, mouse } from "./browser-commands.js";
import { leaveActEnvironment, quietPeriod, sleep } from "./browser-helpers.js";

type OpenAction = (
  next: boolean,
  details: { readonly reason: string; readonly event?: Event },
) => unknown;

export interface ForeignInvokerPressConfig {
  /** The describe block's name. */
  readonly name: string;
  /**
   * Renders the overlay with `openChangeAction={openAction}` and a `<button data-testid="foreign">`
   * placed where a press on it, and a drag to its right, is clear of the popup.
   */
  readonly render: (openAction: Mock<OpenAction>) => void;
  /** The popup (its `id` is what the foreign button names). */
  readonly popup: () => HTMLElement;
  /** Shows the popup the way a user does (inside `act`). */
  readonly open: () => Promise<void>;
  /** The element focused while the popup is shown (Menu: its first item; Combobox: the input). */
  readonly focusedWhileOpen: () => Element;
  /** Where focus is after the close (Menu: the platform returns it to the Trigger). */
  readonly focusAfterClose: () => Element;
  /** What else the press must leave untouched (Combobox: the typed text, no value dispatch). */
  readonly expectUntouched?: () => void;
}

export function describeForeignInvokerPressInBrowser(config: ForeignInvokerPressConfig): void {
  const foreign = () => screen.getByTestId("foreign");
  const isOpen = () => config.popup().matches(":popover-open");

  async function setup(attributes: Record<string, string>): Promise<Mock<OpenAction>> {
    const openAction = vi.fn<OpenAction>();
    config.render(openAction);
    for (const [name, value] of Object.entries(attributes)) {
      foreign().setAttribute(name, value.replace("{popup}", config.popup().id));
    }
    await config.open();
    expect(isOpen()).toBe(true);
    expect(document.activeElement).toBe(config.focusedWhileOpen());
    openAction.mockClear();
    leaveActEnvironment();
    return openAction;
  }

  describe(`${config.name} a press on a foreign invoker while shown (shared overlay suite)`, () => {
    for (const [kind, attributes, eventType] of [
      ["popovertarget", { popovertarget: "{popup}" }, "beforetoggle"],
      [
        "commandfor + toggle-popover",
        { commandfor: "{popup}", command: "toggle-popover" },
        "command",
      ],
    ] as const) {
      it(`${kind}: focus stays at the press, one (false, 'activate') naming the button, no re-open`, async () => {
        const openAction = await setup(attributes);
        const focused = config.focusedWhileOpen();
        const atPress = await mouse.pressOn(foreign(), {
          atPress: () => ({ open: isOpen(), focus: document.activeElement }),
        });
        expect(atPress).toEqual({ open: true, focus: focused });
        await expect.poll(() => isOpen()).toBe(false);
        await expect.poll(() => openAction.mock.calls.length).toBe(1);
        const [next, details] = openAction.mock.calls[0]!;
        expect(next).toBe(false);
        expect(details.reason).toBe("activate");
        expect(details.event!.type).toBe(eventType);
        if (eventType === "beforetoggle") expect(details.event).toBeInstanceOf(ToggleEvent);
        expect((details.event as Event & { source?: Element | null }).source).toBe(foreign());
        await expect.poll(() => document.activeElement).toBe(config.focusAfterClose());
        config.expectUntouched?.();
        await quietPeriod(100, "the click's toggle must not re-open the popup");
        expect(isOpen()).toBe(false);
        expect(openAction).toHaveBeenCalledTimes(1);
      });
    }

    it("a dragged-off press: the popup stays shown, focus kept, nothing dispatched", async () => {
      const openAction = await setup({ popovertarget: "{popup}" });
      const focused = config.focusedWhileOpen();
      const { x, y } = centre(foreign());
      // Off the button to its right, onto the empty page.
      const off = Math.round(foreign().getBoundingClientRect().right + 300);
      await mouse.down(x, y);
      await sleep(20);
      await mouse.move(off, y);
      await mouse.up(off, y);
      await quietPeriod(100, "a dragged-off press must neither close nor dispatch");
      expect(isOpen()).toBe(true);
      expect(document.activeElement).toBe(focused);
      config.expectUntouched?.();
      expect(openAction).not.toHaveBeenCalled();
    });
  });
}

// Tooltip rows jsdom cannot observe (design section 13, conventions 10.1): the real Popover API
// and `:popover-open`, the implicit anchor from `showPopover({ source })` placing the popup with
// CSS Anchor Positioning, Escape against the close watchers of an enclosing modal `<dialog>` or
// `popover="auto"` menu, `hint` stacking over an `auto` menu, the asynchronous `toggle` event, and
// Chromium's native `interestfor` path. Real pointer and keyboard
// input comes from Playwright through `userEvent` from `vitest/browser`.
import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { Tooltip } from "./index.js";
import type { TooltipPopupProps, TooltipTriggerProps } from "./index.js";

const supportsInterestFor =
  typeof HTMLButtonElement !== "undefined" && "interestForElement" in HTMLButtonElement.prototype;

function Harness({
  trigger,
  popup,
  delay,
  closeDelay,
  disabled,
}: {
  trigger?: TooltipTriggerProps;
  popup?: TooltipPopupProps;
  delay?: number;
  closeDelay?: number;
  disabled?: boolean;
}) {
  return (
    <div style={{ padding: 120, display: "flex", gap: 40 }}>
      <button type="button">Elsewhere</button>
      <Tooltip.Root delay={delay} closeDelay={closeDelay} disabled={disabled}>
        <Tooltip.Trigger style={{ width: 100, height: 30 }} {...trigger}>
          Save
        </Tooltip.Trigger>
        <Tooltip.Popup
          data-testid="popup"
          {...popup}
          style={{ margin: 0, padding: 0, border: 0, width: 60, height: 20, ...popup?.style }}
        >
          Tip
        </Tooltip.Popup>
      </Tooltip.Root>
    </div>
  );
}

const trigger = () => screen.getByRole("button", { name: "Save" });
const popup = () => screen.getByTestId("popup");
const isOpen = () => popup().matches(":popover-open");
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

afterEach(async () => {
  // Park the real mouse away from any trigger so the next test starts un-hovered.
  await userEvent.unhover(document.body);
  vi.restoreAllMocks();
});

describe("JS path (baseline) in a real browser", () => {
  it("opens on hover after the delay and closes after the pointer leaves", async () => {
    render(<Harness delay={150} closeDelay={100} />);
    expect(isOpen()).toBe(false);
    expect(popup()).not.toBeVisible();

    await userEvent.hover(trigger());
    await sleep(50);
    expect(isOpen()).toBe(false);
    await expect.poll(isOpen, { timeout: 2000 }).toBe(true);
    expect(popup()).toBeVisible();

    await userEvent.hover(screen.getByRole("button", { name: "Elsewhere" }));
    await expect.poll(isOpen, { timeout: 2000 }).toBe(false);
    expect(popup()).not.toBeVisible();
  });

  it("Escape closes the open tooltip and focus stays on the trigger", async () => {
    render(<Harness delay={0} />);
    await userEvent.hover(trigger());
    await expect.poll(isOpen).toBe(true);
    trigger().focus();
    await userEvent.keyboard("{Escape}");
    await expect.poll(isOpen).toBe(false);
    expect(trigger()).toHaveFocus();
  });

  it("keyboard focus opens it; a click on the trigger closes it", async () => {
    render(<Harness delay={0} />);
    screen.getByRole("button", { name: "Elsewhere" }).focus();
    await userEvent.tab();
    expect(trigger()).toHaveFocus();
    await expect.poll(isOpen).toBe(true);
    await userEvent.click(trigger());
    await expect.poll(isOpen).toBe(false);
  });

  it("places the popup adjacent to the trigger through the implicit anchor", async () => {
    render(<Harness delay={0} />);
    await userEvent.hover(trigger());
    await expect.poll(isOpen).toBe(true);

    const t = trigger().getBoundingClientRect();
    const p = popup().getBoundingClientRect();
    // side="top", align="center": directly above, horizontally centred on the trigger.
    expect(Math.round(p.bottom)).toBe(Math.round(t.top));
    expect(Math.round(p.left + p.width / 2)).toBe(Math.round(t.left + t.width / 2));
  });

  it.each([
    ["bottom", "start"],
    ["right", "center"],
  ] as const)("side=%s align=%s places the popup on that side", async (side, align) => {
    render(<Harness delay={0} popup={{ side, align }} />);
    await userEvent.hover(trigger());
    await expect.poll(isOpen).toBe(true);

    const t = trigger().getBoundingClientRect();
    const p = popup().getBoundingClientRect();
    if (side === "bottom") {
      expect(Math.round(p.top)).toBe(Math.round(t.bottom));
      expect(Math.round(p.left)).toBe(Math.round(t.left));
    } else {
      expect(Math.round(p.left)).toBe(Math.round(t.right));
      expect(Math.round(p.top + p.height / 2)).toBe(Math.round(t.top + t.height / 2));
    }
  });

  it("stays open while the pointer moves from the trigger into the popup", async () => {
    render(<Harness delay={0} closeDelay={100} />);
    await userEvent.hover(trigger());
    await expect.poll(isOpen).toBe(true);
    // The popup sits directly above the trigger (no gap): one move leaves one, enters the other.
    await userEvent.hover(popup());
    await sleep(400);
    expect(isOpen()).toBe(true);

    await userEvent.hover(screen.getByRole("button", { name: "Elsewhere" }));
    await expect.poll(isOpen).toBe(false);
  });

  it("a pointerdown outside closes it immediately (not after closeDelay)", async () => {
    render(<Harness delay={0} closeDelay={10_000} />);
    await userEvent.hover(trigger());
    await expect.poll(isOpen).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Elsewhere" }));
    await expect.poll(isOpen, { timeout: 1000 }).toBe(false);
  });

  it("a pointerdown or Escape in the same task as showPopover hides it (toggle is async)", async () => {
    const show = HTMLElement.prototype.showPopover;
    let dismiss: () => void = () => {};
    vi.spyOn(HTMLElement.prototype, "showPopover").mockImplementation(function (
      this: HTMLElement,
      options,
    ) {
      show.call(this, options);
      // Runs after the library's timer callback returns, before Chromium's `toggle` task.
      const popupEl = this;
      queueMicrotask(() => {
        expect(popupEl.matches(":popover-open")).toBe(true);
        dismiss();
      });
    });
    let escapeEvent: KeyboardEvent | undefined;

    const { unmount } = render(<Harness delay={0} closeDelay={10_000} />);
    dismiss = () => document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    await userEvent.hover(trigger());
    await expect.poll(() => vi.mocked(HTMLElement.prototype.showPopover).mock.calls.length).toBe(1);
    await sleep(50);
    expect(isOpen()).toBe(false);

    await userEvent.hover(screen.getByRole("button", { name: "Elsewhere" }));
    dismiss = () => {
      escapeEvent = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      });
      document.body.dispatchEvent(escapeEvent);
    };
    await userEvent.hover(trigger());
    await expect.poll(() => vi.mocked(HTMLElement.prototype.showPopover).mock.calls.length).toBe(2);
    await sleep(50);
    expect(isOpen()).toBe(false);
    expect(escapeEvent?.defaultPrevented).toBe(true);
    unmount();
  });

  it('experimental_hint renders a real popover="hint" that the JS path drives', async () => {
    render(<Harness delay={0} popup={{ experimental_hint: true }} />);
    expect(popup().popover).toBe("hint");
    await userEvent.hover(trigger());
    await expect.poll(isOpen).toBe(true);
    await userEvent.keyboard("{Escape}");
    await expect.poll(isOpen).toBe(false);
  });
});

/** A modal dialog around the harness, opened with `showModal()` after mount. */
function InDialog({ children }: { children: ReactNode }) {
  return (
    <dialog data-testid="dialog" ref={(el) => el?.showModal()}>
      {children}
    </dialog>
  );
}

/** A `popover="auto"` menu around the harness, opened with `showPopover()` after mount. */
function InMenu({ children }: { children: ReactNode }) {
  return (
    <div popover="auto" data-testid="menu" ref={(el) => el?.showPopover()}>
      {children}
    </div>
  );
}

describe.each([
  ["manual", false],
  ["hint", true],
] as const)("Escape on the JS path inside other close watchers (popover=%s)", (_, hint) => {
  it("in a modal dialog, the first Escape closes only the tooltip; the second the dialog", async () => {
    render(
      <InDialog>
        <Harness delay={0} closeDelay={10_000} popup={{ experimental_hint: hint }} />
      </InDialog>,
    );
    const dialog = screen.getByTestId("dialog") as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    await userEvent.hover(trigger());
    await expect.poll(isOpen).toBe(true);

    await userEvent.keyboard("{Escape}");
    await expect.poll(isOpen).toBe(false);
    await sleep(50);
    expect(dialog.open).toBe(true);

    await userEvent.keyboard("{Escape}");
    await expect.poll(() => dialog.open).toBe(false);
  });

  it('in a popover="auto" menu, the first Escape closes only the tooltip; the second the menu', async () => {
    render(
      <InMenu>
        <Harness delay={0} closeDelay={10_000} popup={{ experimental_hint: hint }} />
      </InMenu>,
    );
    const menu = screen.getByTestId("menu");
    const menuOpen = () => menu.matches(":popover-open");
    expect(menuOpen()).toBe(true);
    await userEvent.hover(trigger());
    await expect.poll(isOpen).toBe(true);
    // Opening the tooltip over the menu does not close the menu.
    expect(menuOpen()).toBe(true);

    await userEvent.keyboard("{Escape}");
    await expect.poll(isOpen).toBe(false);
    await sleep(50);
    expect(menuOpen()).toBe(true);

    await userEvent.keyboard("{Escape}");
    await expect.poll(menuOpen).toBe(false);
  });
});

it('a "hint" tooltip whose trigger sits outside an open "auto" menu opens without closing it', async () => {
  render(
    <>
      <div popover="auto" data-testid="menu" ref={(el) => el?.showPopover()}>
        Menu
      </div>
      <Harness delay={0} closeDelay={10_000} popup={{ experimental_hint: true }} />
    </>,
  );
  const menu = screen.getByTestId("menu");
  expect(menu.matches(":popover-open")).toBe(true);
  // The pointer reaches the trigger without a pointerdown, so the menu is not light-dismissed.
  await userEvent.hover(trigger());
  await expect.poll(isOpen).toBe(true);
  expect(menu.matches(":popover-open")).toBe(true);
  // Closing the hint leaves the menu open as well.
  await userEvent.keyboard("{Escape}");
  await expect.poll(isOpen).toBe(false);
  expect(menu.matches(":popover-open")).toBe(true);
  act(() => menu.hidePopover());
});

describe.skipIf(!supportsInterestFor)(
  "native interestfor path (Chromium with Interest Invokers)",
  () => {
    it("the browser opens the popup on hover with no library listeners", async () => {
      render(
        <Harness
          delay={100}
          closeDelay={50}
          trigger={{ experimental_interestFor: true }}
          popup={{ experimental_hint: true }}
        />,
      );
      const button = trigger() as HTMLButtonElement & { interestForElement: Element | null };
      expect(button.interestForElement).toBe(popup());
      const show = vi.spyOn(HTMLElement.prototype, "showPopover");

      await userEvent.hover(button);
      await expect.poll(isOpen, { timeout: 3000 }).toBe(true);
      expect(button.matches(":interest-source")).toBe(true);
      // The browser opened it, not the library's JS path.
      expect(show).not.toHaveBeenCalled();

      await userEvent.hover(screen.getByRole("button", { name: "Elsewhere" }));
      await expect.poll(isOpen, { timeout: 3000 }).toBe(false);
    });

    it("becoming disabled while the browser shows it hides the popup", async () => {
      const flags = {
        trigger: { experimental_interestFor: true },
        popup: { experimental_hint: true },
      };
      const { rerender } = render(<Harness delay={0} closeDelay={10_000} {...flags} />);
      await userEvent.hover(trigger());
      await expect.poll(isOpen, { timeout: 3000 }).toBe(true);
      rerender(<Harness delay={0} closeDelay={10_000} disabled {...flags} />);
      expect(trigger()).not.toHaveAttribute("interestfor");
      // Still hovered, and `interestfor` is gone: only the library's hide closes it.
      await expect.poll(isOpen).toBe(false);
    });
  },
);

// Tooltip rows jsdom cannot observe (design section 13, conventions 10.1): the real Popover API
// and `:popover-open`, the implicit anchor from `showPopover({ source })` placing the popup with
// CSS Anchor Positioning, and Chromium's native `interestfor` path. Real pointer and keyboard
// input comes from Playwright through `userEvent` from `vitest/browser`.
import { render, screen } from "@testing-library/react";
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
}: {
  trigger?: TooltipTriggerProps;
  popup?: TooltipPopupProps;
  delay?: number;
  closeDelay?: number;
}) {
  return (
    <div style={{ padding: 120, display: "flex", gap: 40 }}>
      <button type="button">Elsewhere</button>
      <Tooltip.Root delay={delay} closeDelay={closeDelay}>
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

  it('experimental_hint renders a real popover="hint" that the JS path drives', async () => {
    render(<Harness delay={0} popup={{ experimental_hint: true }} />);
    expect(popup().popover).toBe("hint");
    await userEvent.hover(trigger());
    await expect.poll(isOpen).toBe(true);
    await userEvent.keyboard("{Escape}");
    await expect.poll(isOpen).toBe(false);
  });
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
  },
);

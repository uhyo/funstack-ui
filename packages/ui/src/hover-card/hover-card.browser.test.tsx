// HoverCard rows jsdom cannot observe (design/components/hover-card.md, "Checks for the
// implementation" in its CHANGELOG entry): the real Popover API and top layer, the implicit anchor,
// real hover with the delays, `:focus-visible` from real keys, Tab into the card through the real
// focus order, Escape against an enclosing modal `<dialog>` and a popover open inside the card,
// where a press leaves focus, and the `interestfor` flag in Chromium (elsewhere the JS path runs
// under it). Real input comes from Playwright (`userEvent` from `vitest/browser`, `mouse`). The
// card's updates land in timers outside any `act` scope, so the rows leave the act environment.
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { mouse } from "../__tests__/browser-commands.js";
import { leaveActEnvironment, quietPeriod } from "../__tests__/browser-helpers.js";
import {
  pressFocusesButtons,
  supportsInterestFor,
  supportsPopoverHint,
} from "../__tests__/engine.js";
import { HoverCard } from "./index.js";
import type { HoverCardPopupProps, HoverCardRootProps, HoverCardTriggerProps } from "./index.js";

interface HarnessProps {
  root?: Omit<HoverCardRootProps, "children">;
  trigger?: Partial<HoverCardTriggerProps>;
  popup?: Partial<HoverCardPopupProps>;
  content?: ReactNode;
}

function Harness({ root, trigger, popup, content }: HarnessProps) {
  return (
    <div style={{ padding: 80, display: "flex", gap: 40, alignItems: "flex-start" }}>
      <button type="button">Before</button>
      <span>
        <HoverCard.Root {...root}>
          <HoverCard.Trigger
            href="#ada"
            onClick={(event) => event.preventDefault()}
            style={{ display: "inline-block", width: 100, height: 24 }}
            {...trigger}
          >
            @ada
          </HoverCard.Trigger>
          <HoverCard.Popup
            data-testid="popup"
            {...popup}
            style={{ margin: 0, padding: 8, border: 0, width: 160, ...popup?.style }}
          >
            {content ?? (
              <>
                <span>Ada Lovelace</span> <button type="button">Follow</button>
              </>
            )}
          </HoverCard.Popup>
        </HoverCard.Root>
      </span>
      <button type="button">After</button>
    </div>
  );
}

const trigger = () => screen.getByRole("link", { name: "@ada" });
const popup = () => screen.getByTestId("popup");
const isOpen = () => popup().matches(":popover-open");
const follow = () => screen.getByRole("button", { name: "Follow" });
const after = () => screen.getByRole("button", { name: "After" });
const before = () => screen.getByRole("button", { name: "Before" });

beforeEach(() => {
  leaveActEnvironment();
});

afterEach(async () => {
  // Park the real mouse away from any trigger so the next row starts un-hovered.
  await userEvent.unhover(document.body);
});

describe("HoverCard (browser)", () => {
  describe("JS path", () => {
    it("opens on hover after the default 600 ms, below the link in the top layer, focus untouched", async () => {
      render(<Harness />);
      before().focus();
      let enteredAt = Number.NaN;
      let openedAt = Number.NaN;
      trigger().addEventListener("pointerenter", () => (enteredAt = performance.now()));
      popup().addEventListener("beforetoggle", (event) => {
        if ((event as ToggleEvent).newState === "open") openedAt = performance.now();
      });
      await userEvent.hover(trigger());
      await expect.poll(isOpen, { timeout: 3000 }).toBe(true);
      expect(openedAt - enteredAt).toBeGreaterThanOrEqual(590);
      expect(popup()).toBeVisible();
      expect(screen.getByText("Ada Lovelace")).toBeVisible();
      expect(before()).toHaveFocus();
      // side="bottom", align="center" against the implicit anchor (`showPopover({ source })`).
      const t = trigger().getBoundingClientRect();
      const p = popup().getBoundingClientRect();
      expect(Math.round(p.top)).toBe(Math.round(t.bottom));
      expect(Math.round(p.left + p.width / 2)).toBe(Math.round(t.left + t.width / 2));
      expect(popup()).toHaveAttribute("data-side", "bottom");
    });

    it("the pointer crosses into the card and it stays; leaving both closes it after closeDelay", async () => {
      render(<Harness root={{ delay: 50, closeDelay: 150 }} />);
      await userEvent.hover(trigger());
      await expect.poll(isOpen).toBe(true);
      await userEvent.hover(follow());
      await quietPeriod(300, "the card must stay while the pointer is on it");
      expect(isOpen()).toBe(true);
      await userEvent.hover(after());
      await expect.poll(isOpen).toBe(false);
      expect(screen.queryByText("Ada Lovelace")).toBeNull();
    });

    it("a hover shorter than the delay opens nothing", async () => {
      render(<Harness root={{ delay: 400 }} />);
      await userEvent.hover(trigger());
      await userEvent.hover(after());
      await quietPeriod(600, "a short hover must not open the card");
      expect(isOpen()).toBe(false);
    });

    it("keyboard focus opens it; Tab goes into the card, Tab out closes it", async () => {
      render(<Harness root={{ delay: 50, closeDelay: 100 }} />);
      before().focus();
      await userEvent.tab();
      expect(trigger()).toHaveFocus();
      expect(trigger().matches(":focus-visible")).toBe(true);
      await expect.poll(isOpen).toBe(true);
      expect(trigger()).toHaveFocus();
      await userEvent.tab();
      expect(follow()).toHaveFocus();
      await quietPeriod(250, "focus inside keeps the card open");
      expect(isOpen()).toBe(true);
      await userEvent.tab({ shift: true });
      expect(trigger()).toHaveFocus();
      await quietPeriod(250, "Shift+Tab back to the link keeps the card open");
      expect(isOpen()).toBe(true);
      await userEvent.tab();
      await userEvent.tab();
      expect(after()).toHaveFocus();
      await expect.poll(isOpen).toBe(false);
    });

    it("a press on the link cancels the open its hover started; the click's focus opens nothing", async () => {
      render(<Harness root={{ delay: 150 }} />);
      // The press moves the pointer onto the link (pointerenter starts the open timer) and
      // presses 20 ms later, before the delay.
      await mouse.pressOn(trigger());
      await quietPeriod(400, "a pressed link must not open the card");
      expect(isOpen()).toBe(false);
    });

    it("Escape with focus inside closes it, returns focus to the link and does not re-open", async () => {
      render(<Harness root={{ delay: 50, closeDelay: 100 }} />);
      before().focus();
      await userEvent.tab();
      await expect.poll(isOpen).toBe(true);
      await userEvent.tab();
      expect(follow()).toHaveFocus();
      await userEvent.keyboard("{Escape}");
      await expect.poll(isOpen).toBe(false);
      expect(trigger()).toHaveFocus();
      await quietPeriod(300, "the focus return is not interest");
      expect(isOpen()).toBe(false);
    });

    it("in a modal dialog, the first Escape closes only the card; the second the dialog", async () => {
      render(
        <dialog data-testid="dialog" ref={(el) => el?.showModal()}>
          <Harness root={{ delay: 50 }} />
        </dialog>,
      );
      const dialog = screen.getByTestId("dialog") as HTMLDialogElement;
      await userEvent.hover(trigger());
      await expect.poll(isOpen).toBe(true);
      trigger().focus();
      await userEvent.keyboard("{Escape}");
      await expect.poll(isOpen).toBe(false);
      expect(dialog.open).toBe(true);
      await userEvent.keyboard("{Escape}");
      await expect.poll(() => dialog.open).toBe(false);
    });

    it("Escape with a popover open inside the card closes that popover first", async () => {
      render(
        <Harness
          root={{ delay: 50, closeDelay: 10_000 }}
          content={
            <>
              <button type="button" popoverTarget="inner-menu">
                More
              </button>
              <div id="inner-menu" popover="auto" data-testid="inner">
                <button type="button">Mute</button>
              </div>
            </>
          }
        />,
      );
      await userEvent.hover(trigger());
      await expect.poll(isOpen).toBe(true);
      await userEvent.click(screen.getByRole("button", { name: "More" }));
      const inner = screen.getByTestId("inner");
      await expect.poll(() => inner.matches(":popover-open")).toBe(true);
      // A press inside the card (the button) did not close it.
      expect(isOpen()).toBe(true);
      await userEvent.keyboard("{Escape}");
      await expect.poll(() => inner.matches(":popover-open")).toBe(false);
      expect(isOpen()).toBe(true);
      await userEvent.keyboard("{Escape}");
      await expect.poll(isOpen).toBe(false);
    });

    it("a press outside closes it, and focus goes where the press landed", async () => {
      const focusesOnPress = await pressFocusesButtons();
      render(<Harness root={{ delay: 50, closeDelay: 10_000 }} />);
      await userEvent.hover(trigger());
      await expect.poll(isOpen).toBe(true);
      follow().focus();
      await mouse.pressOn(after(), {
        moveFirst: true,
        atPress: () => expect(isOpen()).toBe(false),
      });
      expect(isOpen()).toBe(false);
      expect(trigger()).not.toHaveFocus();
      if (focusesOnPress) expect(after()).toHaveFocus();
    });

    it("the pointer leaving a card that holds focus closes it; focus does not go to the link", async () => {
      render(<Harness root={{ delay: 50, closeDelay: 100 }} />);
      await userEvent.hover(trigger());
      await expect.poll(isOpen).toBe(true);
      await userEvent.click(follow());
      expect(isOpen()).toBe(true);
      await userEvent.hover(after());
      await expect.poll(isOpen).toBe(false);
      expect(trigger()).not.toHaveFocus();
      expect(popup().contains(document.activeElement)).toBe(false);
    });

    it("a press on the link closes it and nothing re-opens while the pointer stays", async () => {
      render(<Harness root={{ delay: 50, closeDelay: 10_000 }} />);
      await userEvent.hover(trigger());
      await expect.poll(isOpen).toBe(true);
      await mouse.pressOn(trigger(), {
        moveFirst: true,
        atPress: () => expect(isOpen()).toBe(false),
      });
      await quietPeriod(300, "no open until fresh interest");
      expect(isOpen()).toBe(false);
      await userEvent.hover(after());
      await userEvent.hover(trigger());
      await expect.poll(isOpen).toBe(true);
    });

    it("an autofocus descendant does not take focus on hover (the show is inert)", async () => {
      render(<Harness root={{ delay: 50 }} popup={{ keepMounted: true }} />);
      popup().querySelector("button")?.setAttribute("autofocus", "");
      before().focus();
      await userEvent.hover(trigger());
      await expect.poll(isOpen).toBe(true);
      expect(before()).toHaveFocus();
      expect(popup()).not.toHaveAttribute("inert");
    });

    it("a nested card: moving into the inner card keeps the outer one open", async () => {
      render(
        <Harness
          root={{ delay: 50, closeDelay: 150 }}
          content={
            <HoverCard.Root delay={50} closeDelay={150}>
              <HoverCard.Trigger href="#babbage" onClick={(event) => event.preventDefault()}>
                @babbage
              </HoverCard.Trigger>
              <HoverCard.Popup data-testid="inner" style={{ margin: 0, padding: 8, width: 120 }}>
                Charles Babbage
              </HoverCard.Popup>
            </HoverCard.Root>
          }
        />,
      );
      await userEvent.hover(trigger());
      await expect.poll(isOpen).toBe(true);
      await userEvent.hover(screen.getByRole("link", { name: "@babbage" }));
      const inner = screen.getByTestId("inner");
      await expect.poll(() => inner.matches(":popover-open")).toBe(true);
      await userEvent.hover(screen.getByText("Charles Babbage"));
      await quietPeriod(300, "the outer card must stay while the pointer is in the inner one");
      expect(isOpen()).toBe(true);
      expect(inner.matches(":popover-open")).toBe(true);
      await userEvent.hover(after());
      await expect.poll(isOpen).toBe(false);
    });

    it("experimental_hint renders a hint popover where the engine knows it, manual otherwise", async () => {
      render(<Harness root={{ delay: 50, closeDelay: 100 }} popup={{ experimental_hint: true }} />);
      expect((popup() as HTMLElement & { popover: string | null }).popover).toBe(
        supportsPopoverHint ? "hint" : "manual",
      );
      await userEvent.hover(trigger());
      await expect.poll(isOpen).toBe(true);
      await userEvent.hover(after());
      await expect.poll(isOpen).toBe(false);
    });
  });

  describe.runIf(!supportsInterestFor)(
    "experimental_interestFor without Interest Invokers (Firefox, WebKit)",
    () => {
      it("the attribute is written and ignored; the JS path opens and closes the card", async () => {
        render(
          <Harness
            root={{ delay: 50, closeDelay: 100 }}
            trigger={{ experimental_interestFor: true }}
          />,
        );
        expect(trigger()).toHaveAttribute("interestfor", popup().id);
        expect("interestForElement" in trigger()).toBe(false);
        await userEvent.hover(trigger());
        await expect.poll(isOpen).toBe(true);
        await userEvent.hover(after());
        await expect.poll(isOpen).toBe(false);
      });
    },
  );

  describe.runIf(supportsInterestFor)("experimental_interestFor (Chromium)", () => {
    it("the platform's interest opens the card through the library and lost interest closes it", async () => {
      const onOpenChange = vi.fn();
      const openChangeAction = vi.fn();
      render(
        <Harness
          root={{ delay: 100, closeDelay: 100, onOpenChange, openChangeAction }}
          trigger={{ experimental_interestFor: true }}
        />,
      );
      const link = trigger() as HTMLAnchorElement & { interestForElement: Element | null };
      expect(link.interestForElement).toBe(popup());
      await userEvent.hover(link);
      await expect.poll(isOpen, { timeout: 3000 }).toBe(true);
      expect(openChangeAction).toHaveBeenCalledTimes(1);
      expect(openChangeAction.mock.calls[0]?.[1].event.type).toBe("beforetoggle");
      await userEvent.hover(after());
      await expect.poll(isOpen, { timeout: 3000 }).toBe(false);
      await expect.poll(() => onOpenChange.mock.calls.length).toBe(1);
      expect(onOpenChange.mock.calls[0]?.[1].event.type).toBe("loseinterest");
      expect(onOpenChange.mock.calls[0]?.[1].reason).toBe("dismiss");
    });

    it("a press on the link closes the card and the platform's renewed interest opens nothing", async () => {
      const openChangeAction = vi.fn();
      render(
        <Harness
          root={{ delay: 100, closeDelay: 100, openChangeAction }}
          trigger={{ experimental_interestFor: true }}
        />,
      );
      await userEvent.hover(trigger());
      await expect.poll(isOpen, { timeout: 3000 }).toBe(true);
      await mouse.pressOn(trigger(), {
        moveFirst: true,
        atPress: () => expect(isOpen()).toBe(false),
      });
      await quietPeriod(400, "no open until fresh interest");
      expect(isOpen()).toBe(false);
      expect(openChangeAction).toHaveBeenCalledTimes(1);
    });

    it("Escape with focus inside returns focus to the link; its interest does not re-open the card", async () => {
      const openChangeAction = vi.fn();
      render(
        <Harness
          root={{ delay: 100, closeDelay: 100, openChangeAction }}
          trigger={{ experimental_interestFor: true }}
        />,
      );
      before().focus();
      await userEvent.tab();
      await expect.poll(isOpen, { timeout: 3000 }).toBe(true);
      await userEvent.tab();
      expect(follow()).toHaveFocus();
      await userEvent.keyboard("{Escape}");
      await expect.poll(isOpen).toBe(false);
      expect(trigger()).toHaveFocus();
      await quietPeriod(400, "the focus return's interest must not re-open the card");
      expect(isOpen()).toBe(false);
      // Only the open was a request: no `loseinterest` arrived before the toggle as a cancel.
      expect(openChangeAction.mock.calls.map(([next]) => next)).toEqual([true]);
    });

    it("both flags: Tab in, the pointer crosses the card and leaves; focus is not returned to the link and the card stays closed", async () => {
      render(
        <Harness
          root={{ delay: 100, closeDelay: 100 }}
          trigger={{ experimental_interestFor: true }}
          popup={{ experimental_hint: true }}
        />,
      );
      before().focus();
      await userEvent.tab();
      await expect.poll(isOpen, { timeout: 3000 }).toBe(true);
      await userEvent.tab();
      expect(follow()).toHaveFocus();
      await userEvent.hover(follow());
      await userEvent.hover(after());
      await expect.poll(isOpen, { timeout: 3000 }).toBe(false);
      expect(trigger()).not.toHaveFocus();
      expect(popup().contains(document.activeElement)).toBe(false);
      await quietPeriod(600, "a focus restore to the link would grant interest and re-open it");
      expect(isOpen()).toBe(false);
      expect(trigger()).not.toHaveFocus();
    });

    it("disabled removes interestfor and closes a shown card", async () => {
      const flags = { trigger: { experimental_interestFor: true } };
      const { rerender } = render(<Harness root={{ delay: 50, closeDelay: 10_000 }} {...flags} />);
      await userEvent.hover(trigger());
      await expect.poll(isOpen, { timeout: 3000 }).toBe(true);
      rerender(<Harness root={{ delay: 50, closeDelay: 10_000, disabled: true }} {...flags} />);
      expect(trigger()).not.toHaveAttribute("interestfor");
      await expect.poll(isOpen).toBe(false);
    });
  });
});

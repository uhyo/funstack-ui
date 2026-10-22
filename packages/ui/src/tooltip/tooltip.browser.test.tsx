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
import {
  anchorPositionHonoursParentDirection,
  supportsInterestFor,
  supportsPopoverHint,
  topLayerAnchorReChoosesOnScroll,
} from "../__tests__/engine.js";
import {
  actPoll,
  frames,
  near,
  placedSide,
  withPageDirection,
} from "../__tests__/placement-browser.js";
import { Tooltip } from "./index.js";
import type { TooltipPopupProps, TooltipPopupState, TooltipTriggerProps } from "./index.js";

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
    // Timestamps rather than "still closed after sleep(50)": with three engines running files in
    // parallel, a 50 ms sleep can overrun the 150 ms delay (seen on Firefox).
    let enteredAt = Number.NaN;
    let openedAt = Number.NaN;
    trigger().addEventListener("pointerenter", () => (enteredAt = performance.now()));
    popup().addEventListener("beforetoggle", (event) => {
      if ((event as ToggleEvent).newState === "open") openedAt = performance.now();
    });

    await userEvent.hover(trigger());
    await expect.poll(isOpen, { timeout: 2000 }).toBe(true);
    expect(popup()).toBeVisible();
    // Timer clamping can fire a few ms early relative to `performance.now()`.
    expect(openedAt - enteredAt).toBeGreaterThanOrEqual(145);

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
    expect(popup()).toHaveAttribute("popover", "hint");
    // Without `hint` support (Safari 27.0) the invalid value reflects as "manual"; the JS path
    // still opens it and closes it on Escape (design section 2.2).
    expect(popup().popover).toBe(supportsPopoverHint ? "hint" : "manual");
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
  // Where `hint` is unsupported (Safari 27.0) the popup is a `manual` popover, which never closes
  // an `auto` one either, so the expectations are the same on every engine.
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

describe.runIf(!supportsInterestFor)(
  "experimental_interestFor without Interest Invokers (Firefox, WebKit)",
  () => {
    it("the trigger keeps the attribute and the JS path opens and closes the popup", async () => {
      render(
        <Harness
          delay={0}
          closeDelay={50}
          trigger={{ experimental_interestFor: true }}
          popup={{ experimental_hint: true }}
        />,
      );
      expect(trigger()).toHaveAttribute("interestfor", popup().id);
      expect("interestForElement" in trigger()).toBe(false);
      const show = vi.spyOn(HTMLElement.prototype, "showPopover");

      await userEvent.hover(trigger());
      await expect.poll(isOpen).toBe(true);
      // The library opened it: the engine ignored `interestfor`.
      expect(show).toHaveBeenCalledTimes(1);

      await userEvent.hover(screen.getByRole("button", { name: "Elsewhere" }));
      await expect.poll(isOpen).toBe(false);
    });
  },
);

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

// --- Wave 11: resolved side, inline sides and direction (design 7.4, 7.5, 13; conventions 13) --

/** The docs' Arrow recipe without the rotation, so the arrow's box is exactly 8 x 8. */
const ARROW_CSS = `
.t-arrow { position: absolute; width: 8px; height: 8px; background: black; }
.t-arrow[data-side="top"] { bottom: -4px; inset-inline-start: calc(50% - 4px); }
.t-arrow[data-side="bottom"] { top: -4px; inset-inline-start: calc(50% - 4px); }
.t-arrow[data-side="left"] { right: -4px; top: calc(50% - 4px); }
.t-arrow[data-side="right"] { left: -4px; top: calc(50% - 4px); }
`;

/**
 * A trigger at a fixed spot (the viewport is wider than 400 px in every engine) with its Popup
 * and an Arrow, inside an optional `dir` wrapper: the Popup's DOM parent, so with `dir="rtl"` it
 * is a direction island in the LTR test document.
 */
function Placed({
  dir,
  top = 300,
  left = 150,
  popup: popupProps,
  trigger: triggerProps,
  onPopupRender,
}: {
  dir?: "ltr" | "rtl";
  top?: number;
  left?: number;
  popup?: TooltipPopupProps;
  trigger?: TooltipTriggerProps;
  onPopupRender?: (state: TooltipPopupState) => void;
}) {
  return (
    <div dir={dir}>
      <style>{ARROW_CSS}</style>
      <Tooltip.Root delay={0} closeDelay={0}>
        <Tooltip.Trigger
          {...triggerProps}
          style={{ position: "fixed", top, left, width: 100, height: 30, margin: 0 }}
        >
          Save
        </Tooltip.Trigger>
        <Tooltip.Popup
          data-testid="popup"
          className={(s) => {
            onPopupRender?.(s);
            return `tip tip-${s.side}`;
          }}
          {...popupProps}
          style={{ margin: 0, padding: 0, border: 0, width: 60, height: 20 }}
        >
          Tip
          <Tooltip.Arrow data-testid="arrow" className="t-arrow" />
        </Tooltip.Popup>
      </Tooltip.Root>
    </div>
  );
}

const arrow = () => screen.getByTestId("arrow");
const side = () => popup().getAttribute("data-side");

/** Opens with the library's own call (no hover: the pointer must not decide the test). */
async function show(): Promise<void> {
  await act(async () => {
    popup().showPopover({ source: trigger() });
  });
  await actPoll(isOpen, true);
}

describe("resolved side (wave 11, #20)", () => {
  it("a tooltip flipped below the viewport top reports bottom on Popup, Arrow and state", async () => {
    const states: TooltipPopupState[] = [];
    render(<Placed top={0} onPopupRender={(s) => states.push(s)} />);
    expect(side()).toBe("top");
    await act(async () => {
      await userEvent.hover(trigger());
    });
    await actPoll(isOpen, true);
    await actPoll(side, "bottom");
    expect(popup()).toHaveAttribute("data-align", "center");
    expect(arrow()).toHaveAttribute("data-side", "bottom");
    expect(states.at(-1)).toMatchObject({ side: "bottom", align: "center" });
    expect(popup()).toHaveClass("tip-bottom");
    const t = trigger().getBoundingClientRect();
    const p = popup().getBoundingClientRect();
    const a = arrow().getBoundingClientRect();
    // The browser flipped it below the trigger...
    expect(near(p.top, t.bottom)).toBe(true);
    // ...and the Arrow, positioned by `[data-side="bottom"]`, straddles the popup's top edge,
    // facing the trigger.
    expect(near(a.top + a.height / 2, p.top)).toBe(true);
    // The inline style is still the request.
    expect(popup().style.getPropertyValue("position-area")).toBe("top");

    await act(async () => popup().hidePopover());
    await actPoll(side, "top");
    expect(arrow()).toHaveAttribute("data-side", "top");
  });

  it("a tooltip with room above stays on top and its open costs no render", async () => {
    let renders = 0;
    render(<Placed onPopupRender={() => renders++} />);
    const before = renders;
    await act(async () => {
      await userEvent.hover(trigger());
    });
    await actPoll(isOpen, true);
    await frames();
    expect(side()).toBe("top");
    const t = trigger().getBoundingClientRect();
    const a = arrow().getBoundingClientRect();
    const p = popup().getBoundingClientRect();
    expect(near(p.bottom, t.top)).toBe(true);
    expect(near(a.top + a.height / 2, p.bottom)).toBe(true);
    // The interaction effect writes no state and the observer wrote none.
    expect(renders).toBe(before);
  });

  it("after a scroll that leaves no room above, data-side is the side the popup is on", async () => {
    // Engines differ on whether a scroll re-chooses the option: Firefox 157 flips the popup below
    // the trigger; Chromium 156 keeps the overflowing option of a top-layer popover (a bug,
    // css-anchor-position-1 §6.5; Chromium, #92), so its popup stays above, scroll-compensated off
    // the top edge. Both apply a scroll's option only in the frame after the event (§3.3 leaves
    // the timing open). Either way the attribute must report where the popup is: that is the
    // library's assertion, read from the geometry. The engine outcome is pinned on the probe.
    const reChooses = await topLayerAnchorReChoosesOnScroll();
    render(
      <div
        data-testid="scroller"
        style={{ position: "fixed", top: 0, left: 0, width: 400, height: 300, overflow: "auto" }}
      >
        <div style={{ height: 200 }} />
        <Tooltip.Root>
          <Tooltip.Trigger style={{ width: 100, height: 30, margin: 0, display: "block" }}>
            Save
          </Tooltip.Trigger>
          <Tooltip.Popup
            data-testid="popup"
            style={{ margin: 0, padding: 0, border: 0, width: 60, height: 20 }}
          >
            Tip
          </Tooltip.Popup>
        </Tooltip.Root>
        <div style={{ height: 1000 }} />
      </div>,
    );
    const scroller = screen.getByTestId("scroller");
    const placedOn = () => placedSide(popup(), trigger());
    /** Scrolls the container and lets the engine lay out the frame after the `scroll` event. */
    const scrollTo = async (top: number) => {
      const scrolled = new Promise((resolve) =>
        scroller.addEventListener("scroll", resolve, { once: true }),
      );
      await act(async () => {
        scroller.scrollTop = top;
        await scrolled;
      });
      await frames();
    };

    await show();
    await frames();
    expect(placedOn()).toBe("top");
    expect(side()).toBe("top");
    // The trigger reaches the viewport's top edge: no room above.
    await scrollTo(200);
    expect(isOpen()).toBe(true);
    const afterScroll = placedOn();
    // Chromium (#92): kept above. Flip this branch to "bottom" (and drop the probe) once #92 is
    // fixed; the probe makes this row fail that day.
    expect(afterScroll).toBe(reChooses ? "bottom" : "top");
    await actPoll(side, afterScroll);
    // Back down: an engine keeps the last successful option while it still fits (spec); the
    // attribute follows whatever is applied.
    await scrollTo(0);
    const afterReturn = placedOn();
    expect(["top", "bottom"]).toContain(afterReturn);
    await actPoll(side, afterReturn);
    await act(async () => popup().hidePopover());
    await actPoll(side, "top");
  });

  it("the native interestfor path reports the resolved side too", async () => {
    // Chromium opens through `interestfor`, with no library interaction listeners; elsewhere the
    // JS path opens it. The observer hangs off the Popup either way (PO decision, design 7.4).
    render(
      <Placed
        top={0}
        trigger={{ experimental_interestFor: true }}
        popup={{ experimental_hint: true }}
      />,
    );
    const showSpy = vi.spyOn(HTMLElement.prototype, "showPopover");
    await act(async () => {
      await userEvent.hover(trigger());
    });
    await actPoll(isOpen, true);
    expect(showSpy).toHaveBeenCalledTimes(supportsInterestFor ? 0 : 1);
    await actPoll(side, "bottom");
    expect(arrow()).toHaveAttribute("data-side", "bottom");
    // Closed inside `act`, so the reset to the requested side is not logged as outside it.
    await act(async () => popup().hidePopover());
    await actPoll(side, "top");
  });
});

describe("inline sides and direction (wave 11, #53)", () => {
  /** inline-end: beside the trigger's inline-end edge; checks the edges that should meet. */
  async function expectInlineEnd(rtl: boolean): Promise<void> {
    await show();
    await actPoll(side, rtl ? "left" : "right");
    const t = trigger().getBoundingClientRect();
    const p = popup().getBoundingClientRect();
    if (rtl) expect(near(p.right, t.left)).toBe(true);
    else expect(near(p.left, t.right)).toBe(true);
    expect(arrow()).toHaveAttribute("data-side", rtl ? "left" : "right");
  }

  it('side="inline-end" opens to the right in LTR', async () => {
    render(<Placed popup={{ side: "inline-end" }} />);
    expect(side()).toBe("inline-end");
    expect(popup().style.getPropertyValue("position-area")).toBe("self-x-end");
    await expectInlineEnd(false);
    await act(async () => popup().hidePopover());
    await actPoll(side, "inline-end");
  });

  it('side="inline-end" and align="start" mirror under <html dir="rtl">', async () => {
    await withPageDirection("rtl", async () => {
      const { unmount } = render(<Placed popup={{ side: "inline-end" }} />);
      await expectInlineEnd(true);
      unmount();

      render(<Placed popup={{ side: "bottom", align: "start" }} />);
      await show();
      await frames();
      // Inline-relative: the inline-start (right) edges meet; requested, so no write.
      expect(side()).toBe("bottom");
      expect(popup()).toHaveAttribute("data-align", "start");
      const t = trigger().getBoundingClientRect();
      const p = popup().getBoundingClientRect();
      expect(near(p.top, t.bottom)).toBe(true);
      expect(near(p.right, t.right)).toBe(true);
    });
  });

  it('the same inside a dir="rtl" container (Firefox: Mozilla 2019601, asserted)', async () => {
    const { unmount } = render(<Placed dir="rtl" popup={{ side: "inline-end" }} />);
    await show();
    // The side is read from the keywords and the popup's direction, so it is right everywhere.
    await actPoll(side, "left");
    let t = trigger().getBoundingClientRect();
    let p = popup().getBoundingClientRect();
    if (anchorPositionHonoursParentDirection) {
      expect(near(p.right, t.left)).toBe(true);
    } else {
      // Firefox (Mozilla 2019601, #89): the popup's parent box has a direction different from
      // the root's, so the inline alignment inside the cell is mirrored; no workaround ships
      // (conventions 13.3). The popup meets neither trigger edge. When this fails, the bug is
      // fixed: delete this branch.
      expect(near(p.right, t.left)).toBe(false);
      expect(near(p.left, t.right)).toBe(false);
    }
    unmount();

    render(<Placed dir="rtl" popup={{ side: "bottom", align: "start" }} />);
    await show();
    await frames();
    expect(side()).toBe("bottom");
    t = trigger().getBoundingClientRect();
    p = popup().getBoundingClientRect();
    expect(near(p.top, t.bottom)).toBe(true);
    if (anchorPositionHonoursParentDirection) {
      expect(near(p.right, t.right)).toBe(true);
    } else {
      // Mozilla 2019601, as above.
      expect(near(p.right, t.right)).toBe(false);
      expect(near(p.left, t.left)).toBe(false);
    }
  });
});
describe("skip-delay (wave 11, #21)", () => {
  // Design section 6: while a tooltip is showing, the next one opens at once and the showing one
  // is hidden. The rows assert conditions, not wall-clock bounds: a skipped open happens in the
  // same task as the other tooltip's close (the JS path hides it and shows the next; `hint`
  // stacking hides it while showing the next), whereas without the skip they are two timers,
  // `closeDelay` and `delay` after the pointer moved. A cold open waits at least `delay`.
  function Pair({ native }: { native: boolean }) {
    const tip = { margin: 0, padding: 0, border: 0, width: 60, height: 20 };
    return (
      <div style={{ padding: 120, display: "flex", gap: 0 }}>
        <button type="button" style={{ marginRight: 80 }}>
          Elsewhere
        </button>
        <Tooltip.Root delay={400}>
          <Tooltip.Trigger experimental_interestFor={native} style={{ width: 100, height: 30 }}>
            Bold
          </Tooltip.Trigger>
          <Tooltip.Popup experimental_hint={native} data-testid="tip-a" style={tip}>
            Bold text
          </Tooltip.Popup>
        </Tooltip.Root>
        <Tooltip.Root delay={400}>
          <Tooltip.Trigger experimental_interestFor={native} style={{ width: 100, height: 30 }}>
            Italic
          </Tooltip.Trigger>
          <Tooltip.Popup experimental_hint={native} data-testid="tip-b" style={tip}>
            Italic text
          </Tooltip.Popup>
        </Tooltip.Root>
      </div>
    );
  }
  const triggerA = () => screen.getByRole("button", { name: "Bold" });
  const triggerB = () => screen.getByRole("button", { name: "Italic" });
  const tipA = () => screen.getByTestId("tip-a");
  const tipB = () => screen.getByTestId("tip-b");
  const open = (element: Element) => element.matches(":popover-open");
  const delayStart = (element: Element) =>
    getComputedStyle(element).getPropertyValue("interest-delay-start");

  /** Records, for B's opens, whether A closed in the same task (or was still open). */
  function watchSkip() {
    let aClosedThisTask = false;
    const record = { enteredB: Number.NaN, openedB: Number.NaN, withA: false };
    tipA().addEventListener("beforetoggle", (event) => {
      if ((event as ToggleEvent).newState !== "closed") return;
      aClosedThisTask = true;
      setTimeout(() => (aClosedThisTask = false), 0);
    });
    triggerB().addEventListener("pointerenter", () => (record.enteredB = performance.now()));
    tipB().addEventListener("beforetoggle", (event) => {
      if ((event as ToggleEvent).newState !== "open") return;
      record.openedB = performance.now();
      record.withA = aClosedThisTask || open(tipA());
    });
    return record;
  }

  it.each([
    ["baseline markup", false],
    ["experimental_interestFor markup", true],
  ])("%s: straight from A to B opens B at once; after both closed, B waits", async (_, native) => {
    // With the flags in Chromium the browser owns the interaction (native path); elsewhere the
    // JS path runs under the same markup, and hides A itself where `hint` is `manual` (Safari
    // 27.0).
    render(<Pair native={native} />);
    const record = watchSkip();
    await userEvent.hover(triggerA());
    await expect.poll(() => open(tipA()), { timeout: 3000 }).toBe(true);
    if (native && supportsInterestFor) {
      // The shipped rule: zero while a tooltip is showing.
      expect(delayStart(triggerB())).toBe("0s");
    }
    await userEvent.hover(triggerB());
    await expect.poll(() => open(tipB()), { timeout: 3000 }).toBe(true);
    expect(record.withA).toBe(true);
    expect(open(tipA())).toBe(false);

    // Leave both; once both are closed, a hover waits the full delay again (no cooldown).
    await userEvent.hover(screen.getByRole("button", { name: "Elsewhere" }));
    await expect.poll(() => open(tipA()) || open(tipB()), { timeout: 3000 }).toBe(false);
    if (native && supportsInterestFor) expect(delayStart(triggerB())).toBe("0.4s");
    await userEvent.hover(triggerB());
    await expect.poll(() => open(tipB()), { timeout: 3000 }).toBe(true);
    // Timer clamping can fire a few ms early relative to `performance.now()`.
    expect(record.openedB - record.enteredB).toBeGreaterThanOrEqual(395);
  });

  // Without the warm stylesheet `--fsui-tooltip-warm` is unregistered and unset; the `var()`'s
  // own `0` fallback keeps the Root's `delay` instead of the browser's `normal` (review M1).
  // `interest-delay-start` exists in Chromium only; elsewhere the JS path runs from `delay`.
  const supportsInterestDelay =
    typeof CSS !== "undefined" && CSS.supports("interest-delay-start", "0s");

  it("with the warm stylesheet removed, a flagged Trigger keeps the Root's delay", async () => {
    render(<Pair native />);
    const style = document.head.querySelector('style[data-href="@funstack/ui/tooltip-warm"]');
    expect(style).not.toBeNull();
    // React never re-inserts a hoisted style removed by hand: put it back for later rows.
    const parent = style!.parentNode!;
    const next = style!.nextSibling;
    style!.remove();
    try {
      if (supportsInterestDelay) expect(delayStart(triggerB())).toBe("0.4s");
      else expect(delayStart(triggerB())).toBe("");
    } finally {
      parent.insertBefore(style!, next);
    }
  });

  it("with the warm stylesheet blocked by a CSP, a flagged Trigger keeps the Root's delay", async () => {
    const frame = document.createElement("iframe");
    frame.srcdoc =
      '<!doctype html><meta http-equiv="Content-Security-Policy" content="style-src \'none\'">' +
      "<body></body>";
    const loaded = new Promise((resolve) =>
      frame.addEventListener("load", resolve, { once: true }),
    );
    document.body.append(frame);
    try {
      await loaded;
      const doc = frame.contentDocument!;
      const container = doc.createElement("div");
      doc.body.append(container);
      render(<Pair native />, { container });
      const style = doc.head.querySelector<HTMLStyleElement>(
        'style[data-href="@funstack/ui/tooltip-warm"]',
      );
      // The precondition: the rule is in the document but the policy blocked it.
      expect(style).not.toBeNull();
      expect(style!.sheet).toBeNull();
      const italic = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "Italic",
      )!;
      const computed = frame.contentWindow!.getComputedStyle(italic);
      if (supportsInterestDelay) {
        expect(computed.getPropertyValue("interest-delay-start")).toBe("0.4s");
      } else {
        expect(computed.getPropertyValue("interest-delay-start")).toBe("");
      }
    } finally {
      frame.remove();
    }
  });
});

describe("warm opens carry data-instant (wave 12, #93)", () => {
  // Design amendment for #93 and section 8: the attribute is written from the popup's synchronous
  // `beforetoggle`, before the open's first style recalc, so `.tip[data-instant]` suppresses the
  // entry transition outright. The oracle is the event count, not `getAnimations()`: a late write
  // starts the transitions and cancels them, after which the list is empty too (probe P2). Every
  // row renders afresh, so each popup's first open begins from a settled closed state. Conditions
  // only: the counts are read once the open is observed, two frames later.
  const STYLES = `
.tip {
  opacity: 0;
  translate: 0 4px;
  transition: opacity 1s, translate 1s, display 1s allow-discrete, overlay 1s allow-discrete;
}
.tip:popover-open {
  opacity: 1;
  translate: 0 0;
  @starting-style {
    opacity: 0;
    translate: 0 4px;
  }
}
.tip[data-instant] { transition: none; }
.tip-keyframes:popover-open { animation: fsui-test-tip-in 1s; }
.tip-keyframes[data-instant] { animation: none; }
@keyframes fsui-test-tip-in { from { opacity: 0; } }
`;
  let sheet: HTMLStyleElement | null = null;
  afterEach(() => {
    sheet?.remove();
    sheet = null;
  });
  function injectStyles() {
    sheet = document.createElement("style");
    sheet.textContent = STYLES;
    document.head.append(sheet);
  }

  function AnimatedPair({ native, className }: { native: boolean; className: string }) {
    const tip = { margin: 0, padding: 0, border: 0, width: 60, height: 20 };
    return (
      <div style={{ padding: 120, display: "flex", gap: 0 }}>
        <button type="button" style={{ marginRight: 80 }}>
          Elsewhere
        </button>
        <Tooltip.Root delay={400}>
          <Tooltip.Trigger experimental_interestFor={native} style={{ width: 100, height: 30 }}>
            Bold
          </Tooltip.Trigger>
          <Tooltip.Popup
            experimental_hint={native}
            className={className}
            data-testid="tip-a"
            style={tip}
          >
            Bold text
          </Tooltip.Popup>
        </Tooltip.Root>
        <Tooltip.Root delay={400}>
          <Tooltip.Trigger experimental_interestFor={native} style={{ width: 100, height: 30 }}>
            Italic
          </Tooltip.Trigger>
          <Tooltip.Popup
            experimental_hint={native}
            className={className}
            data-testid="tip-b"
            style={tip}
          >
            Italic text
          </Tooltip.Popup>
        </Tooltip.Root>
      </div>
    );
  }
  const triggerA = () => screen.getByRole("button", { name: "Bold" });
  const triggerB = () => screen.getByRole("button", { name: "Italic" });
  const tipA = () => screen.getByTestId("tip-a");
  const tipB = () => screen.getByTestId("tip-b");
  const open = (element: Element) => element.matches(":popover-open");

  /** Counts `type` events dispatched at `element` itself; registered before any gesture. */
  function count(element: Element, type: "transitionrun" | "animationstart") {
    const counter = { value: 0 };
    element.addEventListener(type, (event) => {
      if (event.target === element) counter.value += 1;
    });
    return counter;
  }

  /** Hovers A (a cold open), then B (a warm one); returns B's counter. */
  async function coldThenWarm(type: "transitionrun" | "animationstart") {
    const a = count(tipA(), type);
    const b = count(tipB(), type);
    await userEvent.hover(triggerA());
    await expect.poll(() => open(tipA()), { timeout: 3000 }).toBe(true);
    expect(tipA()).not.toHaveAttribute("data-instant");
    // The cold entry runs (one event per transitioned property, or the keyframe animation).
    await expect.poll(() => a.value, { timeout: 3000 }).toBeGreaterThan(0);

    await userEvent.hover(triggerB());
    await expect.poll(() => open(tipB()), { timeout: 3000 }).toBe(true);
    expect(tipB()).toHaveAttribute("data-instant", "");
    expect(open(tipA())).toBe(false);
    await frames();
    return b;
  }

  // With the flags in Chromium the browser performs the warm open (`hint` stacking closes A after
  // B's `beforetoggle`) and the library's `beforetoggle` listener is the only JS; elsewhere the JS
  // path runs under the same markup. Firefox's flagged rows are the only coverage of the JS path
  // with a real `hint` popup on a warm open (the show's `hint` stacking already hid A, so the
  // guarded `hidePopover()` is skipped): the jsdom shim has no `hint` stacking, and WebKit treats
  // `hint` as `manual`.
  it.each([
    ["baseline markup", false],
    ["experimental_interestFor markup", true],
  ])("%s: a warm open runs no entry transition; a cold one does", async (_, native) => {
    injectStyles();
    render(<AnimatedPair native={native} className="tip" />);
    const b = await coldThenWarm("transitionrun");
    expect(b.value).toBe(0);
    expect(tipB().getAnimations()).toHaveLength(0);
  });

  it.each([
    ["baseline markup", false],
    ["experimental_interestFor markup", true],
  ])("%s: a warm open starts no keyframe entry animation", async (_, native) => {
    injectStyles();
    render(<AnimatedPair native={native} className="tip-keyframes" />);
    const b = await coldThenWarm("animationstart");
    expect(b.value).toBe(0);
    expect(tipB().getAnimations()).toHaveLength(0);
  });

  it.each([
    ["baseline markup", false],
    ["experimental_interestFor markup", true],
  ])("%s: the attribute is gone once the warm-opened tooltip closes", async (_, native) => {
    // Asserted on the attribute only: the exit transition is not observed (Firefox runs none,
    // and nothing may wait on it, section 8).
    injectStyles();
    render(<AnimatedPair native={native} className="tip" />);
    await coldThenWarm("transitionrun");
    await userEvent.hover(screen.getByRole("button", { name: "Elsewhere" }));
    await expect.poll(() => open(tipB()), { timeout: 3000 }).toBe(false);
    expect(tipB()).not.toHaveAttribute("data-instant");
    expect(tipA()).not.toHaveAttribute("data-instant");
  });
});

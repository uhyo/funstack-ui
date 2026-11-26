// Drawer rows that need a real engine (design/components/drawer.md 4, 5, 9): a real mouse drag
// with pointer capture on a top-layer `<dialog>` in the three engines, the threshold and the
// flick, a reversal, the inner scroller, the release that waits for the consumer's `translate`
// transition before `requestClose()` (in Firefox too, which has no CSS exit for a dialog), the
// CSS exit after it, the click that follows a drag, and a controlled parent that keeps it open.
// The CHANGELOG's points to verify that a test can reach are pinned here: `exitAnimations` lists
// the transition a custom-property write starts (the release waits for it), the CSS exit after
// the slide starts off screen (no jump), and the click after a mouse drag lands on the dialog,
// not on the button the drag started on. Touch input is a human device check
// (memo/developer/issue-168.md): Playwright has no touch drag outside Chromium.
import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import type { ReactNode } from "react";
import { describe, expect, inject, it, vi } from "vitest";
import { mouse, withReducedMotion } from "../__tests__/browser-commands.js";
import { addStyle, flushFor, settle, sleep } from "../__tests__/browser-helpers.js";
import { user } from "../__tests__/browser-user.js";
import { browserName } from "../__tests__/engine.js";
import { classifyPress, releaseOutcome, releaseVelocity } from "../internal/swipe-arithmetic.js";
import type { SwipeSample } from "../internal/swipe-arithmetic.js";
import { Drawer } from "./index.js";
import type { DrawerOpenChangeDetails, DrawerPopupProps, DrawerRootProps } from "./index.js";

/** The starter stylesheet of design 4.3, with a 150 ms slide and a 300 px bottom sheet. */
const CSS = `
.drawer {
  position: fixed; margin: 0; border: 0; padding: 16px; box-sizing: border-box;
  max-inline-size: none; max-block-size: none; overflow: hidden;
  transition: translate 150ms ease-out, display 150ms allow-discrete, overlay 150ms allow-discrete;
}
.drawer[data-side="bottom"] { inset: auto 0 0 0; inline-size: 100%; block-size: 300px; translate: 0 100%; }
.drawer[data-side="right"] { inset: 0 0 0 auto; inline-size: 240px; block-size: 100%; translate: 100% 0; }
.drawer[data-side="inline-end"] { inset-block: 0; inset-inline: auto 0; inline-size: 240px; block-size: 100%; }
.drawer:where([data-side="inline-end"]:dir(ltr)) { translate: 100% 0; }
.drawer:where([data-side="inline-end"]:dir(rtl)) { translate: -100% 0; }
.drawer:open { translate: var(--drawer-swipe-x, 0px) var(--drawer-swipe-y, 0px); }
@starting-style {
  .drawer[data-side="bottom"]:open { translate: 0 100%; }
  .drawer[data-side="right"]:open { translate: 100% 0; }
  .drawer[data-side="inline-end"]:dir(ltr):open { translate: 100% 0; }
  .drawer[data-side="inline-end"]:dir(rtl):open { translate: -100% 0; }
}
.drawer[data-swiping] { transition: none; }
.drawer-body { overflow-y: auto; block-size: 120px; overscroll-behavior: contain; }
.drawer-body p { margin: 0; block-size: 40px; user-select: none; }
@media (prefers-reduced-motion: reduce) { .drawer { transition: none; } }
`;

const popup = () => screen.getByTestId("popup") as HTMLDialogElement;
const handle = () => screen.getByTestId("handle");

function Sheet({
  root,
  popup: popupProps,
  children,
}: {
  root?: DrawerRootProps;
  popup?: Partial<DrawerPopupProps>;
  children?: ReactNode;
}) {
  return (
    <Drawer.Root {...root}>
      <Drawer.Trigger data-testid="trigger">Filters</Drawer.Trigger>
      <Drawer.Popup data-testid="popup" className="drawer" {...popupProps}>
        <div data-testid="handle" style={{ blockSize: 24, userSelect: "none" }} />
        <Drawer.Title>Filters</Drawer.Title>
        {children}
        <Drawer.Close data-testid="close">Done</Drawer.Close>
      </Drawer.Popup>
    </Drawer.Root>
  );
}

async function openSheet(): Promise<void> {
  await user.click(screen.getByTestId("trigger"));
  await settle(() => expect(popup().open).toBe(true));
  // Let the entry slide finish, so the drag starts from the resting position.
  await act(async () => {
    await Promise.allSettled(
      popup()
        .getAnimations()
        .map((a) => a.finished),
    );
  });
}

/** The pointer's current position, in client coordinates of the test frame. */
let at = { x: 0, y: 0 };

/** A real press at the centre of `element` (or `point` inside it). */
async function press(element: Element, point?: { x: number; y: number }): Promise<void> {
  const r = element.getBoundingClientRect();
  at = {
    x: Math.round(r.left + (point?.x ?? r.width / 2)),
    y: Math.round(r.top + (point?.y ?? r.height / 2)),
  };
  await act(async () => {
    await mouse.down(at.x, at.y);
  });
}

/**
 * Real moves by (dx, dy) from the press, in `count` moves of one command each (a drag at a
 * human pace).
 */
async function moveBy(dx: number, dy: number, { count = 6 } = {}): Promise<void> {
  const from = at;
  const to = { x: from.x + dx, y: from.y + dy };
  await act(async () => {
    for (let i = 1; i <= count; i++) {
      await mouse.move(from.x + (dx * i) / count, from.y + (dy * i) / count);
    }
  });
  at = to;
}

/** Releases where the pointer is, after holding still for `hold` ms (0: at once). */
async function release(hold = 150): Promise<void> {
  if (hold > 0) await sleep(hold);
  await act(async () => {
    await mouse.up(at.x, at.y);
  });
}

/** The client point at the centre of `element`, rounded. */
function pointIn(element: Element): { x: number; y: number } {
  const r = element.getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
}

/**
 * Records the pointer events the engine delivers (document, capture phase) until the next
 * `pointerup`, and says what the tracker decides for them (design 4.1) on a bottom drawer of
 * `extent` px: `"none"` when they never started a drag.
 */
function recordPointer(): { outcome: (extent: number) => "dismiss" | "return" | "none" } {
  const events: PointerEvent[] = [];
  const types = ["pointerdown", "pointermove", "pointerup"] as const;
  const record = (event: PointerEvent) => {
    events.push(event);
    if (event.type === "pointerup")
      for (const type of types) document.removeEventListener(type, record, true);
  };
  for (const type of types) document.addEventListener(type, record, true);
  return {
    outcome: (extent) => {
      const down = events.find((event) => event.type === "pointerdown");
      const up = events.find((event) => event.type === "pointerup");
      if (down === undefined || up === undefined) throw new Error("no press and release recorded");
      const samples: SwipeSample[] = [{ time: down.timeStamp, toward: 0 }];
      let started = false;
      for (const event of events) {
        if (event.type === "pointerdown") continue;
        const dx = event.clientX - down.clientX;
        const dy = event.clientY - down.clientY;
        if (!started) {
          const verdict = classifyPress(dx, dy, "down");
          if (verdict === "drop") return "none";
          if (verdict === "wait") continue;
          started = true;
        }
        samples.push({ time: event.timeStamp, toward: dy });
      }
      if (!started) return "none";
      const offset = Math.max(0, up.clientY - down.clientY);
      return releaseOutcome(offset, extent, releaseVelocity(samples));
    },
  };
}

const swipeY = () => popup().style.getPropertyValue("--drawer-swipe-y");
const translateY = () => {
  const value = getComputedStyle(popup()).translate;
  return value === "none" ? 0 : Number.parseFloat(value.split(" ")[1] ?? "0");
};

describe("Drawer (browser)", () => {
  it("a drag past a quarter follows the pointer, slides out, then closes: a fact with the pointerup", async () => {
    addStyle(CSS);
    const openChangeAction = vi.fn();
    const onOpenChange = vi.fn<(next: boolean, details: DrawerOpenChangeDetails) => void>();
    render(<Sheet root={{ defaultOpen: false, openChangeAction, onOpenChange }} />);
    await openSheet();
    openChangeAction.mockClear();

    await press(handle());
    await moveBy(0, 120);
    expect(popup()).toHaveAttribute("data-swiping", "");
    expect(swipeY()).toBe("120px");
    expect(popup().style.getPropertyValue("--drawer-swipe-progress")).toBe("0.4");
    // The consumer's `translate` follows, with no transition while swiping.
    expect(translateY()).toBe(120);

    await release();
    expect(popup()).not.toHaveAttribute("data-swiping");
    // The release waits for the slide (in Firefox too): still open, sliding to the full extent.
    expect(popup().open).toBe(true);
    expect(swipeY()).toBe("300px");
    expect(onOpenChange).not.toHaveBeenCalled();
    await settle(() => expect(popup().open).toBe(false));
    await settle(() => expect(onOpenChange).toHaveBeenCalledTimes(1));
    const [next, details] = onOpenChange.mock.calls[0]!;
    expect(next).toBe(false);
    expect(details.reason).toBe("dismiss");
    expect(details.event?.type).toBe("pointerup");
    expect(openChangeAction).not.toHaveBeenCalled();
    await settle(() => expect(swipeY()).toBe(""));
  });

  it("the CSS exit after the slide starts off screen: no jump back", async () => {
    addStyle(CSS);
    render(<Sheet root={{ defaultOpen: false }} />);
    await openSheet();
    await press(handle());
    await moveBy(0, 150);
    await release();
    await settle(() => expect(popup().open).toBe(false));
    // Chromium and WebKit run the exit (display / overlay allow-discrete) after the close;
    // wherever the closed dialog is still rendered, it is at or past its off-screen position.
    const top = popup().getBoundingClientRect().top;
    if (getComputedStyle(popup()).display !== "none") {
      expect(top).toBeGreaterThanOrEqual(innerHeight - 1);
    }
  });

  it("a short slow drag returns with the transition and stays open", async () => {
    addStyle(CSS);
    const onOpenChange = vi.fn();
    render(<Sheet root={{ defaultOpen: false, onOpenChange }} />);
    await openSheet();
    await press(handle());
    await moveBy(0, 40);
    expect(swipeY()).toBe("40px");
    await release();
    expect(popup()).not.toHaveAttribute("data-swiping");
    expect(swipeY()).toBe("");
    // The return animates: the dialog is still part way down.
    expect(translateY()).toBeGreaterThan(0);
    await settle(() => expect(translateY()).toBe(0));
    expect(popup().open).toBe(true);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  // The two rows below depend on the speed of real input, which a loaded machine slows down:
  // under a full local `pnpm test:run` the engine can take over 100 ms per input event. Each
  // attempt records the events the engine delivered and asserts that the drawer did what the
  // arithmetic (design 4.1) says for them; the row is done once an attempt was the gesture it is
  // about. In CI (`strictInputTiming`, each engine alone) one must be; locally a row whose input
  // was always too slow passes on the agreement alone (the decision itself is covered with a
  // fake clock in drawer.test.tsx and internal/swipe.test.ts).
  it("a fast flick closes, however short", async () => {
    addStyle(CSS);
    const onOpenChange = vi.fn();
    // A taller sheet: 180 px is short of its 200 px quarter.
    render(
      <Sheet root={{ defaultOpen: false, onOpenChange }} popup={{ style: { blockSize: 800 } }} />,
    );
    for (let attempt = 0; attempt < 5; attempt++) {
      if (!popup().open) await openSheet();
      const extent = innerHeight - popup().getBoundingClientRect().top;
      const from = pointIn(handle());
      const recording = recordPointer();
      // Pressed, moved in two steps and released in one command.
      await act(async () => {
        await mouse.flick(from, { x: from.x, y: from.y + 180 }, 2);
      });
      const expected = recording.outcome(extent);
      if (expected === "dismiss") {
        await settle(() => expect(popup().open).toBe(false));
        await settle(() => expect(onOpenChange).toHaveBeenCalledTimes(1));
        return;
      }
      // Too slow on this machine: the drawer returned, as the arithmetic says.
      expect(expected).toBe("return");
      await flushFor(300);
      expect(popup().open).toBe(true);
    }
    if (inject("strictInputTiming")) {
      throw new Error("no attempt was a flick (0.5 px/ms): the engine's input was too slow");
    }
  });

  it("moving back before the release returns, however far it went", async () => {
    addStyle(CSS);
    render(<Sheet root={{ defaultOpen: false }} />);
    for (let attempt = 0; attempt < 5; attempt++) {
      if (!popup().open) await openSheet();
      const recording = recordPointer();
      await press(handle());
      await moveBy(0, 220);
      await sleep(150);
      // Back to 100 px (past the quarter) in six moves, released at once in the same command.
      at = { x: at.x, y: at.y - 120 };
      await act(async () => {
        await mouse.up(at.x, at.y, "left", 6);
      });
      const expected = recording.outcome(300);
      if (expected === "return") {
        await flushFor(300);
        expect(popup().open).toBe(true);
        expect(swipeY()).toBe("");
        return;
      }
      // The move back was too slow to count on this machine: past the quarter, it closed.
      expect(expected).toBe("dismiss");
      await settle(() => expect(popup().open).toBe(false));
    }
    if (inject("strictInputTiming")) {
      throw new Error("no attempt moved back at 0.1 px/ms: the engine's input was too slow");
    }
  });

  it("a drag inside the scrolling body moves nothing; the header still drags", async () => {
    addStyle(CSS);
    render(
      <Sheet root={{ defaultOpen: false }}>
        <div className="drawer-body" data-testid="body">
          {Array.from({ length: 10 }, (_, i) => (
            <p key={i} data-testid={`row-${i}`}>
              Row {i}
            </p>
          ))}
        </div>
      </Sheet>,
    );
    await openSheet();
    await press(screen.getByTestId("row-0"));
    await moveBy(0, 80);
    expect(popup()).not.toHaveAttribute("data-swiping");
    expect(swipeY()).toBe("");
    expect(translateY()).toBe(0);
    await release();
    await flushFor(200);
    expect(popup().open).toBe(true);

    await press(handle());
    await moveBy(0, 120);
    expect(popup()).toHaveAttribute("data-swiping");
    await release();
    await settle(() => expect(popup().open).toBe(false));
  });

  it("the click after a drag lands on the dialog, not on the button it started on", async () => {
    addStyle(CSS);
    const clicked = vi.fn();
    render(
      <Sheet root={{ defaultOpen: false }}>
        <button type="button" data-testid="apply" onClick={clicked}>
          Apply
        </button>
      </Sheet>,
    );
    await openSheet();
    const button = screen.getByTestId("apply");
    await press(button);
    await moveBy(0, 40);
    expect(popup()).toHaveAttribute("data-swiping");
    await release();
    await flushFor(200);
    expect(clicked).not.toHaveBeenCalled();
    expect(popup().open).toBe(true);
    // A plain click still works.
    await user.click(button);
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it("a mouse drag moves and does not select text", async () => {
    addStyle(CSS);
    render(
      <Sheet root={{ defaultOpen: false }}>
        <p data-testid="text">Some text the pointer drags across while it moves the drawer</p>
      </Sheet>,
    );
    await openSheet();
    await press(screen.getByTestId("text"), { x: 20, y: 5 });
    await moveBy(0, 40, { count: 20 });
    expect(popup()).toHaveAttribute("data-swiping");
    expect(document.getSelection()?.toString() ?? "").toBe("");
    await release();
    expect(document.getSelection()?.toString() ?? "").toBe("");
  });

  it("a controlled parent that keeps it open: it closes, re-opens and slides back in", async () => {
    addStyle(CSS);
    const onOpenChange = vi.fn();
    function Kept() {
      const [open, setOpen] = useState(false);
      return <Sheet root={{ open, openChangeAction: setOpen, onOpenChange }} />;
    }
    render(<Kept />);
    await openSheet();
    await press(handle());
    await moveBy(0, 150);
    await release();
    await settle(() => expect(onOpenChange).toHaveBeenCalledTimes(1));
    await settle(() => expect(popup().open).toBe(true));
    await settle(() => expect(translateY()).toBe(0));
    expect(swipeY()).toBe("");
  });

  it("a right drawer swipes right; JS-free mode closes through the same gesture", async () => {
    addStyle(CSS);
    render(<Sheet popup={{ side: "right" }} />);
    await user.click(screen.getByTestId("trigger"));
    await settle(() => expect(popup().open).toBe(true));
    await act(async () => {
      await Promise.allSettled(
        popup()
          .getAnimations()
          .map((a) => a.finished),
      );
    });
    expect(popup().style.touchAction).toBe("pan-y pinch-zoom");
    await press(handle());
    await moveBy(100, 0);
    expect(popup().style.getPropertyValue("--drawer-swipe-x")).toBe("100px");
    await release();
    await settle(() => expect(popup().open).toBe(false));
  });

  it("inline-end in a right-to-left subtree sits at the left and swipes left", async () => {
    addStyle(CSS);
    render(
      <div dir="rtl">
        <Sheet root={{ defaultOpen: false }} popup={{ side: "inline-end" }} />
      </div>,
    );
    await openSheet();
    // Logical insets on the top-layer dialog follow its own (inherited) direction.
    expect(popup().getBoundingClientRect().left).toBe(0);
    await press(handle());
    await moveBy(-100, 0);
    expect(popup().style.getPropertyValue("--drawer-swipe-x")).toBe("-100px");
    await release();
    await settle(() => expect(popup().open).toBe(false));
  });

  it("reduced motion: a release past the quarter closes at once; a short one snaps back", async () => {
    addStyle(CSS);
    const onOpenChange = vi.fn();
    render(<Sheet root={{ defaultOpen: false, onOpenChange }} />);
    await withReducedMotion(async () => {
      await openSheet();
      // The drag still follows the pointer: direct manipulation.
      await press(handle());
      await moveBy(0, 40);
      expect(translateY()).toBe(40);
      await release();
      // No transition: back in the same frame.
      expect(translateY()).toBe(0);
      expect(popup().getAnimations()).toHaveLength(0);

      await press(handle());
      await moveBy(0, 120);
      await release();
      // Nothing to wait for: closed in the release's task.
      expect(popup().open).toBe(false);
      await settle(() => expect(onOpenChange).toHaveBeenCalledTimes(1));
    });
  });

  it("Escape during a drag closes once and ends the gesture", async () => {
    addStyle(CSS);
    const onOpenChange = vi.fn<(next: boolean, details: DrawerOpenChangeDetails) => void>();
    render(<Sheet root={{ defaultOpen: false, onOpenChange }} />);
    await openSheet();
    await press(handle());
    await moveBy(0, 60);
    await user.keyboard("{Escape}");
    await settle(() => expect(popup().open).toBe(false));
    expect(popup()).not.toHaveAttribute("data-swiping");
    await release();
    await flushFor(100);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0]![1].event?.type).not.toBe("pointerup");
  });

  it("names the engine", () => {
    expect(["chromium", "firefox", "webkit"]).toContain(browserName);
  });
});

// Popover rows that need a real engine (design/components/popover.md 13.3): real Invoker Commands
// and `:popover-open`, the implicit anchor placing the popup, Escape and light dismiss, the
// platform's focusing steps and focus return, nested auto popovers (and the library's focus return
// the platform leaves out), `position-try-fallbacks`, exit animations and the deferred unmount,
// ViewTransition around the top-layer element, and stacking with Tooltip, Dialog and unrelated
// popovers. Real keyboard and pointer input comes from Playwright through `user` (`userEvent`
// from `vitest/browser` inside `act`); the ViewTransition rows click in-page outside `act`, as
// `transition-boundary.browser.test.tsx` does, because `act` would flush React's queue itself.
//
// Engine branches (src/__tests__/engine.ts, memo/developer/cross-engine.md):
// - Firefox animates no CSS exit of a popover: the exit rows branch on whether `getAnimations()`
//   found anything when the popup was hidden.
// - WebKit 302008 (`position-try-fallbacks` on a nested popover hangs / spins): it did not bite
//   Menu submenus or the nested Combobox listbox on WebKit CI, so the nested rows, the flip row
//   included, use an inline placement with its `flip-inline` fallback on all three engines
//   (issue #56). A hang fails the row under the test timeout.
// - `popover="hint"` is missing in Safari 27.0 (`supportsPopoverHint`); the Tooltip row expects
//   the same either way.
import { act, render, screen } from "@testing-library/react";
import { startTransition, useState } from "react";
import type { ReactNode, ViewTransitionClass } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { user } from "../__tests__/browser-user.js";
import {
  anchorPositionHonoursParentDirection,
  browserName,
  supportsPopoverHint,
} from "../__tests__/engine.js";
import {
  actPoll,
  frames,
  near,
  placedSide,
  withPageDirection,
} from "../__tests__/placement-browser.js";
import { Dialog } from "../dialog/index.js";
import { Tooltip } from "../tooltip/index.js";
import { Popover } from "./index.js";
import type { PopoverOpenChangeDetails, PopoverPopupProps } from "./index.js";
import {
  addStyle,
  closeOpenTopLayer,
  flushFor,
  runCleanups,
  sleep,
  leaveActEnvironment,
  spyViewTransitions,
  animationsFinished,
  quietPeriod,
  settle,
} from "../__tests__/browser-helpers.js";

type ActionFn = (next: boolean, details: PopoverOpenChangeDetails) => unknown;

const trigger = () => screen.getByTestId("trigger");
const popup = () => screen.getByTestId("popup");
const isOpen = (element: Element = popup()) => element.matches(":popover-open");

afterEach(async () => {
  // Close anything left open so the next test starts with an interactive page.
  closeOpenTopLayer();
  runCleanups();
});

/** Box styles that make positions predictable (the popover and dialog UA styles reset). */
const box = (width: number, height: number) => ({
  margin: 0,
  inset: "auto",
  padding: 0,
  border: 0,
  width,
  height,
});

function Library({
  action,
  popup: popupProps,
  children,
  before,
}: {
  action?: ActionFn;
  popup?: Partial<PopoverPopupProps>;
  children?: ReactNode;
  /** Rendered before the Root (an outside button). */
  before?: ReactNode;
}) {
  return (
    <div style={{ padding: "40px 160px" }}>
      {/* Above the Trigger, so the popup (placed below it) never covers it. */}
      <button type="button" data-testid="outside" style={{ display: "block" }}>
        Outside
      </button>
      {before}
      <Popover.Root defaultOpen={false} openChangeAction={action}>
        <Popover.Trigger data-testid="trigger" style={{ width: 100, height: 30 }}>
          Filters
        </Popover.Trigger>
        <Popover.Popup data-testid="popup" style={box(200, 120)} {...popupProps}>
          <Popover.Title>Filters</Popover.Title>
          {children ?? (
            <>
              <input name="query" />
              <Popover.Close data-testid="close">Done</Popover.Close>
            </>
          )}
        </Popover.Popup>
      </Popover.Root>
    </div>
  );
}

describe("JS-free mode (browser)", () => {
  it("a real toggle-popover click opens and closes; aria-expanded follows; Close hides", async () => {
    render(
      <Popover.Root>
        <Popover.Trigger data-testid="trigger">Filters</Popover.Trigger>
        <Popover.Popup data-testid="popup" style={box(200, 100)}>
          <Popover.Title>Filters</Popover.Title>
          <Popover.Close data-testid="close">Done</Popover.Close>
        </Popover.Popup>
      </Popover.Root>,
    );
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger());
    expect(isOpen()).toBe(true);
    await expect.poll(() => trigger().getAttribute("aria-expanded")).toBe("true");
    await user.click(trigger());
    expect(isOpen()).toBe(false);
    await expect.poll(() => trigger().getAttribute("aria-expanded")).toBe("false");
    await user.click(trigger());
    expect(isOpen()).toBe(true);
    await user.click(screen.getByTestId("close"));
    expect(isOpen()).toBe(false);
    await expect.poll(() => trigger().getAttribute("aria-expanded")).toBe("false");
    // The platform returned focus to the invoker (first popover in a stack).
    expect(trigger()).toHaveFocus();
  });
});

describe("library mode (browser)", () => {
  it("the Trigger's click goes through the library; the popup is anchored below it", async () => {
    let release!: () => void;
    const action = vi.fn<ActionFn>(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    render(<Library action={action} />);
    await user.click(trigger());
    expect(action).toHaveBeenCalledTimes(1);
    const details = action.mock.calls[0]![1];
    expect(details.event).toBeInstanceOf(MouseEvent);
    expect(details.reason).toBe("activate");
    // The command was cancelled: the popup is still hidden while the action runs.
    expect(isOpen()).toBe(false);
    expect(trigger()).toHaveAttribute("data-pending", "");
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    await act(async () => release());
    expect(isOpen()).toBe(true);
    expect(trigger()).not.toHaveAttribute("data-pending");
    // `showPopover({ source: trigger })`: the implicit anchor; `position-area: bottom`.
    const t = trigger().getBoundingClientRect();
    const p = popup().getBoundingClientRect();
    expect(p.top).toBeCloseTo(t.bottom, 0);
    expect(p.left + p.width / 2).toBeCloseTo(t.left + t.width / 2, 0);
  });

  it("a foreign show-popover invoker is cancelled at beforetoggle; the ToggleEvent names it", async () => {
    const action = vi.fn<ActionFn>();
    render(
      <Library
        action={action}
        before={
          <button type="button" data-testid="foreign">
            Foreign
          </button>
        }
      />,
    );
    const foreign = screen.getByTestId("foreign");
    foreign.setAttribute("commandfor", popup().id);
    foreign.setAttribute("command", "show-popover");
    await user.click(foreign);
    expect(action).toHaveBeenCalledTimes(1);
    const event = action.mock.calls[0]![1].event!;
    expect(event).toBeInstanceOf(ToggleEvent);
    expect(event.type).toBe("beforetoggle");
    expect((event as ToggleEvent & { source?: Element | null }).source).toBe(foreign);
    await settle(() => expect(isOpen()).toBe(true));
  });

  it("Escape closes with reason 'dismiss'; focus returns to the Trigger", async () => {
    const action = vi.fn<ActionFn>();
    render(<Library action={action} />);
    await user.click(trigger());
    await settle(() => expect(isOpen()).toBe(true));
    await user.keyboard("{Escape}");
    expect(isOpen()).toBe(false);
    expect(trigger()).toHaveFocus();
    await settle(() => expect(action).toHaveBeenCalledTimes(2));
    const [next, details] = action.mock.calls[1]!;
    expect(next).toBe(false);
    expect(details.reason).toBe("dismiss");
    expect(details.event?.type).toBe("toggle");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("a click outside light-dismisses ('dismiss'); focus stays on the clicked element", async () => {
    const action = vi.fn<ActionFn>();
    render(<Library action={action} />);
    await user.click(trigger());
    await settle(() => expect(isOpen()).toBe(true));
    await user.click(screen.getByTestId("outside"));
    expect(isOpen()).toBe(false);
    await settle(() => expect(screen.getByTestId("outside")).toHaveFocus());
    expect(action.mock.calls[1]![1].reason).toBe("dismiss");
  });

  it("a Trigger click while open closes through the library and does not reopen", async () => {
    const action = vi.fn<ActionFn>();
    render(<Library action={action} />);
    await user.click(trigger());
    await flushFor();
    await user.click(trigger());
    await settle(() => expect(isOpen()).toBe(false));
    expect(action).toHaveBeenCalledTimes(2);
    expect(action.mock.calls[1]![0]).toBe(false);
    expect(action.mock.calls[1]![1].reason).toBe("activate");
    expect(action.mock.calls[1]![1].event).toBeInstanceOf(MouseEvent);
  });

  it("a Close part closes through the library ('activate')", async () => {
    const action = vi.fn<ActionFn>();
    render(<Library action={action} />);
    await user.click(trigger());
    await flushFor();
    await user.click(screen.getByTestId("close"));
    await settle(() => expect(isOpen()).toBe(false));
    expect(action.mock.calls[1]![1].reason).toBe("activate");
    expect(trigger()).toHaveFocus();
  });

  it("aria-modal='false' and role='dialog' are on the <dialog>", () => {
    render(<Library />);
    expect(popup().tagName).toBe("DIALOG");
    expect(popup()).toHaveAttribute("aria-modal", "false");
    expect(popup()).toHaveAttribute("role", "dialog");
    expect(popup()).toHaveAttribute("popover", "auto");
    expect((popup() as HTMLElement).popover).toBe("auto");
  });
});

describe("focus (browser)", () => {
  it("platform probe: what showPopover() on a <dialog> does with focus", async () => {
    // Raw platform, no library: records the engine's popover focusing steps for a <dialog>.
    render(
      <>
        <button type="button" data-testid="opener">
          Opener
        </button>
        <dialog popover="auto" data-testid="raw" aria-label="raw">
          <button type="button" data-testid="inside">
            Inside
          </button>
        </dialog>
      </>,
    );
    const opener = screen.getByTestId("opener");
    opener.focus();
    const raw = screen.getByTestId("raw");
    act(() => raw.showPopover({ source: opener }));
    const inside = raw.contains(document.activeElement);
    console.info(`[${browserName}] <dialog popover> focusing steps move focus inside: ${inside}`);
    // Chromium 156, Firefox 157 (research) and WebKit (CI): the dialog focusing steps run, so the
    // library needs no focus fallback of its own (design 6.1).
    expect(inside).toBe(true);
    expect(screen.getByTestId("inside")).toHaveFocus();
  });

  it("<dialog> default: focus moves to the first focusable descendant after a library open", async () => {
    render(<Library />);
    await user.click(trigger());
    await settle(() => expect(document.activeElement).toHaveAttribute("name", "query"));
    await user.keyboard("{Escape}");
    expect(trigger()).toHaveFocus();
  });

  it("initialFocus: the target gets focus through the deferred showPopover()", async () => {
    render(
      <Library popup={{ initialFocus: "[data-initial]" }}>
        <button type="button">First</button>
        <h3 tabIndex={-1} data-initial="">
          Heading
        </h3>
      </Library>,
    );
    await user.click(trigger());
    await settle(() => expect(document.activeElement).toHaveAttribute("data-initial"));
    expect(document.activeElement).not.toHaveAttribute("autofocus");
  });

  it("nothing focusable: the popup itself gets focus", async () => {
    render(
      <Library>
        <p>Read only</p>
      </Library>,
    );
    await user.click(trigger());
    await settle(() => expect(popup().contains(document.activeElement)).toBe(true));
  });

  it("render={<div />}: focus stays on the Trigger and Tab enters the adjacent popup", async () => {
    render(
      <Library popup={{ render: <div />, role: "region", "aria-label": "Help" }}>
        <a href="#more" data-testid="link">
          Learn more
        </a>
      </Library>,
    );
    await user.click(trigger());
    await settle(() => expect(isOpen()).toBe(true));
    expect(trigger()).toHaveFocus();
    // The Popup is rendered right after the Trigger: Tab enters it in every engine.
    await user.tab();
    expect(screen.getByTestId("link")).toHaveFocus();
    expect(isOpen()).toBe(true);
  });
});

describe("nested popovers (browser)", () => {
  function Nested({ action, innerAction }: { action?: ActionFn; innerAction?: ActionFn }) {
    return (
      <Library action={action}>
        <Popover.Root defaultOpen={false} openChangeAction={innerAction}>
          <Popover.Trigger data-testid="inner-trigger">Permissions</Popover.Trigger>
          <Popover.Popup
            data-testid="inner"
            aria-label="Permissions"
            side="right"
            align="start"
            style={box(120, 60)}
          >
            <button type="button" data-testid="inner-button">
              Can edit
            </button>
          </Popover.Popup>
        </Popover.Root>
      </Library>
    );
  }

  const inner = () => screen.getByTestId("inner");

  async function openBoth() {
    await user.click(trigger());
    await flushFor();
    await user.click(screen.getByTestId("inner-trigger"));
    await flushFor();
    await expect.poll(() => isOpen(inner())).toBe(true);
    expect(isOpen()).toBe(true);
  }

  it("Escape closes the inner only and the library focuses the inner Trigger; a second Escape closes the outer", async () => {
    const innerAction = vi.fn<ActionFn>();
    render(<Nested innerAction={innerAction} />);
    await openBoth();
    expect(inner().contains(document.activeElement)).toBe(true);
    await user.keyboard("{Escape}");
    expect(isOpen(inner())).toBe(false);
    expect(isOpen()).toBe(true);
    // The platform restores nothing for a nested popover; the library does, from `toggle`.
    await expect.poll(() => document.activeElement).toBe(screen.getByTestId("inner-trigger"));
    await settle(() => expect(innerAction.mock.calls.at(-1)).toEqual([false, expect.anything()]));
    expect(innerAction.mock.calls.at(-1)![1].reason).toBe("dismiss");
    await user.keyboard("{Escape}");
    expect(isOpen()).toBe(false);
    expect(trigger()).toHaveFocus();
  });

  it("a click outside closes both and leaves focus alone", async () => {
    const action = vi.fn<ActionFn>();
    const innerAction = vi.fn<ActionFn>();
    render(<Nested action={action} innerAction={innerAction} />);
    await openBoth();
    const innerElement = inner();
    await user.click(screen.getByTestId("outside"));
    expect(isOpen(innerElement)).toBe(false);
    expect(isOpen()).toBe(false);
    await settle(() => expect(screen.getByTestId("outside")).toHaveFocus());
    expect(action.mock.calls.at(-1)![1].reason).toBe("dismiss");
    expect(innerAction.mock.calls.at(-1)![1].reason).toBe("dismiss");
  });

  it("a click in the outer popup closes the inner only", async () => {
    render(<Nested />);
    await openBoth();
    await user.click(screen.getByRole("heading", { name: "Filters" }));
    expect(isOpen(inner())).toBe(false);
    expect(isOpen()).toBe(true);
  });

  it("the inner popup flips to the other side near the viewport edge", async () => {
    render(
      <Popover.Root defaultOpen={false}>
        <Popover.Trigger data-testid="trigger">Share</Popover.Trigger>
        <Popover.Popup
          data-testid="popup"
          aria-label="Share"
          side={null}
          style={{ ...box(160, 80), position: "fixed", inset: "100px 0 auto auto" }}
        >
          <Popover.Root defaultOpen={false}>
            <Popover.Trigger data-testid="inner-trigger" style={{ marginLeft: 100 }}>
              More
            </Popover.Trigger>
            <Popover.Popup data-testid="inner" aria-label="More" side="right" style={box(300, 40)}>
              content
            </Popover.Popup>
          </Popover.Root>
        </Popover.Popup>
      </Popover.Root>,
    );
    await user.click(trigger());
    await flushFor();
    await user.click(screen.getByTestId("inner-trigger"));
    await expect.poll(() => isOpen(inner())).toBe(true);
    const t = screen.getByTestId("inner-trigger").getBoundingClientRect();
    const p = inner().getBoundingClientRect();
    // No room on the right: `flip-inline` places it on the left of its Trigger.
    expect(p.right).toBeCloseTo(t.left, 0);
  });
});

describe("exit animation and the deferred unmount (browser)", () => {
  function fadeStyle() {
    addStyle(`
        .fade {
          opacity: 0;
          transition: opacity 300ms, display 300ms allow-discrete, overlay 300ms allow-discrete;
        }
        .fade:popover-open { opacity: 1; }
        @starting-style { .fade:popover-open { opacity: 0; } }
      `);
  }

  /**
   * A fade whose exit outlasts any test (#71): the enter is instant and the exit takes 60 s, so
   * the "content still there" check cannot race a 300 ms fade against Playwright round trips
   * under load. The row ends the exit itself with `finish()` and then expects the release.
   */
  function heldExitStyle() {
    addStyle(`
        .held-exit {
          opacity: 0;
          transition: opacity 60s, display 60s allow-discrete, overlay 60s allow-discrete;
        }
        .held-exit:popover-open { opacity: 1; transition-duration: 0s; }
      `);
  }

  /**
   * Resolves with the exit animations the engine runs when the popup is hidden, read in its
   * `toggle` (a queued task, so the row awaits it rather than assuming one flush ran it).
   */
  function watchExit(): Promise<Animation[]> {
    return new Promise((resolve) => {
      const element = popup();
      element.addEventListener("toggle", function listener(event) {
        if ((event as ToggleEvent).newState !== "closed") return;
        element.removeEventListener("toggle", listener);
        void getComputedStyle(element).opacity;
        resolve(element.getAnimations({ subtree: true }));
      });
    });
  }

  async function expectHeldThenReleased(exit: Promise<Animation[]>) {
    let animations: Animation[] = [];
    await act(async () => {
      animations = await exit;
    });
    // Chromium animates the exit: the held branch below must not pass vacuously there.
    if (browserName === "chromium") expect(animations.length).toBeGreaterThan(0);
    if (animations.length > 0) {
      // Chromium / WebKit: the popup is still fading out; the content stays.
      expect(screen.queryByTestId("content")).not.toBeNull();
      // End the exit; the unmount is an update the Popup makes when the animations finish:
      // inside `act`.
      await act(async () => {
        for (const animation of animations) animation.finish();
        await Promise.allSettled(animations.map((animation) => animation.finished));
        await sleep(20);
      });
      expect(screen.queryByTestId("content")).toBeNull();
    } else {
      // Firefox: no CSS exit for a popover; nothing to wait for.
      expect(screen.queryByTestId("content")).toBeNull();
    }
  }

  it("a part-initiated close keeps the content while the CSS exit runs; none in Firefox", async () => {
    heldExitStyle();
    render(
      <Library popup={{ className: "held-exit" }}>
        <span data-testid="content">content</span>
      </Library>,
    );
    await user.click(trigger());
    await flushFor();
    const exit = watchExit();
    await user.click(trigger());
    await settle(() => expect(isOpen()).toBe(false));
    await expectHeldThenReleased(exit);
  });

  it("a dismissal keeps the content while the CSS exit runs; none in Firefox", async () => {
    heldExitStyle();
    render(
      <Library popup={{ className: "held-exit" }}>
        <span data-testid="content">content</span>
        <button type="button">Inside</button>
      </Library>,
    );
    await user.click(trigger());
    await flushFor();
    const exit = watchExit();
    await user.keyboard("{Escape}");
    await settle(() => expect(isOpen()).toBe(false));
    await expectHeldThenReleased(exit);
  });

  // A finite animation already running inside (a progress bar) is not the exit: the release
  // waits for the CSS exit only, not for the bar (#64). A Web Animations API animation keeps
  // running on a hidden element in every engine, so without the baseline all three would hold
  // the content for the bar's 10 s.
  it.each(["part-initiated close", "dismissal"] as const)(
    "a %s ignores a finite animation that was already running inside (#64)",
    async (kind) => {
      fadeStyle();
      let bar: Animation | undefined;
      render(
        <Library popup={{ className: "fade" }}>
          <span data-testid="content">content</span>
          <div
            ref={(element) => {
              bar ??= element?.animate([{ width: "0px" }, { width: "100px" }], 10_000);
            }}
            style={{ height: 4, background: "currentColor" }}
          />
        </Library>,
      );
      await user.click(trigger());
      await flushFor();
      // The enter fade has run its course (the bar keeps running for 10 s).
      await animationsFinished(popup(), [bar]);
      expect(bar?.playState).toBe("running");
      if (kind === "dismissal") await user.keyboard("{Escape}");
      else await user.click(trigger());
      await settle(() => expect(isOpen()).toBe(false));
      await settle(
        () => expect(screen.queryByTestId("content")).toBeNull(),
        3000,
        () => flushFor(50),
      );
      expect(bar?.playState).toBe("running");
      bar?.cancel();
    },
  );
});

describe("ViewTransition (browser)", () => {
  let restoreAct: () => void;
  let calls: { openAtStart: boolean }[] = [];
  let transitions: ViewTransition[] = [];

  beforeEach(() => {
    calls = [];
    ({ transitions } = spyViewTransitions(() => {
      const element = document.querySelector("[data-testid=popup]");
      calls.push({ openAtStart: element?.matches(":popover-open") ?? false });
    }));
    restoreAct = leaveActEnvironment();
    addStyle(`
        ::view-transition-old(.pop) { animation: 200ms ease-in both vt-pop-out; }
        ::view-transition-new(.pop) { animation: 200ms ease-out both vt-pop-in; }
        @keyframes vt-pop-out { to { opacity: 0; } }
        @keyframes vt-pop-in { from { opacity: 0; } }
      `);
  });

  afterEach(async () => {
    restoreAct();
    await Promise.allSettled(transitions.map((transition) => transition.finished));
  });

  /** No wrapper element: inserted by a transition, the Popup's boundary is the subtree's top. */
  function Plain({
    transition,
    className,
    keepMounted,
  }: {
    transition?: ViewTransitionClass;
    className?: string;
    keepMounted?: boolean;
  }) {
    return (
      <Popover.Root defaultOpen={false}>
        <Popover.Trigger data-testid="trigger">Filters</Popover.Trigger>
        <Popover.Popup
          data-testid="popup"
          aria-label="Filters"
          transition={transition}
          className={className}
          keepMounted={keepMounted}
          style={box(200, 100)}
        >
          <span data-testid="content">content</span>
          <Popover.Close data-testid="close">Rename</Popover.Close>
        </Popover.Popup>
      </Popover.Root>
    );
  }

  it('transition="pop": the open and the part-initiated close each run one view transition', async () => {
    render(<Plain transition="pop" />);
    trigger().click();
    await expect.poll(() => isOpen()).toBe(true);
    await expect.poll(() => calls.length).toBe(1);
    // Started before the popup was shown; shown inside the update callback.
    expect(calls[0]!.openAtStart).toBe(false);
    await transitions[0]!.updateCallbackDone;
    expect(isOpen()).toBe(true);
    await transitions[0]!.finished;

    trigger().click();
    await expect.poll(() => calls.length).toBe(2);
    expect(calls[1]!.openAtStart).toBe(true);
    await transitions[1]!.ready;
    // The old snapshot carries the popup (with its content) out, in every engine.
    const oldImages = document
      .getAnimations()
      .filter((animation) =>
        ((animation.effect as KeyframeEffect | null)?.pseudoElement ?? "").startsWith(
          "::view-transition-old",
        ),
      );
    expect(oldImages.length).toBeGreaterThan(0);
    await transitions[1]!.finished;
    expect(isOpen()).toBe(false);
    expect(screen.queryByTestId("content")).toBeNull();
  });

  it('transition="pop": a dismissal runs one only for the notification commit, popup already hidden', async () => {
    render(<Plain transition="pop" />);
    trigger().click();
    await expect.poll(() => isOpen()).toBe(true);
    await expect.poll(() => calls.length).toBe(1);
    await transitions[0]!.finished;
    popup().hidePopover();
    await expect.poll(() => calls.length).toBe(2);
    expect(calls[1]!.openAtStart).toBe(false);
    await transitions[1]!.finished;
    await expect.poll(() => screen.queryByTestId("content")).toBeNull();
  });

  it('transition="pop" plus a CSS exit: a dismissal runs one view transition, not two', async () => {
    addStyle(`
        .fade {
          opacity: 0;
          transition: opacity 200ms, display 200ms allow-discrete, overlay 200ms allow-discrete;
        }
        .fade:popover-open { opacity: 1; }
        @starting-style { .fade:popover-open { opacity: 0; } }
      `);
    render(<Plain transition="pop" className="fade" />);
    trigger().click();
    await expect.poll(() => isOpen()).toBe(true);
    await expect.poll(() => calls.length).toBe(1);
    await transitions[0]!.finished;
    await animationsFinished(popup()); // the enter fade
    popup().hidePopover();
    // The notification commit (design 4.4); the content may be held for the CSS fade.
    await expect.poll(() => calls.length).toBe(2);
    await transitions[1]!.finished;
    await expect.poll(() => screen.queryByTestId("content")).toBeNull();
    // Releasing the hold is a normal update: no second document view transition.
    await quietPeriod(100, "the release of the hold must not start a view transition");
    expect(calls).toHaveLength(2);
  });

  // The docs' CSS exit plus `transition` (review M2 of Dialog #46): Chromium keeps a hidden
  // popover rendered through its fade, so a library-driven close's new snapshot captures it as a
  // live `::view-transition-new` next to the old image (a double image). The recipe
  // `html:active-view-transition .x { transition: none }` cuts the fade while a view transition
  // runs. Firefox hides at once: old image only either way. WebKit (CI, 2026-10): the box is
  // already `display: none` at `ready` either way, but WebKit lists the group's animation under
  // `::view-transition-new(<name>)` and none under `old`, so its row asserts `display` only.
  it.each([
    [false, "characterisation, without the recipe: a live new image in Chromium"],
    [true, "with the recipe: the old image only"],
  ])('transition="pop" plus a CSS exit, a part-initiated close (recipe=%s): %s', async (recipe) => {
    addStyle(`
        .fade {
          opacity: 0;
          transition: opacity 200ms, display 200ms allow-discrete, overlay 200ms allow-discrete;
        }
        .fade:popover-open { opacity: 1; }
        @starting-style { .fade:popover-open { opacity: 0; } }
        ${recipe ? "html:active-view-transition .fade { transition: none; }" : ""}
      `);
    render(<Plain transition="pop" className="fade" />);
    trigger().click();
    await expect.poll(() => calls.length).toBe(1);
    await transitions[0]!.finished;
    await animationsFinished(popup()); // the enter fade
    trigger().click();
    await expect.poll(() => calls.length).toBe(2);
    await transitions[1]!.ready;
    const names = new Set(
      document
        .getAnimations()
        .map((animation) => (animation.effect as KeyframeEffect | null)?.pseudoElement ?? ""),
    );
    const popupImages = (kind: "old" | "new") =>
      [...names].filter(
        (name) =>
          name.startsWith(`::view-transition-${kind}(`) &&
          name !== `::view-transition-${kind}(root)`,
      );
    const fading = getComputedStyle(popup()).display !== "none";
    const seen = JSON.stringify({ names: [...names], fading });
    const namesReliable = browserName !== "webkit";
    expect(fading, seen).toBe(!recipe && browserName === "chromium");
    if (namesReliable) {
      expect(popupImages("old").length, seen).toBeGreaterThan(0);
      expect(popupImages("new").length > 0, seen).toBe(fading);
    }
    await transitions[1]!.finished;
    expect(isOpen()).toBe(false);
  });

  // H1: with `transition` the close commit unmounts the focused Close before `hidePopover()`
  // runs, so the platform (which restores focus only from inside the popover) restores nothing.
  describe.each([
    ["pop", false],
    ["none", false],
    ["pop", true],
  ] as const)("transition=%s keepMounted=%s", (transition, keepMounted) => {
    it("a Close activated from the keyboard returns focus to the Trigger", async () => {
      render(<Plain transition={transition} keepMounted={keepMounted} />);
      trigger().click();
      await expect.poll(() => isOpen()).toBe(true);
      await Promise.allSettled(transitions.map((t) => t.finished));
      const close = screen.getByTestId("close");
      close.focus();
      expect(close).toHaveFocus();
      await userEvent.keyboard("{Enter}");
      await expect.poll(() => isOpen()).toBe(false);
      await Promise.allSettled(transitions.map((t) => t.finished));
      await expect.poll(() => document.activeElement).toBe(trigger());
    });
  });

  it("without transition: no view transition for an open or a close", async () => {
    render(<Plain />);
    trigger().click();
    await expect.poll(() => isOpen()).toBe(true);
    trigger().click();
    await expect.poll(() => isOpen()).toBe(false);
    await quietPeriod(50, "no part may start a view transition");
    expect(calls).toHaveLength(0);
  });

  it('transition="none": a plain open runs none (shielded); a Root inserted by a transition runs one', async () => {
    function Inserted() {
      const [shown, setShown] = useState(false);
      return (
        <>
          <button
            type="button"
            data-testid="insert"
            onClick={() => startTransition(() => setShown(true))}
          >
            Insert
          </button>
          {shown && <Plain transition="none" />}
        </>
      );
    }
    render(<Inserted />);
    screen.getByTestId("insert").click();
    await expect.poll(() => screen.queryByTestId("trigger")).not.toBeNull();
    await expect.poll(() => calls.length).toBe(1);
    await transitions[0]!.finished;
    trigger().click();
    await expect.poll(() => isOpen()).toBe(true);
    await quietPeriod(50, "the shielded open must not start a view transition");
    expect(calls).toHaveLength(1);
  });
});

describe("stack interactions (browser)", () => {
  it.each([false, true])(
    "a Tooltip (hint=%s) opened inside the popup does not close it",
    async (hint) => {
      render(
        <Library>
          <Tooltip.Root delay={0}>
            <Tooltip.Trigger data-testid="tip-trigger">Help</Tooltip.Trigger>
            <Tooltip.Popup data-testid="tip" experimental_hint={hint}>
              Explains
            </Tooltip.Popup>
          </Tooltip.Root>
        </Library>,
      );
      await user.click(trigger());
      await flushFor();
      const tip = screen.getByTestId("tip");
      expect(tip.popover).toBe(hint && supportsPopoverHint ? "hint" : "manual");
      await user.hover(screen.getByTestId("tip-trigger"));
      await expect.poll(() => isOpen(tip)).toBe(true);
      expect(isOpen()).toBe(true);
      await userEvent.unhover(document.body);
    },
  );

  it("a modal Dialog opened from inside keeps the popup open; Escape closes the Dialog first", async () => {
    const action = vi.fn<ActionFn>();
    render(
      <Library action={action}>
        <Dialog.Root>
          <Dialog.Trigger data-testid="dialog-trigger">Advanced…</Dialog.Trigger>
          <Dialog.Popup data-testid="dialog" aria-label="Advanced">
            <button type="button">OK</button>
          </Dialog.Popup>
        </Dialog.Root>
      </Library>,
    );
    await user.click(trigger());
    await flushFor();
    await user.click(screen.getByTestId("dialog-trigger"));
    const dialog = screen.getByTestId("dialog") as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(dialog.matches(":modal")).toBe(true);
    expect(isOpen()).toBe(true);
    await user.keyboard("{Escape}");
    expect(dialog.open).toBe(false);
    expect(isOpen()).toBe(true);
    await flushFor();
    await user.keyboard("{Escape}");
    expect(isOpen()).toBe(false);
    await settle(() => expect(action.mock.calls.at(-1)![1].reason).toBe("dismiss"));
  });

  it("an unrelated auto popover opening closes the popup with 'dismiss'", async () => {
    const action = vi.fn<ActionFn>();
    render(
      <>
        <Library action={action} />
        <div popover="auto" data-testid="other">
          Other
        </div>
      </>,
    );
    await user.click(trigger());
    await settle(() => expect(isOpen()).toBe(true));
    act(() => screen.getByTestId("other").showPopover());
    expect(isOpen()).toBe(false);
    await settle(() => expect(action).toHaveBeenCalledTimes(2));
    expect(action.mock.calls[1]![0]).toBe(false);
    expect(action.mock.calls[1]![1].reason).toBe("dismiss");
  });
});

// --- Wave 11: resolved side and direction (design 8, 13.3; conventions 13) -------------------

/**
 * The docs' gap rule (section 10), symmetric along the side's axis. A one-sided margin keyed on
 * the resolved `data-side` would end up on the far side after a flip: `flip-block` swaps the
 * popup's own block margins too, so `[data-side="top"] { margin-block-end }` is applied as
 * `margin-block-start` (measured in Chromium and Firefox; memo/developer/positioning-wave11.md).
 */
const GAP_CSS = `
.w11-pop { margin: 0; }
.w11-pop[data-side="top"], .w11-pop[data-side="bottom"] { margin-block: 6px; }
`;

/** A Trigger at a fixed spot and its Popup, inside an optional `dir` wrapper (the Popup's parent). */
function Placed({
  top = 300,
  left = 150,
  dir,
  jsFree = false,
  gap = false,
  popup: popupProps,
}: {
  top?: number;
  left?: number;
  dir?: "ltr" | "rtl";
  jsFree?: boolean;
  gap?: boolean;
  popup?: Partial<PopoverPopupProps>;
}) {
  return (
    <div dir={dir}>
      <style>{GAP_CSS}</style>
      <Popover.Root {...(jsFree ? {} : { defaultOpen: false })}>
        <Popover.Trigger
          data-testid="trigger"
          style={{ position: "fixed", top, left, width: 100, height: 30, margin: 0 }}
        >
          Filters
        </Popover.Trigger>
        <Popover.Popup
          data-testid="popup"
          className={gap ? "w11-pop" : undefined}
          {...popupProps}
          style={{
            inset: "auto",
            padding: 0,
            border: 0,
            width: 160,
            height: 120,
            ...(gap ? {} : { margin: 0 }),
          }}
        >
          <Popover.Title>Filters</Popover.Title>
        </Popover.Popup>
      </Popover.Root>
    </div>
  );
}

const side = () => popup().getAttribute("data-side");

async function openPlaced(): Promise<void> {
  await user.click(trigger());
  await actPoll(() => isOpen(), true);
}

async function closePlaced(): Promise<void> {
  await act(async () => popup().hidePopover());
  await actPoll(() => isOpen(), false);
  await flushFor();
}

describe("resolved side (wave 11, #20)", () => {
  it("near the viewport bottom the popup flips above: data-side top, the gap faces the Trigger", async () => {
    render(<Placed top={window.innerHeight - 40} gap />);
    expect(side()).toBe("bottom");
    await openPlaced();
    await actPoll(side, "top");
    const t = trigger().getBoundingClientRect();
    const p = popup().getBoundingClientRect();
    // The `[data-side="top"]` gap rule now sits between the popup's bottom edge and the Trigger.
    expect(t.top - p.bottom).toBeCloseTo(6, 0);
    // The inline style is still the request.
    expect(popup().style.getPropertyValue("position-area")).toBe("bottom");
    await closePlaced();
    expect(side()).toBe("bottom");
  });

  it("in the middle it stays below: data-side bottom, gap below the Trigger", async () => {
    render(<Placed gap />);
    await openPlaced();
    await frames();
    expect(side()).toBe("bottom");
    const t = trigger().getBoundingClientRect();
    const p = popup().getBoundingClientRect();
    expect(p.top - t.bottom).toBeCloseTo(6, 0);
    await closePlaced();
  });

  it("JS-free mode (a commandfor click) reports the resolved side the same way", async () => {
    render(<Placed top={window.innerHeight - 40} jsFree />);
    expect(trigger()).toHaveAttribute("commandfor", popup().id);
    await user.click(trigger());
    await actPoll(() => isOpen(), true);
    await actPoll(side, "top");
    expect(placedSide(popup(), trigger())).toBe("top");
    await closePlaced();
    expect(side()).toBe("bottom");
  });

  it("after a scroll that leaves no room below, data-side is the side the popup is on", async () => {
    // As Tooltip's row: both engines apply a scroll's option one frame after the event, and
    // Chromium 156 may keep an overflowing option of a top-layer popover (#92); the attribute must
    // match the geometry either way. Not pinned on `topLayerAnchorReChoosesOnScroll`: here, with
    // the scroll soon after the show, Chromium re-chose in every run (locally and on CI) although
    // the probe reports that it does not, so the probe does not predict this row.
    render(
      <div
        data-testid="scroller"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          width: 400,
          height: 300,
          overflow: "auto",
        }}
      >
        <div style={{ height: 500 }} />
        <Popover.Root defaultOpen={false}>
          <Popover.Trigger
            data-testid="trigger"
            style={{ display: "block", width: 100, height: 30, margin: 0 }}
          >
            Filters
          </Popover.Trigger>
          <Popover.Popup
            data-testid="popup"
            style={{ inset: "auto", margin: 0, padding: 0, border: 0, width: 160, height: 120 }}
          >
            <Popover.Title>Filters</Popover.Title>
          </Popover.Popup>
        </Popover.Root>
        <div style={{ height: 1000 }} />
      </div>,
    );
    const scroller = screen.getByTestId("scroller");
    const placedOn = () => {
      const t = trigger().getBoundingClientRect();
      const p = popup().getBoundingClientRect();
      return p.top >= t.bottom - 1 ? "bottom" : p.bottom <= t.top + 1 ? "top" : "overlapping";
    };
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
    // The Trigger 100 px into the scroller (300 px tall, at the viewport's bottom): room below.
    await scrollTo(400);
    await openPlaced();
    await frames();
    expect(side()).toBe("bottom");
    expect(placedOn()).toBe("bottom");
    // The Trigger moves to the scroller's bottom edge, which is the viewport's: no room below.
    await scrollTo(500 + 30 - scroller.clientHeight);
    await expect.poll(() => near(trigger().getBoundingClientRect().bottom, innerHeight)).toBe(true);
    expect(isOpen()).toBe(true);
    const afterScroll = placedOn();
    expect(["top", "bottom"]).toContain(afterScroll);
    await actPoll(side, afterScroll);
    console.info(
      `[popover resolved side after scroll] the engine placed the popup on ${afterScroll}`,
    );
    // Escape, back to the middle, open again: below.
    await user.keyboard("{Escape}");
    await actPoll(() => isOpen(), false);
    await actPoll(side, "bottom");
    await scrollTo(400);
    await openPlaced();
    await frames();
    expect(placedOn()).toBe("bottom");
    expect(side()).toBe("bottom");
    await closePlaced();
  });
});

describe("direction (wave 11, #53)", () => {
  async function expectMirrored(): Promise<void> {
    const t = trigger().getBoundingClientRect();
    const p = popup().getBoundingClientRect();
    expect(near(p.top, t.bottom)).toBe(true);
    expect(near(p.right, t.right)).toBe(true);
  }

  it('align="start" and side="inline-end" mirror under <html dir="rtl">', async () => {
    await withPageDirection("rtl", async () => {
      const { unmount } = render(<Placed left={300} popup={{ align: "start" }} />);
      await openPlaced();
      await frames();
      expect(side()).toBe("bottom");
      expect(popup()).toHaveAttribute("data-align", "start");
      await expectMirrored();
      await closePlaced();
      unmount();

      render(<Placed left={300} popup={{ side: "inline-end" }} />);
      expect(side()).toBe("inline-end");
      await openPlaced();
      await actPoll(side, "left");
      expect(placedSide(popup(), trigger())).toBe("left");
      await closePlaced();
      expect(side()).toBe("inline-end");
    });
  });

  it('the same inside a dir="rtl" container (Firefox: Mozilla 2019601, asserted)', async () => {
    const { unmount } = render(<Placed dir="rtl" left={300} popup={{ align: "start" }} />);
    await openPlaced();
    await frames();
    expect(popup()).toHaveAttribute("data-align", "start");
    let t = trigger().getBoundingClientRect();
    let p = popup().getBoundingClientRect();
    expect(near(p.top, t.bottom)).toBe(true);
    if (anchorPositionHonoursParentDirection) {
      expect(near(p.right, t.right)).toBe(true);
    } else {
      // Firefox (Mozilla 2019601, #89): the popup's parent box has a direction different from
      // the root's, so the inline alignment inside the cell is mirrored; no workaround ships
      // (conventions 13.3). Its inline edges meet neither Trigger edge. When this fails, the bug
      // is fixed: delete this branch.
      expect(near(p.right, t.right)).toBe(false);
      expect(near(p.left, t.left)).toBe(false);
    }
    await closePlaced();
    unmount();

    render(<Placed dir="rtl" left={300} popup={{ side: "inline-end" }} />);
    await openPlaced();
    // The side comes from the keywords and the popup's direction: right in every engine.
    await actPoll(side, "left");
    t = trigger().getBoundingClientRect();
    p = popup().getBoundingClientRect();
    if (anchorPositionHonoursParentDirection) {
      expect(near(p.right, t.left)).toBe(true);
    } else {
      // Mozilla 2019601, as above.
      expect(near(p.right, t.left)).toBe(false);
      expect(near(p.left, t.right)).toBe(false);
    }
    await closePlaced();
  });
});

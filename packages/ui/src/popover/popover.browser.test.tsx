// Popover rows that need a real engine (design/components/popover.md 13.3): real Invoker Commands
// and `:popover-open`, the implicit anchor placing the popup, Escape and light dismiss, the
// platform's focusing steps and focus return, nested auto popovers (and the library's focus return
// the platform leaves out), `position-try-fallbacks`, exit animations and the deferred unmount,
// ViewTransition around the top-layer element, and stacking with Tooltip, Dialog and unrelated
// popovers. Real keyboard and pointer input comes from Playwright through `user` (`userEvent`
// from `vitest/browser` inside `act`); the ViewTransition rows click in-page outside `act`, as
// `transition-boundary.browser.test.tsx` does, because `act` would flush React's queue itself.
// Escape with its focus return, the exit rows and the ViewTransition rows Popover shares with
// Dialog and Menu are in __tests__/overlay-browser-suite.tsx.
//
// Engine branches (src/__tests__/engine.ts, memo/developer/cross-engine.md):
// - WebKit 302008 (`position-try-fallbacks` on a nested popover hangs / spins): it did not bite
//   Menu submenus or the nested Combobox listbox on WebKit CI, so the nested rows, the flip row
//   included, use an inline placement with its `flip-inline` fallback on all three engines
//   (issue #56). A hang fails the row under the test timeout.
// - `popover="hint"` is missing in Safari 27.0 (`supportsPopoverHint`); the Tooltip row expects
//   the same either way.
import { act, render, screen } from "@testing-library/react";
import { startTransition, useState } from "react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { expectInvokerExpanded } from "../__tests__/ax-tree.js";
import { mouse } from "../__tests__/browser-commands.js";
import { user } from "../__tests__/browser-user.js";
import {
  anchorPositionHonoursParentDirection,
  browserName,
  pressFocusesButtons,
  supportsInterestFor,
  supportsPopoverHint,
} from "../__tests__/engine.js";
import {
  actPoll,
  frames,
  near,
  placedSide,
  withPageDirection,
} from "../__tests__/placement-browser.js";
import { deferred, silenceErrors } from "../__tests__/helpers.js";
import { Dialog } from "../dialog/index.js";
import { Tooltip } from "../tooltip/index.js";
import {
  describeOverlayInBrowser,
  setUpViewTransitionRows,
} from "../__tests__/overlay-browser-suite.js";
import type {
  OverlayBrowserHarnessProps,
  OverlayViewTransitionProps,
} from "../__tests__/overlay-browser-suite.js";
import { Popover } from "./index.js";
import type { PopoverOpenChangeDetails, PopoverPopupProps } from "./index.js";
import {
  closeOpenTopLayer,
  flushFor,
  leaveActEnvironment,
  runCleanups,
  quietPeriod,
  settle,
  sleep,
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

/** No wrapper element: inserted by a transition, the Popup's boundary is the subtree's top. */
function Plain({
  transition,
  className,
  keepMounted,
  controlled,
}: OverlayViewTransitionProps & { keepMounted?: boolean }) {
  if (controlled) throw new Error("Popover's Plain has no controlled variant");
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

/** The shared suite's harness: the content, then `inside`, then a Close part. */
function SuiteHarness({
  action,
  className,
  inside,
}: OverlayBrowserHarnessProps<PopoverOpenChangeDetails>) {
  return (
    <Library action={action} popup={{ className }}>
      <span data-testid="content">content</span>
      {inside}
      <Popover.Close data-testid="close">Done</Popover.Close>
    </Library>
  );
}

// The part-initiated close is a Trigger click while open; a dismissal in the ViewTransition rows
// is a `hidePopover()` (what Escape or a light dismiss does).
describeOverlayInBrowser<PopoverOpenChangeDetails>({
  name: "Popover",
  Harness: SuiteHarness,
  isOpen: (element) => element.matches(":popover-open"),
  openPseudo: ":popover-open",
  open: async () => {
    await user.click(trigger());
    await settle(() => expect(isOpen()).toBe(true));
  },
  partClose: () => user.click(trigger()),
  dismissEvent: "toggle",
  popoverTarget: true,
  // Design 2.3 and 7. The non-button Trigger (#115) is its own row below.
  pressesWhileOpen: [
    {
      name: "the Trigger: awaited close ('activate'), an invoker is no light dismiss",
      target: trigger,
      outcome: "awaited",
      focusAtPress: "target",
      focusAfter: () => trigger(),
    },
    {
      name: "a Close part: awaited close ('activate'), focus returns to the Trigger",
      target: () => screen.getByTestId("close"),
      outcome: "awaited",
      focusAtPress: "target",
      focusAfter: () => trigger(),
    },
    {
      name: "a button outside: light dismiss ('dismiss') at the release",
      target: () => screen.getByTestId("outside"),
      outcome: "dismissed",
      focusAtPress: "target",
      focusAfter: ({ pressFocused }) => (pressFocused ? screen.getByTestId("outside") : trigger()),
    },
    {
      name: "the popup's own content: nothing closes; the engine focuses the <dialog>",
      target: () => screen.getByTestId("content"),
      outcome: "stays-open",
      focusAtPress: popup,
    },
  ],
  viewTransition: {
    Plain,
    partCloses: [{ name: "a Trigger click", close: () => trigger().click() }],
    dismiss: () => popup().hidePopover(),
  },
});

describe("JS-free mode (browser)", () => {
  it("a render element's commandfor / command are dropped: a real click opens the Trigger's own popup (#121 review F1)", async () => {
    render(
      <>
        <div id="other" popover="auto" data-testid="other" style={box(100, 50)} />
        <Popover.Root>
          <Popover.Trigger
            data-testid="trigger"
            render={<button type="button" commandfor="other" command="show-popover" />}
          >
            Filters
          </Popover.Trigger>
          <Popover.Popup data-testid="popup" style={box(200, 100)}>
            <Popover.Title>Filters</Popover.Title>
          </Popover.Popup>
        </Popover.Root>
      </>,
    );
    expect(trigger()).not.toHaveAttribute("commandfor");
    expect(trigger()).not.toHaveAttribute("command");
    await user.click(trigger());
    await expect.poll(() => isOpen()).toBe(true);
    expect(screen.getByTestId("other").matches(":popover-open")).toBe(false);
  });

  it("a real popovertarget click opens and closes; data-open and the exposed state follow; Close hides", async () => {
    render(
      <Popover.Root>
        <Popover.Trigger data-testid="trigger">Filters</Popover.Trigger>
        <Popover.Popup data-testid="popup" style={box(200, 100)}>
          <Popover.Title>Filters</Popover.Title>
          <Popover.Close data-testid="close">Done</Popover.Close>
        </Popover.Popup>
      </Popover.Root>,
    );
    // The `toggle` listener writes `data-open` (#121); the browser exposes the state.
    expect(trigger()).not.toHaveAttribute("data-open");
    await expectInvokerExpanded(trigger(), popup(), false);
    await user.click(trigger());
    expect(isOpen()).toBe(true);
    await expect.poll(() => trigger().hasAttribute("data-open")).toBe(true);
    await expectInvokerExpanded(trigger(), popup(), true);
    await user.click(trigger());
    expect(isOpen()).toBe(false);
    await expect.poll(() => trigger().hasAttribute("data-open")).toBe(false);
    await expectInvokerExpanded(trigger(), popup(), false);
    await user.click(trigger());
    expect(isOpen()).toBe(true);
    await user.click(screen.getByTestId("close"));
    expect(isOpen()).toBe(false);
    await expect.poll(() => trigger().hasAttribute("data-open")).toBe(false);
    await expectInvokerExpanded(trigger(), popup(), false);
    // The platform returned focus to the invoker (first popover in a stack).
    expect(trigger()).toHaveFocus();
  });
});

describe("library mode (browser)", () => {
  // The Trigger is a `popovertarget` invoker with no `aria-expanded` in every pending phase; on
  // Chromium the computed AX state is the shown popup (#121, the state #118 rendered). CDP is
  // Chromium-only; Firefox and WebKit run the DOM assertions.
  const expectExpanded = (expanded: boolean) => expectInvokerExpanded(trigger(), popup(), expanded);

  it("the exposed state is the shown popup during a deferred open and a deferred Trigger close (#118, #121)", async () => {
    let work = deferred();
    const action = vi.fn<ActionFn>(() => work.promise);
    render(<Library action={action} />);
    await user.click(trigger());
    expect(isOpen()).toBe(false);
    expect(trigger()).toHaveAttribute("data-open", "");
    await expectExpanded(false);
    await act(async () => work.resolve());
    expect(isOpen()).toBe(true);
    await expectExpanded(true);
    work = deferred();
    await user.click(trigger());
    expect(isOpen()).toBe(true);
    expect(trigger()).toHaveAttribute("data-pending", "");
    expect(trigger()).not.toHaveAttribute("data-open");
    await expectExpanded(true);
    await act(async () => work.resolve());
    await expect.poll(() => isOpen()).toBe(false);
    await expectExpanded(false);
  });

  it("the exposed state is collapsed right after an Escape, while a slow dismissal notification runs (#118, #121)", async () => {
    const work = deferred();
    const action = vi.fn<ActionFn>((next) => (next ? undefined : work.promise));
    render(<Library action={action} />);
    await user.click(trigger());
    await expect.poll(() => isOpen()).toBe(true);
    await expectExpanded(true);
    await user.keyboard("{Escape}");
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(isOpen()).toBe(false);
    expect(action.mock.calls.at(-1)![1].reason).toBe("dismiss");
    expect(trigger()).toHaveAttribute("data-pending", "");
    await expectExpanded(false);
    // Still within the notification.
    expect(trigger()).toHaveAttribute("data-pending", "");
    await act(async () => work.resolve());
    await expect.poll(() => trigger().hasAttribute("data-pending")).toBe(false);
    await expectExpanded(false);
  });

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
    // Optimistically open (`data-open`), not shown: exposed collapsed (#118, #121).
    expect(trigger()).toHaveAttribute("data-open", "");
    await expectInvokerExpanded(trigger(), popup(), false);
    await act(async () => release());
    expect(isOpen()).toBe(true);
    await expectInvokerExpanded(trigger(), popup(), true);
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

  it("a foreign popovertarget invoker's close is 'activate' with the ToggleEvent; Escape and light dismiss stay 'dismiss' (#125)", async () => {
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
    foreign.setAttribute("popovertarget", popup().id);
    await user.click(trigger());
    await settle(() => expect(isOpen()).toBe(true));
    await user.click(foreign);
    await settle(() => expect(isOpen()).toBe(false));
    expect(action).toHaveBeenCalledTimes(2);
    const [next, details] = action.mock.calls[1]!;
    expect(next).toBe(false);
    expect(details.reason).toBe("activate");
    expect(details.event).toBeInstanceOf(ToggleEvent);
    expect(details.event!.type).toBe("beforetoggle");
    expect((details.event as ToggleEvent & { source?: Element | null }).source).toBe(foreign);
    // The platform's dismissals carry no source.
    await user.click(trigger());
    await settle(() => expect(isOpen()).toBe(true));
    await user.keyboard("{Escape}");
    await settle(() => expect(isOpen()).toBe(false));
    expect(action.mock.calls[3]![1].reason).toBe("dismiss");
    expect(action.mock.calls[3]![1].event!.type).toBe("toggle");
    await user.click(trigger());
    await settle(() => expect(isOpen()).toBe(true));
    await user.click(screen.getByTestId("outside"));
    await settle(() => expect(isOpen()).toBe(false));
    expect(action).toHaveBeenCalledTimes(6);
    expect(action.mock.calls[5]![1].reason).toBe("dismiss");
    expect(action.mock.calls[5]![1].event!.type).toBe("toggle");
  });

  it("a foreign commandfor hide-popover close keeps the CommandEvent though its beforetoggle names the button (#125)", async () => {
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
    // `popovertarget` as well: the command takes precedence, and its intent stays.
    foreign.setAttribute("popovertarget", popup().id);
    foreign.setAttribute("commandfor", popup().id);
    foreign.setAttribute("command", "hide-popover");
    await user.click(trigger());
    await settle(() => expect(isOpen()).toBe(true));
    await user.click(foreign);
    await settle(() => expect(isOpen()).toBe(false));
    expect(action).toHaveBeenCalledTimes(2);
    expect(action.mock.calls[1]![1].reason).toBe("activate");
    expect(action.mock.calls[1]![1].event!.type).toBe("command");
  });

  it("a foreign hide-popover command while closed leaves no intent: a later Escape is 'dismiss' (#125 review F2)", async () => {
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
    foreign.setAttribute("command", "hide-popover");
    const commands: Event[] = [];
    popup().addEventListener("command", (event) => commands.push(event));
    // Every engine fires `command` at the hidden popover (HTML: the state is not considered).
    await user.click(foreign);
    await flushFor();
    expect(commands).toHaveLength(1);
    expect(action).not.toHaveBeenCalled();
    await user.click(trigger());
    await settle(() => expect(isOpen()).toBe(true));
    await user.keyboard("{Escape}");
    await settle(() => expect(isOpen()).toBe(false));
    expect(action).toHaveBeenCalledTimes(2);
    expect(action.mock.calls[1]![1].reason).toBe("dismiss");
    expect(action.mock.calls[1]![1].event!.type).toBe("toggle");
  });

  it.runIf(supportsInterestFor)(
    "an interestfor button's hide stays 'dismiss' though its ToggleEvent names the button (#125 review F1)",
    async () => {
      const action = vi.fn<ActionFn>();
      render(
        <Library
          action={action}
          before={
            <button type="button" data-testid="foreign" style={{ display: "block" }}>
              Foreign
            </button>
          }
        />,
      );
      const foreign = screen.getByTestId("foreign");
      foreign.setAttribute("interestfor", popup().id);
      foreign.style.setProperty("interest-delay", "0s");
      // Interest opens through the library (cancelled at `beforetoggle`, shown with the Trigger
      // as `source`).
      await user.hover(foreign);
      await settle(() => expect(isOpen()).toBe(true));
      expect(action.mock.calls[0]![1].reason).toBe("activate");
      // Chromium 156 hides a plain popover on lost interest with the button as `source`, but not
      // one the library re-showed (its invoker is the Trigger): any close is a dismissal.
      await user.hover(screen.getByTestId("outside"));
      await sleep(300);
      if (isOpen()) {
        // The lost-interest close's shape, then the hide.
        await act(async () => {
          const lost = new ToggleEvent("beforetoggle", {
            oldState: "open",
            newState: "closed",
            source: foreign,
          } as ToggleEventInit);
          popup().dispatchEvent(lost);
          popup().hidePopover();
        });
      }
      await settle(() => expect(isOpen()).toBe(false));
      expect(action).toHaveBeenCalledTimes(2);
      expect(action.mock.calls[1]![1].reason).toBe("dismiss");
    },
  );

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

  // #117: real presses with real timing while both are open (design 7: a press inside the outer
  // popup is outside the inner one; the inner Trigger is the inner popup's invoker).
  describe("a real press while both are open (#117)", () => {
    let restoreAct: (() => void) | undefined;

    afterEach(async () => {
      await mouse.releaseHeld();
      restoreAct?.();
      restoreAct = undefined;
    });

    async function pressOn(target: Element) {
      const box = target.getBoundingClientRect();
      const x = Math.round(box.left + box.width / 2);
      const y = Math.round(box.top + box.height / 2);
      await mouse.down(x, y);
      await sleep(20);
      await mouse.up(x, y);
      await sleep(20);
    }

    it("the inner Trigger: the inner popup's close is awaited ('activate'); the outer stays", async () => {
      const work = deferred();
      const action = vi.fn<ActionFn>();
      const innerAction = vi.fn<ActionFn>((next) => (next ? undefined : work.promise));
      render(<Nested action={action} innerAction={innerAction} />);
      await openBoth();
      const outerCalls = action.mock.calls.length;
      const innerCalls = innerAction.mock.calls.length;
      restoreAct = leaveActEnvironment();
      await pressOn(screen.getByTestId("inner-trigger"));
      expect(isOpen(inner())).toBe(true);
      const innerTrigger = screen.getByTestId("inner-trigger");
      expect(innerTrigger).toHaveAttribute("data-pending", "");
      expect(innerTrigger).not.toHaveAttribute("data-open");
      await expectInvokerExpanded(innerTrigger, inner(), true);
      expect(innerAction).toHaveBeenCalledTimes(innerCalls + 1);
      const [next, details] = innerAction.mock.calls.at(-1)!;
      expect(next).toBe(false);
      expect(details.reason).toBe("activate");
      expect(details.event?.type).toBe("click");
      await quietPeriod(50, "the inner popup must stay shown until the action settles");
      expect(isOpen(inner())).toBe(true);
      work.resolve();
      await expect.poll(() => isOpen(inner())).toBe(false);
      await expectInvokerExpanded(innerTrigger, inner(), false);
      expect(isOpen()).toBe(true);
      expect(action).toHaveBeenCalledTimes(outerCalls);
      expect(popup().contains(document.activeElement)).toBe(true);
    });

    it("the outer popup's heading: the inner popup is light-dismissed ('dismiss'); the outer stays", async () => {
      const action = vi.fn<ActionFn>();
      const innerAction = vi.fn<ActionFn>();
      render(<Nested action={action} innerAction={innerAction} />);
      await openBoth();
      const outerCalls = action.mock.calls.length;
      const innerCalls = innerAction.mock.calls.length;
      restoreAct = leaveActEnvironment();
      await pressOn(screen.getByRole("heading", { name: "Filters" }));
      await expect.poll(() => isOpen(inner())).toBe(false);
      await expect.poll(() => innerAction.mock.calls.length).toBe(innerCalls + 1);
      const [next, details] = innerAction.mock.calls.at(-1)!;
      expect(next).toBe(false);
      expect(details.reason).toBe("dismiss");
      expect(details.event?.type).toBe("toggle");
      await quietPeriod(50, "the outer popup must stay open");
      expect(isOpen()).toBe(true);
      expect(action).toHaveBeenCalledTimes(outerCalls);
      // The press focused the outer popup (a <dialog>; nothing focusable under the heading).
      expect(document.activeElement).toBe(popup());
    });
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

describe("ViewTransition (browser)", () => {
  const vt = setUpViewTransitionRows((element) => element.matches(":popover-open"));

  // H1: with `transition` the close commit unmounts the focused Close before `hidePopover()`
  // runs, so the platform (which restores focus only from inside the popover) restores nothing.
  describe.each([
    ["pop", false],
    ["none", false],
    ["pop", true],
  ] as const)("transition=%s keepMounted=%s", (transition, keepMounted) => {
    it("a Close activated from the keyboard returns focus to the Trigger", async () => {
      render(<Plain transition={transition} keepMounted={keepMounted} />);
      await vt.open();
      const close = screen.getByTestId("close");
      close.focus();
      expect(close).toHaveFocus();
      await userEvent.keyboard("{Enter}");
      await expect.poll(() => isOpen()).toBe(false);
      await Promise.allSettled(vt.transitions.map((t) => t.finished));
      await expect.poll(() => document.activeElement).toBe(trigger());
    });
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
    await expect.poll(() => vt.calls.length).toBe(1);
    await vt.transitions[0]!.finished;
    trigger().click();
    await expect.poll(() => isOpen()).toBe(true);
    await quietPeriod(50, "the shielded open must not start a view transition");
    expect(vt.calls).toHaveLength(1);
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

  it("JS-free mode (a popovertarget click) reports the resolved side the same way", async () => {
    render(<Placed top={window.innerHeight - 40} jsFree />);
    expect(trigger()).toHaveAttribute("popovertarget", popup().id);
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

// #115: only an invoker <button> is spared by the popover's light dismiss, so a Trigger rendered
// as a link is light-dismissed at `pointerup`, before its click. The click still dispatches the
// right direction, but the close is browser-shaped: not awaited (hidden while the action is still
// pending), no veto, no exit transition. The degraded shape is the same on every engine; the
// `<button>` Trigger's awaited close is Menu's #110 rows and "a Trigger click while open" above.
describe("non-button Trigger click while open (browser, #115)", () => {
  afterEach(async () => {
    // A row that failed between `mouse.down` and `mouse.up` must not leave the button down.
    await mouse.releaseHeld();
  });

  it("a link Trigger's press while open hides the popup before the click's (false, 'activate')", async () => {
    silenceErrors();
    const work = deferred();
    const action = vi.fn<ActionFn>((next) => (next ? undefined : work.promise));
    render(
      <div style={{ padding: "40px 160px" }}>
        <Popover.Root defaultOpen={false} openChangeAction={action}>
          <Popover.Trigger
            data-testid="trigger"
            render={<a href="#x" />}
            style={{ display: "inline-block", width: 100, height: 30 }}
          >
            Filters
          </Popover.Trigger>
          <Popover.Popup data-testid="popup" style={box(200, 120)}>
            <Popover.Title>Filters</Popover.Title>
          </Popover.Popup>
        </Popover.Root>
      </div>,
    );
    expect(trigger().tagName).toBe("A");
    // No invoker attribute: only a button is an invoker; it exposes the mirror itself (#121).
    expect(trigger()).not.toHaveAttribute("popovertarget");
    expect(trigger()).not.toHaveAttribute("commandfor");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger());
    await settle(() => expect(isOpen()).toBe(true));
    expect(action).toHaveBeenCalledTimes(1);

    const clicks: boolean[] = [];
    // Whether the popup was still shown when the click arrived.
    trigger().addEventListener("click", () => clicks.push(isOpen()));
    const rect = trigger().getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);
    await act(async () => {
      await mouse.down(x, y);
    });
    await flushFor();
    // The press alone dismisses nothing: light dismiss runs at `pointerup`.
    expect(isOpen()).toBe(true);
    expect(action).toHaveBeenCalledTimes(1);
    await act(async () => {
      await mouse.up(x, y);
    });
    await flushFor();
    // Hidden by the light dismiss before the click, while the action's close is still pending.
    expect(clicks).toEqual([false]);
    expect(isOpen()).toBe(false);
    expect(action).toHaveBeenCalledTimes(2);
    const [next, details] = action.mock.calls[1]!;
    expect(next).toBe(false);
    expect(details.reason).toBe("activate");
    expect(details.event).toBeInstanceOf(MouseEvent);
    expect(details.event!.type).toBe("click");
    await act(async () => work.resolve());
    await flushFor();
    expect(isOpen()).toBe(false);
    expect(action).toHaveBeenCalledTimes(2);
  });
});

// #117: a foreign invoker naming the open popup (design 2.3: a foreign `hide-popover` /
// `toggle-popover` invoker is a browser-owned close the Popup records as `"activate"` and
// notifies with the `CommandEvent`). The invoker is exempt from light dismiss, so the command is
// the single source of the close. Real press, real timing.
describe("a real press on a foreign invoker while open (browser, #117)", () => {
  let restoreAct: (() => void) | undefined;

  afterEach(async () => {
    await mouse.releaseHeld();
    restoreAct?.();
    restoreAct = undefined;
  });

  it.each(["hide-popover", "toggle-popover"])(
    "command=%s hides it at the click with one (false, 'activate') carrying the CommandEvent",
    async (command) => {
      const focusesButtons = await pressFocusesButtons();
      const work = deferred();
      const action = vi.fn<ActionFn>((next) => (next ? undefined : work.promise));
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
      foreign.setAttribute("command", command);
      await user.click(trigger());
      await settle(() => expect(isOpen()).toBe(true));
      const calls = action.mock.calls.length;
      restoreAct = leaveActEnvironment();
      const box = foreign.getBoundingClientRect();
      const x = Math.round(box.left + box.width / 2);
      const y = Math.round(box.top + box.height / 2);
      await mouse.down(x, y);
      await sleep(20);
      expect(isOpen()).toBe(true);
      expect(action).toHaveBeenCalledTimes(calls);
      await mouse.up(x, y);
      await expect.poll(() => isOpen()).toBe(false);
      await expect.poll(() => action.mock.calls.length).toBe(calls + 1);
      const [next, details] = action.mock.calls.at(-1)!;
      expect(next).toBe(false);
      expect(details.reason).toBe("activate");
      expect(details.event?.type).toBe("command");
      work.resolve();
      await expectInvokerExpanded(trigger(), popup(), false);
      // Focus moved to the invoker at the press (outside the popup): the hide returns nothing.
      expect(document.activeElement).toBe(focusesButtons ? foreign : trigger());
      await quietPeriod(50, "no re-open and no second dispatch");
      expect(isOpen()).toBe(false);
      expect(action).toHaveBeenCalledTimes(calls + 1);
    },
  );
});

// #117: Popover.Close with `action` (design 2.3 row 2): the press runs the Close's own action in
// its transition (`data-pending` on the Close) with the popup shown; the close dispatch follows it.
describe("a real press on a Close with action (browser, #117)", () => {
  let restoreAct: (() => void) | undefined;

  afterEach(async () => {
    await mouse.releaseHeld();
    restoreAct?.();
    restoreAct = undefined;
  });

  it("the action runs with the popup shown; then one (false, 'activate') and focus back on the Trigger", async () => {
    const focusesButtons = await pressFocusesButtons();
    const save = deferred();
    const action = vi.fn<ActionFn>();
    render(
      <Library action={action}>
        <Popover.Close data-testid="save" action={() => save.promise}>
          Save
        </Popover.Close>
      </Library>,
    );
    await user.click(trigger());
    await settle(() => expect(isOpen()).toBe(true));
    const close = screen.getByTestId("save");
    const before = document.activeElement;
    const calls = action.mock.calls.length;
    restoreAct = leaveActEnvironment();
    const r = close.getBoundingClientRect();
    const x = Math.round(r.left + r.width / 2);
    const y = Math.round(r.top + r.height / 2);
    await mouse.down(x, y);
    await sleep(20);
    expect(isOpen()).toBe(true);
    expect(document.activeElement).toBe(focusesButtons ? close : before);
    await mouse.up(x, y);
    await sleep(20);
    expect(close).toHaveAttribute("data-pending", "");
    await quietPeriod(50, "the popup must stay shown while the Close's action runs");
    expect(isOpen()).toBe(true);
    await expectInvokerExpanded(trigger(), popup(), true);
    expect(action).toHaveBeenCalledTimes(calls);
    save.resolve();
    await expect.poll(() => isOpen()).toBe(false);
    expect(action).toHaveBeenCalledTimes(calls + 1);
    const [next, details] = action.mock.calls.at(-1)!;
    expect(next).toBe(false);
    expect(details.reason).toBe("activate");
    expect(details.event?.type).toBe("click");
    await expect.poll(() => document.activeElement).toBe(trigger());
    await quietPeriod(50, "no re-open and no second dispatch");
    expect(isOpen()).toBe(false);
    expect(action).toHaveBeenCalledTimes(calls + 1);
  });
});

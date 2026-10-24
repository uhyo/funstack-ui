// Menu rows that need a real engine (design/components/menu.md 13.2): real focus (the popover
// focusing steps honouring the library's `autofocus` write, platform focus return), Escape and
// light dismiss, Tab leaving the menu, native `focusgroup`, nested auto popovers (submenus) with
// the library's focus return, anchoring and the inline flip, real hover timing, exit animations,
// ViewTransition around the top-layer element, and stacking with Tooltip and Dialog. Real input
// comes from Playwright through `user` (`userEvent` inside `act`); the ViewTransition rows click
// in-page outside `act`, as popover.browser.test.tsx does. Escape with its focus return, the exit
// rows and the ViewTransition rows Menu shares with Dialog and Popover are in
// __tests__/overlay-browser-suite.tsx.
//
// Engine branches (src/__tests__/engine.ts, memo/developer/cross-engine.md):
// - `supportsFocusgroup` (Chromium): the native path moves focus without the library's
//   `preventDefault()` and items have no `tabindex`; elsewhere the JS path prevents the keydown.
//   Both assert the same focus outcome.
// - WebKit 302008 (`position-try-fallbacks` on a nested popover hangs / spins): it did not bite
//   the submenu's default placement on WebKit CI (review M3), so every submenu row, the
//   inline-flip row included, uses the shipped placement on all three engines (issue #49). One
//   WebKit-only row still opens a submenu twice under a test timeout so a regression fails fast.
// - WebKit matched `:focus-visible` on the `autofocus` item after a pointer open (review H1):
//   a pointer open now focuses with `focus({ focusVisible: false })` where supported; the WebKit
//   branch of that row records what WebKit does.
// - `popover="hint"` (`supportsPopoverHint`): the Tooltip row expects the same either way.
import { act, render, screen } from "@testing-library/react";
import { userEvent } from "vitest/browser";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectInvokerExpanded } from "../__tests__/ax-tree.js";
import { mouse } from "../__tests__/browser-commands.js";
import { user } from "../__tests__/browser-user.js";
import { deferred } from "../__tests__/helpers.js";
import {
  anchorPositionHonoursParentDirection,
  browserName,
  supportsFocusgroup,
  supportsFocusVisibleOption,
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
import { describeOverlayInBrowser } from "../__tests__/overlay-browser-suite.js";
import type {
  OverlayBrowserHarnessProps,
  OverlayViewTransitionProps,
} from "../__tests__/overlay-browser-suite.js";
import { Menu } from "./index.js";
import type { MenuOpenChangeDetails, MenuPopupProps, MenuRootProps } from "./index.js";
import {
  addStyle,
  closeOpenTopLayer,
  flushFor,
  onCleanup,
  runCleanups,
  sleep,
  leaveActEnvironment,
  quietPeriod,
  settle,
} from "../__tests__/browser-helpers.js";

type OpenAction = (next: boolean, details: MenuOpenChangeDetails) => unknown;

const trigger = () => screen.getByTestId("trigger");
const popup = () => screen.getByTestId("popup");
const sub = () => screen.getByTestId("subpopup");
const item = (id: string) => screen.getByTestId(id);
const isOpen = (element: Element = popup()) => element.matches(":popover-open");

afterEach(async () => {
  closeOpenTopLayer();
  runCleanups();
});

const popupStyle = {
  margin: 0,
  inset: "auto",
  padding: 4,
  border: "1px solid",
  width: 160,
} as const;

const menuCss = `
  [role="menu"] [role^="menuitem"] { display: block; width: 100%; height: 28px; text-align: start; }
`;

function Basic({
  root,
  popup: popupProps,
  children,
  after,
}: {
  root?: Partial<MenuRootProps>;
  popup?: Partial<MenuPopupProps>;
  children?: ReactNode;
  /** Rendered after the Root (the next tab stop). */
  after?: ReactNode;
}) {
  return (
    <div style={{ padding: "40px 20px" }}>
      <button type="button" data-testid="outside" style={{ display: "block" }}>
        Outside
      </button>
      <Menu.Root {...root}>
        <Menu.Trigger data-testid="trigger" style={{ width: 100, height: 30 }}>
          Actions
        </Menu.Trigger>
        <Menu.Popup data-testid="popup" style={popupStyle} {...popupProps}>
          {children ?? (
            <>
              <Menu.Item data-testid="rename">Rename</Menu.Item>
              <Menu.Item data-testid="archive" disabled>
                Archive
              </Menu.Item>
              <Menu.Item data-testid="duplicate">Duplicate</Menu.Item>
              <Menu.Item data-testid="delete">Delete</Menu.Item>
            </>
          )}
        </Menu.Popup>
      </Menu.Root>
      {after ?? (
        <button type="button" data-testid="next">
          Next
        </button>
      )}
    </div>
  );
}

function Submenu({
  sub: subProps,
  onInbox,
}: {
  sub?: Partial<MenuRootProps>;
  onInbox?: () => unknown;
}) {
  return (
    <>
      <Menu.Item data-testid="rename">Rename</Menu.Item>
      <Menu.Root {...subProps}>
        <Menu.SubmenuTrigger data-testid="move">Move to</Menu.SubmenuTrigger>
        <Menu.Popup data-testid="subpopup" style={popupStyle}>
          <Menu.Item data-testid="inbox" action={onInbox}>
            Inbox
          </Menu.Item>
          <Menu.Item data-testid="later">Later</Menu.Item>
        </Menu.Popup>
      </Menu.Root>
      <Menu.Item data-testid="delete">Delete</Menu.Item>
    </>
  );
}

beforeEach(() => {
  addStyle(menuCss);
});

async function openWithKeyboard(key = "{ArrowDown}") {
  trigger().focus();
  await user.keyboard(key);
  await flushFor();
  await expect.poll(() => isOpen()).toBe(true);
}

/** The shared suite's harness: the `content` item (focused by a keyboard open), then `inside`. */
function SuiteHarness({
  action,
  className,
  inside,
}: OverlayBrowserHarnessProps<MenuOpenChangeDetails>) {
  return (
    <Basic root={{ openChangeAction: action }} popup={{ className }}>
      <Menu.Item data-testid="content">Rename</Menu.Item>
      <Menu.Item data-testid="delete">Delete</Menu.Item>
      {inside}
    </Basic>
  );
}

/** No wrapper element: the Popup's boundary is the top of what a transition inserts. */
function Plain({ transition, className, controlled }: OverlayViewTransitionProps) {
  if (controlled) throw new Error("Menu's Plain has no controlled variant");
  return (
    <Menu.Root>
      <Menu.Trigger data-testid="trigger">Actions</Menu.Trigger>
      <Menu.Popup
        data-testid="popup"
        transition={transition}
        className={className}
        style={popupStyle}
      >
        <Menu.Item data-testid="content">Rename</Menu.Item>
        <Menu.Item data-testid="delete">Delete</Menu.Item>
      </Menu.Popup>
    </Menu.Root>
  );
}

// The part-initiated close is an item's activation (Enter on the item a keyboard open focused; a
// click in the ViewTransition rows); a dismissal there is a `hidePopover()` (what Escape or a
// light dismiss does). The Trigger click while open is left to this file (#110).
describeOverlayInBrowser<MenuOpenChangeDetails>({
  name: "Menu",
  Harness: SuiteHarness,
  isOpen: (element) => element.matches(":popover-open"),
  openPseudo: ":popover-open",
  open: () => openWithKeyboard(),
  partClose: () => user.keyboard("{Enter}"),
  dismissEvent: "toggle",
  popoverTarget: true,
  // Design 2.2. The Trigger is #110's rows below; a submenu's presses are in "submenus".
  pressesWhileOpen: [
    {
      // Not the item the keyboard open focused: the pointer moves focus to the pressed item
      // (6.2), which keeps it through the pending close.
      name: "another item: awaited close ('activate'), the pressed item has focus until it settles",
      target: () => item("delete"),
      outcome: "awaited",
      focusAtPress: "target",
      focusAfter: () => trigger(),
    },
    {
      name: "a button outside: the press's focus move hides it ('dismiss', 2.2)",
      target: () => item("outside"),
      outcome: "dismissed",
      hiddenAtPressIfFocused: true,
      focusAtPress: "target",
      focusAfter: ({ pressFocused }) => (pressFocused ? item("outside") : trigger()),
    },
    {
      name: "the popup's padding: nothing closes, the item keeps focus",
      target: popup,
      at: { x: 2, y: 2 },
      outcome: "stays-open",
      focusAtPress: "unchanged",
    },
  ],
  viewTransition: {
    Plain,
    partCloses: [
      {
        name: "an item activation",
        close: () => item("content").click(),
        // The items unmounted in the close commit, before `hidePopover()`; focus still returns.
        afterClose: () => expect.poll(() => document.activeElement).toBe(trigger()),
      },
    ],
    dismiss: () => popup().hidePopover(),
    afterOpen: () => expect(item("content")).toHaveFocus(),
  },
});

describe("keyboard end to end (browser)", () => {
  it("ArrowDown opens with real focus on the first enabled item; ArrowUp on the last", async () => {
    render(<Basic />);
    await openWithKeyboard();
    expect(item("rename")).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(isOpen()).toBe(false);
    expect(trigger()).toHaveFocus();
    await openWithKeyboard("{ArrowUp}");
    expect(item("delete")).toHaveFocus();
  });

  it("the menu is anchored below the Trigger, aligned to its start", async () => {
    render(<Basic />);
    await openWithKeyboard();
    const t = trigger().getBoundingClientRect();
    const p = popup().getBoundingClientRect();
    expect(Math.round(p.top)).toBe(Math.round(t.bottom));
    expect(Math.round(p.left)).toBe(Math.round(t.left));
  });

  it("arrows, Home / End and typeahead move real focus; Enter activates and focus returns", async () => {
    const action = vi.fn<OpenAction>();
    render(<Basic root={{ openChangeAction: action }} />);
    await openWithKeyboard();
    await user.keyboard("{ArrowDown}");
    expect(item("archive")).toHaveFocus();
    await user.keyboard("{End}");
    expect(item("delete")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(item("rename")).toHaveFocus();
    await user.keyboard("{Home}d");
    expect(item("duplicate")).toHaveFocus();
    await user.keyboard("{Enter}");
    await settle(() => expect(isOpen()).toBe(false));
    expect(trigger()).toHaveFocus();
    expect(action.mock.calls.at(-1)![0]).toBe(false);
    expect(action.mock.calls.at(-1)![1].reason).toBe("activate");
  });

  it("Shift+Tab from the first item lands on the Trigger and closes the menu", async () => {
    const action = vi.fn<OpenAction>();
    render(<Basic root={{ openChangeAction: action }} />);
    await openWithKeyboard();
    await user.tab({ shift: true });
    expect(trigger()).toHaveFocus();
    expect(isOpen()).toBe(false);
    await settle(() => expect(action.mock.calls.at(-1)![1].reason).toBe("dismiss"));
  });

  it("Tab from an item moves past the menu and closes it", async () => {
    render(<Basic />);
    await openWithKeyboard("{ArrowUp}");
    await user.tab();
    expect(item("next")).toHaveFocus();
    expect(isOpen()).toBe(false);
  });

  it("a pointer open focuses the first item without :focus-visible; hover moves focus", async () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    render(<Basic />);
    await user.click(trigger());
    await flushFor();
    await expect.poll(() => isOpen()).toBe(true);
    expect(item("rename")).toHaveFocus();
    if (supportsFocusVisibleOption) {
      // The pointer path: no `autofocus` write, a focus call that asks for no ring (H1).
      expect(focus.mock.contexts).toContain(item("rename"));
      const call = focus.mock.calls[focus.mock.contexts.indexOf(item("rename"))]!;
      expect(call[0]).toMatchObject({ focusVisible: false });
    }
    focus.mockRestore();
    // Review H1: WebKit matched `:focus-visible` on the `autofocus` target after a click; with
    // `focus({ focusVisible: false })` it does not (CI, Playwright WebKit, 2026-10-17).
    expect(item("rename").matches(":focus-visible")).toBe(false);
    await user.hover(item("duplicate"));
    expect(item("duplicate")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(item("delete")).toHaveFocus();
  });
});

describe("non-item space (browser)", () => {
  it("a click on a Separator, a GroupLabel or the padding keeps focus on the item; arrows work", async () => {
    render(
      <Basic>
        <Menu.Group>
          <Menu.GroupLabel data-testid="label" style={{ height: 20 }}>
            File
          </Menu.GroupLabel>
          <Menu.Item data-testid="rename">Rename</Menu.Item>
        </Menu.Group>
        <Menu.Separator data-testid="sep" style={{ height: 8, margin: 0 }} />
        <Menu.Item data-testid="delete">Delete</Menu.Item>
      </Basic>,
    );
    await openWithKeyboard();
    expect(item("rename")).toHaveFocus();
    await user.click(item("sep"));
    expect(item("rename")).toHaveFocus();
    await user.click(item("label"));
    expect(item("rename")).toHaveFocus();
    // The popup's own padding (top-left corner, inside the 4 px padding).
    await user.click(popup(), { position: { x: 2, y: 2 } });
    expect(item("rename")).toHaveFocus();
    expect(isOpen()).toBe(true);
    await user.keyboard("{ArrowDown}");
    expect(item("delete")).toHaveFocus();
    // Focus on the popup itself (script): the arrow keys still lead into the list.
    popup().focus();
    await user.keyboard("{Home}");
    expect(item("rename")).toHaveFocus();
    popup().focus();
    await user.keyboard("{ArrowUp}");
    expect(item("delete")).toHaveFocus();
  });
});

describe("experimental_focusgroup (browser)", () => {
  it(
    supportsFocusgroup
      ? "native path: the browser moves focus (keydown not prevented), items have no tabindex"
      : "JS path: items keep tabindex=-1 and the library prevents the keydown",
    async () => {
      const prevented: boolean[] = [];
      const listener = (event: KeyboardEvent) => {
        if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") {
          prevented.push(event.defaultPrevented);
        }
      };
      document.addEventListener("keydown", listener);
      onCleanup(() => document.removeEventListener("keydown", listener));
      const action = vi.fn();
      render(
        <Basic popup={{ experimental_focusgroup: true }}>
          <Menu.Item data-testid="rename">Rename</Menu.Item>
          <Menu.Item data-testid="duplicate" action={action}>
            Duplicate
          </Menu.Item>
          <Menu.Item data-testid="delete">Delete</Menu.Item>
        </Basic>,
      );
      await openWithKeyboard();
      expect(popup()).toHaveAttribute("focusgroup", "menu wrap");
      if (supportsFocusgroup) {
        expect(item("rename")).not.toHaveAttribute("tabindex");
      } else {
        expect(item("rename")).toHaveAttribute("tabindex", "-1");
      }
      expect(item("rename")).toHaveFocus();
      prevented.length = 0;
      await user.keyboard("{ArrowDown}");
      expect(item("duplicate")).toHaveFocus();
      await user.keyboard("{End}");
      expect(item("delete")).toHaveFocus();
      await user.keyboard("{ArrowDown}");
      expect(item("rename")).toHaveFocus();
      await user.keyboard("{Home}");
      expect(item("rename")).toHaveFocus();
      expect(prevented).toEqual(prevented.map(() => !supportsFocusgroup));
      expect(prevented.length).toBeGreaterThanOrEqual(3);
      // Typeahead and activation stay JS on both paths.
      await user.keyboard("du");
      expect(item("duplicate")).toHaveFocus();
      // The typeahead buffer resets after 500 ms without a key (TYPEAHEAD_RESET_MS in
      // menu-popup.tsx); nothing observable marks the reset, so wait it out with a margin.
      await sleep(600);
      await user.keyboard("{Enter}");
      await settle(() => expect(action).toHaveBeenCalledTimes(1));
      expect(isOpen()).toBe(false);
    },
  );
});

describe("submenus (browser)", () => {
  async function openSub() {
    await openWithKeyboard();
    await user.keyboard("{ArrowDown}{ArrowRight}");
    await flushFor();
    await expect.poll(() => isOpen(sub())).toBe(true);
  }

  it("ArrowRight opens beside the SubmenuTrigger with focus on its first item", async () => {
    render(
      <Basic>
        <Submenu />
      </Basic>,
    );
    await openSub();
    expect(item("inbox")).toHaveFocus();
    expect(isOpen()).toBe(true);
    const m = item("move").getBoundingClientRect();
    const s = sub().getBoundingClientRect();
    expect(Math.round(s.left)).toBe(Math.round(m.right));
    expect(Math.round(s.top)).toBe(Math.round(m.top));
  });

  it("Escape closes only the submenu and the library focuses its trigger", async () => {
    const subAction = vi.fn<OpenAction>();
    render(
      <Basic>
        <Submenu sub={{ openChangeAction: subAction }} />
      </Basic>,
    );
    await openSub();
    await user.keyboard("{Escape}");
    expect(isOpen(sub())).toBe(false);
    expect(isOpen()).toBe(true);
    await expect.poll(() => document.activeElement).toBe(item("move"));
    await settle(() => expect(subAction.mock.calls.at(-1)![1].reason).toBe("dismiss"));
  });

  it("ArrowLeft closes only the submenu ('activate') and focus returns to its trigger", async () => {
    const subAction = vi.fn<OpenAction>();
    render(
      <Basic>
        <Submenu sub={{ openChangeAction: subAction }} />
      </Basic>,
    );
    await openSub();
    await user.keyboard("{ArrowLeft}");
    await settle(() => expect(isOpen(sub())).toBe(false));
    expect(isOpen()).toBe(true);
    await expect.poll(() => document.activeElement).toBe(item("move"));
    expect(subAction.mock.calls.at(-1)![1].reason).toBe("activate");
  });

  it("item activation in the submenu closes both, focus on the root Trigger", async () => {
    const onInbox = vi.fn();
    const action = vi.fn<OpenAction>();
    const subAction = vi.fn<OpenAction>();
    render(
      <Basic root={{ openChangeAction: action }}>
        <Submenu sub={{ openChangeAction: subAction }} onInbox={onInbox} />
      </Basic>,
    );
    await openSub();
    const subElement = sub();
    await user.keyboard("{Enter}");
    await settle(() => expect(onInbox).toHaveBeenCalledTimes(1));
    expect(isOpen()).toBe(false);
    expect(isOpen(subElement)).toBe(false);
    expect(trigger()).toHaveFocus();
    expect(action.mock.calls.at(-1)![1].reason).toBe("activate");
    expect(subAction.mock.calls.at(-1)![1].reason).toBe("dismiss");
  });

  it("a click outside closes both", async () => {
    render(
      <Basic>
        <Submenu />
      </Basic>,
    );
    await openSub();
    const subElement = sub();
    await user.click(item("outside"));
    expect(isOpen(subElement)).toBe(false);
    expect(isOpen()).toBe(false);
  });

  // #117: real presses with real timing while a submenu is open (design 2.2, the SubmenuTrigger
  // row of 1). The pointer is parked on the target first, so the hover rules (focus follows the
  // pointer, 6.2) have run before the press.
  describe("a real press while a submenu is open (#117)", () => {
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
      await mouse.move(x, y);
      await sleep(20);
      await mouse.down(x, y);
      await sleep(20);
      await mouse.up(x, y);
      await sleep(20);
    }

    it("the SubmenuTrigger: the submenu stays open and its first item takes focus; nothing closes", async () => {
      const action = vi.fn<OpenAction>();
      const subAction = vi.fn<OpenAction>();
      render(
        <Basic root={{ openChangeAction: action }}>
          <Submenu sub={{ openChangeAction: subAction }} />
        </Basic>,
      );
      await openSub();
      const calls = [action.mock.calls.length, subAction.mock.calls.length];
      restoreAct = leaveActEnvironment();
      // The submenu's invoker: no light dismiss; its click opens, or focuses into an open submenu.
      await pressOn(item("move"));
      await expect.poll(() => document.activeElement).toBe(item("inbox"));
      await quietPeriod(80, "neither menu may close");
      expect(isOpen(sub())).toBe(true);
      expect(isOpen()).toBe(true);
      await expectInvokerExpanded(item("move"), sub(), true);
      expect([action.mock.calls.length, subAction.mock.calls.length]).toEqual(calls);
    });

    it("a sibling item: the submenu is dismissed at the release, the item's click closes the root through the action", async () => {
      const work = deferred();
      const action = vi.fn<OpenAction>((next) => (next ? undefined : work.promise));
      const subAction = vi.fn<OpenAction>();
      render(
        <Basic root={{ openChangeAction: action }}>
          <Submenu sub={{ openChangeAction: subAction }} />
        </Basic>,
      );
      await openSub();
      const subElement = sub();
      const calls = action.mock.calls.length;
      restoreAct = leaveActEnvironment();
      await pressOn(item("delete"));
      // Light dismiss of the nested popover (a press in the parent menu), or the hover close:
      // either way a dismissal. The root stays shown through its pending close.
      await expect.poll(() => isOpen(subElement)).toBe(false);
      await expect.poll(() => subAction.mock.calls.at(-1)?.[0]).toBe(false);
      expect(subAction.mock.calls.at(-1)![1].reason).toBe("dismiss");
      expect(isOpen()).toBe(true);
      expect(document.activeElement).toBe(item("delete"));
      expect(trigger()).toHaveAttribute("data-pending", "");
      expect(trigger()).not.toHaveAttribute("data-open");
      await expectInvokerExpanded(trigger(), popup(), true);
      expect(action).toHaveBeenCalledTimes(calls + 1);
      const [next, details] = action.mock.calls.at(-1)!;
      expect(next).toBe(false);
      expect(details.reason).toBe("activate");
      expect(details.event?.type).toBe("click");
      work.resolve();
      await expect.poll(() => isOpen()).toBe(false);
      await expect.poll(() => document.activeElement).toBe(trigger());
      await quietPeriod(50, "no re-open and no second dispatch");
      expect(action).toHaveBeenCalledTimes(calls + 1);
    });

    it("an item in the submenu: the root's close is awaited ('activate'); both stay shown until it settles, the submenu then notified ('dismiss')", async () => {
      const work = deferred();
      const onInbox = vi.fn();
      const action = vi.fn<OpenAction>((next) => (next ? undefined : work.promise));
      const subAction = vi.fn<OpenAction>();
      render(
        <Basic root={{ openChangeAction: action }}>
          <Submenu sub={{ openChangeAction: subAction }} onInbox={onInbox} />
        </Basic>,
      );
      await openSub();
      const subElement = sub();
      const calls = action.mock.calls.length;
      const subCalls = subAction.mock.calls.length;
      restoreAct = leaveActEnvironment();
      // Not the item the keyboard open focused: the pointer moves focus to it (6.2).
      await pressOn(item("later"));
      expect(document.activeElement).toBe(item("later"));
      expect(isOpen(subElement)).toBe(true);
      expect(isOpen()).toBe(true);
      expect(trigger()).toHaveAttribute("data-pending", "");
      await expectInvokerExpanded(trigger(), popup(), true);
      expect(action).toHaveBeenCalledTimes(calls + 1);
      const [next, details] = action.mock.calls.at(-1)!;
      expect(next).toBe(false);
      expect(details.reason).toBe("activate");
      expect(details.event?.type).toBe("click");
      await quietPeriod(50, "both menus must stay shown until the root's action settles");
      expect(isOpen(subElement)).toBe(true);
      expect(subAction).toHaveBeenCalledTimes(subCalls);
      work.resolve();
      await expect.poll(() => isOpen()).toBe(false);
      expect(isOpen(subElement)).toBe(false);
      await expect.poll(() => subAction.mock.calls.length).toBe(subCalls + 1);
      expect(subAction.mock.calls.at(-1)![0]).toBe(false);
      expect(subAction.mock.calls.at(-1)![1].reason).toBe("dismiss");
      await expect.poll(() => document.activeElement).toBe(trigger());
      expect(action).toHaveBeenCalledTimes(calls + 1);
    });
  });

  it("hover intent: opens after ~100 ms without moving focus, closes ~150 ms after leaving", async () => {
    // The hover timers update the Roots outside any `act` scope: like the ViewTransition rows,
    // this row runs outside React's act environment and drives the raw `userEvent` (review L4).
    onCleanup(leaveActEnvironment());
    const times: Record<string, number> = {};
    render(
      <Basic>
        <Submenu />
      </Basic>,
    );
    await userEvent.click(trigger());
    await expect.poll(() => isOpen()).toBe(true);
    sub().addEventListener("beforetoggle", (event) => {
      times[(event as ToggleEvent).newState] = performance.now();
    });
    item("move").addEventListener("pointerenter", () => (times.enter = performance.now()));
    await userEvent.hover(item("move"));
    await expect.poll(() => isOpen(sub()), { timeout: 2000 }).toBe(true);
    expect(times.open! - times.enter!).toBeGreaterThanOrEqual(95);
    expect(item("move")).toHaveFocus();
    // Into the submenu: entering it cancels the close.
    await userEvent.hover(item("later"));
    await quietPeriod(
      300,
      "the ~150 ms close timer of the trigger left must not close the submenu",
    );
    expect(isOpen(sub())).toBe(true);
    expect(item("later")).toHaveFocus();
    // Back to a sibling item of the parent: focus leaves the submenu and it closes.
    item("delete").addEventListener("pointerenter", () => (times.leave = performance.now()), {
      once: true,
    });
    await userEvent.hover(item("delete"));
    await expect.poll(() => isOpen(sub()), { timeout: 2000 }).toBe(false);
    expect(times.closed! - times.leave!).toBeGreaterThanOrEqual(140);
    expect(isOpen()).toBe(true);
  });

  it("near the right edge the submenu flips to the inline start", async () => {
    render(
      <div style={{ position: "fixed", top: 20, right: 10 }}>
        <Menu.Root>
          <Menu.Trigger data-testid="trigger">Actions</Menu.Trigger>
          <Menu.Popup data-testid="popup" align="end" style={popupStyle}>
            <Submenu />
          </Menu.Popup>
        </Menu.Root>
      </div>,
    );
    await openSub();
    const m = item("move").getBoundingClientRect();
    const s = sub().getBoundingClientRect();
    expect(Math.round(s.right)).toBeLessThanOrEqual(Math.round(m.left) + 1);
    // Wave 11 (#20): the submenu reports where it went, and the requested side once closed.
    await actPoll(() => sub().getAttribute("data-side"), "left");
    await user.keyboard("{Escape}");
    await expect.poll(() => isOpen(sub())).toBe(false);
    await actPoll(() => sub().getAttribute("data-side"), "inline-end");
  });

  // WebKit 302008 (design 13.2, review M3): the shipped default placement of a submenu keeps
  // `position-try-fallbacks: flip-inline`, which hung WebKit on nested popovers. The rows above
  // use it on WebKit too; this one opens it twice (the original report hung on the second open)
  // under a test timeout, so a regression fails here, by name. CI step timeout bounds a hard hang
  // of the page.
  it.runIf(browserName === "webkit")(
    "WebKit 302008: a submenu with the default placement opens beside its trigger and closes",
    { timeout: 15_000 },
    async () => {
      render(
        <Basic>
          <Submenu />
        </Basic>,
      );
      await openSub();
      expect(getComputedStyle(sub()).getPropertyValue("position-try-fallbacks")).toContain(
        "flip-inline",
      );
      const m = item("move").getBoundingClientRect();
      const s = sub().getBoundingClientRect();
      expect(Math.round(s.left)).toBe(Math.round(m.right));
      expect(item("inbox")).toHaveFocus();
      await user.keyboard("{Escape}");
      await expect.poll(() => isOpen(sub())).toBe(false);
      expect(item("move")).toHaveFocus();
      await user.keyboard("{ArrowRight}");
      await flushFor();
      await expect.poll(() => isOpen(sub())).toBe(true);
      expect(item("inbox")).toHaveFocus();
      await user.keyboard("{Escape}{Escape}");
      await expect.poll(() => isOpen()).toBe(false);
    },
  );
});

describe("resolved side and direction (browser, wave 11)", () => {
  const side = (element: Element = popup()) => element.getAttribute("data-side");

  it("a Trigger at the viewport bottom: the open menu reports data-side top and state.side top", async () => {
    let state: { side: string | null } = { side: null };
    render(
      <div style={{ position: "fixed", left: 20, bottom: 0 }}>
        <Menu.Root>
          <Menu.Trigger data-testid="trigger" style={{ width: 100, height: 30, margin: 0 }}>
            Actions
          </Menu.Trigger>
          <Menu.Popup
            data-testid="popup"
            style={popupStyle}
            className={(s) => {
              state = s;
              return undefined;
            }}
          >
            <Menu.Item data-testid="rename">Rename</Menu.Item>
          </Menu.Popup>
        </Menu.Root>
      </div>,
    );
    expect(side()).toBe("bottom");
    await openWithKeyboard();
    await actPoll(() => side(), "top");
    expect(state.side).toBe("top");
    expect(placedSide(popup(), trigger())).toBe("top");
    await user.keyboard("{Escape}");
    await expect.poll(() => isOpen()).toBe(false);
    await actPoll(() => side(), "bottom");
  });

  /**
   * In RTL: ArrowLeft opens the submenu on the item's left (`inline-end`), and the top-level
   * `align="start"` menu's right edge meets the Trigger's. `mirrored`: whether the engine places
   * the anchored popups where the keywords say (not in Firefox inside an RTL container).
   */
  async function expectRtlMenus(mirrored: boolean): Promise<void> {
    await openWithKeyboard();
    const t = trigger().getBoundingClientRect();
    let p = popup().getBoundingClientRect();
    expect(near(p.top, t.bottom)).toBe(true);
    if (mirrored) {
      expect(near(p.right, t.right)).toBe(true);
    } else {
      // Firefox (Mozilla 2019601, #89): the inline alignment is mirrored inside a direction
      // island; no workaround ships (conventions 13.3). Delete this branch once it fails.
      expect(near(p.right, t.right)).toBe(false);
      expect(near(p.left, t.left)).toBe(false);
    }
    expect(popup()).toHaveAttribute("data-align", "start");
    await user.keyboard("{ArrowDown}{ArrowLeft}");
    await flushFor();
    await expect.poll(() => isOpen(sub())).toBe(true);
    expect(item("inbox")).toHaveFocus();
    expect(sub().style.getPropertyValue("position-area")).toBe("self-x-end span-bottom");
    await frames();
    if (mirrored) {
      await actPoll(() => side(sub()), "left");
    } else {
      // Firefox: the misplaced submenu overflows and `flip-inline` applies (seen: `self-x-start
      // span-bottom`, placed 86..256 for an item at 5..165); `data-side` reports the applied
      // option, `right` (menu.md 13.2).
      await actPoll(() => side(sub()), "right");
    }
    const m = item("move").getBoundingClientRect();
    const s = sub().getBoundingClientRect();
    p = popup().getBoundingClientRect();
    expect(near(s.top, m.top)).toBe(true);
    if (mirrored) {
      expect(near(s.right, m.left)).toBe(true);
    } else {
      // Mozilla 2019601, as above: the submenu meets neither edge of its item.
      expect(near(s.right, m.left)).toBe(false);
      expect(near(s.left, m.right)).toBe(false);
    }
    // ArrowRight closes it in RTL; the attribute is the requested side again.
    await user.keyboard("{ArrowRight}");
    await expect.poll(() => isOpen(sub())).toBe(false);
    await actPoll(() => side(sub()), "inline-end");
    await user.keyboard("{Escape}");
    await expect.poll(() => isOpen()).toBe(false);
  }

  function RtlMenus({ fixedLeft }: { fixedLeft?: boolean }) {
    return (
      <div style={fixedLeft ? { position: "fixed", top: 20, left: 10 } : { padding: "40px 20px" }}>
        <Menu.Root>
          <Menu.Trigger data-testid="trigger" style={{ width: 100, height: 30, margin: 0 }}>
            Actions
          </Menu.Trigger>
          <Menu.Popup data-testid="popup" style={popupStyle}>
            <Submenu />
          </Menu.Popup>
        </Menu.Root>
      </div>
    );
  }

  it('under <html dir="rtl">: the submenu opens on the left with ArrowLeft; align start mirrors', async () => {
    await withPageDirection("rtl", async () => {
      render(<RtlMenus />);
      await expectRtlMenus(true);
    });
  });

  it('under <html dir="rtl">, near the left edge the submenu flips to the right', async () => {
    await withPageDirection("rtl", async () => {
      render(<RtlMenus fixedLeft />);
      await openWithKeyboard();
      await user.keyboard("{ArrowDown}{ArrowLeft}");
      await flushFor();
      await expect.poll(() => isOpen(sub())).toBe(true);
      await actPoll(() => side(sub()), "right");
      const m = item("move").getBoundingClientRect();
      const s = sub().getBoundingClientRect();
      expect(Math.round(s.left)).toBeGreaterThanOrEqual(Math.round(m.right) - 1);
    });
  });

  it('inside a dir="rtl" container (Firefox: Mozilla 2019601, asserted)', async () => {
    render(
      <div dir="rtl">
        <RtlMenus />
      </div>,
    );
    await expectRtlMenus(anchorPositionHonoursParentDirection);
  });
});

describe("checkbox and radio items (browser)", () => {
  it("Space toggles aria-checked and keeps the menu open; a radio switch updates both", async () => {
    render(
      <Basic>
        <Menu.CheckboxItem data-testid="dense">Dense</Menu.CheckboxItem>
        <Menu.RadioGroup defaultValue="name">
          <Menu.RadioItem data-testid="name" value="name">
            Name
          </Menu.RadioItem>
          <Menu.RadioItem data-testid="date" value="date">
            Date
          </Menu.RadioItem>
        </Menu.RadioGroup>
      </Basic>,
    );
    await openWithKeyboard();
    await user.keyboard(" ");
    expect(item("dense")).toHaveAttribute("aria-checked", "true");
    expect(isOpen()).toBe(true);
    expect(item("dense")).toHaveFocus();
    await user.keyboard("{End}{Enter}");
    expect(item("date")).toHaveAttribute("aria-checked", "true");
    expect(item("name")).toHaveAttribute("aria-checked", "false");
    expect(isOpen()).toBe(true);
  });

  // #117: the same by real presses, with real timing: a checkable item, and a plain item with
  // closeOnActivate={false}, keep the menu open (2.3); nothing closes or dispatches a close.
  it("a real press on a checkbox, a radio or a closeOnActivate={false} item keeps the menu open (#117)", async () => {
    const action = vi.fn<OpenAction>();
    const onKeep = vi.fn();
    render(
      <Basic root={{ openChangeAction: action }}>
        <Menu.CheckboxItem data-testid="dense">Dense</Menu.CheckboxItem>
        <Menu.RadioGroup defaultValue="name">
          <Menu.RadioItem data-testid="name" value="name">
            Name
          </Menu.RadioItem>
          <Menu.RadioItem data-testid="date" value="date">
            Date
          </Menu.RadioItem>
        </Menu.RadioGroup>
        <Menu.Item data-testid="keep" closeOnActivate={false} action={onKeep}>
          Keep open
        </Menu.Item>
      </Basic>,
    );
    await openWithKeyboard();
    const calls = action.mock.calls.length;
    const restore = leaveActEnvironment();
    try {
      for (const id of ["dense", "date", "keep"]) {
        const r = item(id).getBoundingClientRect();
        const x = Math.round(r.left + r.width / 2);
        const y = Math.round(r.top + r.height / 2);
        await mouse.down(x, y);
        await sleep(20);
        expect(document.activeElement).toBe(item(id));
        await mouse.up(x, y);
        await quietPeriod(60, "the menu must stay open");
        expect(isOpen()).toBe(true);
        expect(document.activeElement).toBe(item(id));
      }
    } finally {
      await mouse.releaseHeld();
      restore();
    }
    expect(item("dense")).toHaveAttribute("aria-checked", "true");
    expect(item("date")).toHaveAttribute("aria-checked", "true");
    expect(item("name")).toHaveAttribute("aria-checked", "false");
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledTimes(calls);
    await expectInvokerExpanded(trigger(), popup(), true);
  });

  it("closeOnActivate closes after the change action", async () => {
    let resolve!: () => void;
    render(
      <Basic>
        <Menu.CheckboxItem
          data-testid="dense"
          closeOnActivate
          checkedChangeAction={() => new Promise<void>((r) => (resolve = r))}
        >
          Dense
        </Menu.CheckboxItem>
      </Basic>,
    );
    await openWithKeyboard();
    await user.keyboard(" ");
    expect(isOpen()).toBe(true);
    expect(item("dense")).toHaveAttribute("data-pending", "");
    await act(async () => resolve());
    await settle(() => expect(isOpen()).toBe(false));
    expect(trigger()).toHaveFocus();
  });
});

describe("light dismiss and layering (browser)", () => {
  it("a click outside closes with 'dismiss'", async () => {
    const action = vi.fn<OpenAction>();
    render(<Basic root={{ openChangeAction: action }} />);
    await openWithKeyboard();
    await user.click(item("outside"));
    expect(isOpen()).toBe(false);
    await settle(() => expect(action.mock.calls.at(-1)![1].reason).toBe("dismiss"));
  });

  it("a Tooltip on an item does not close the menu", async () => {
    const errorSpy = vi.spyOn(console, "error");
    render(
      <Basic>
        <Menu.Item data-testid="rename">Rename</Menu.Item>
        <Tooltip.Root delay={0}>
          <Tooltip.Trigger render={<Menu.Item data-testid="share" />}>Share</Tooltip.Trigger>
          <Tooltip.Popup data-testid="tip">Copy a link</Tooltip.Popup>
        </Tooltip.Root>
      </Basic>,
    );
    await openWithKeyboard();
    await user.hover(item("share"));
    await expect.poll(() => isOpen(screen.getByTestId("tip"))).toBe(true);
    expect(isOpen()).toBe(true);
    // A roving-tabindex item is keyboard-reachable: no "not focusable" warning (#57).
    expect(errorSpy.mock.calls.filter(([m]) => String(m).includes("not focusable"))).toEqual([]);
  });

  it("a modal Dialog opened from an item (a DOM descendant) keeps the menu open", async () => {
    render(
      <Basic>
        <Dialog.Root>
          <Dialog.Trigger render={<Menu.Item data-testid="settings" closeOnActivate={false} />}>
            Settings…
          </Dialog.Trigger>
          <Dialog.Popup data-testid="dialog">
            <Dialog.Title>Settings</Dialog.Title>
            <Dialog.Close data-testid="dialog-close">Close</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Root>
      </Basic>,
    );
    await openWithKeyboard();
    await user.keyboard("{Enter}");
    await flushFor();
    const dialog = screen.getByTestId("dialog") as HTMLDialogElement;
    await expect.poll(() => dialog.open).toBe(true);
    expect(isOpen()).toBe(true);
    await user.keyboard("{Escape}");
    await settle(() => expect(dialog.open).toBe(false));
    expect(isOpen()).toBe(true);
  });
});

// #110: a press on the Trigger of an open menu moves no focus (its mousedown is prevented), so the
// Popup's focusout never hides the menu first; the click is the single source of the close
// (design/components/menu.md 2.2, "A press on the Trigger is not a focus-out"). One outcome on
// every engine.
describe("Trigger click while open (browser, #110)", () => {
  afterEach(async () => {
    // A row that failed between `mouse.down` and `mouse.up` must not leave the button down.
    await mouse.releaseHeld();
  });

  function setup() {
    const work = deferred();
    const action = vi.fn<OpenAction>((next) => (next ? undefined : work.promise));
    render(<Basic root={{ openChangeAction: action }} />);
    return { work, action };
  }

  /**
   * Pending close through the click: menu shown, item focused, optimistic feedback on the Trigger;
   * exposed expanded while the menu is shown, with no `aria-expanded` (#118, #121; the AX state on
   * Chromium).
   */
  async function expectPendingClose(action: ReturnType<typeof setup>["action"], calls: number) {
    expect(document.activeElement).toBe(item("rename"));
    expect(isOpen()).toBe(true);
    await expectInvokerExpanded(trigger(), popup(), true);
    expect(trigger()).not.toHaveAttribute("data-open");
    expect(trigger()).toHaveAttribute("data-pending", "");
    expect(action).toHaveBeenCalledTimes(calls);
    const [next, details] = action.mock.calls.at(-1)!;
    expect(next).toBe(false);
    expect(details.reason).toBe("activate");
    expect(details.event).toBeInstanceOf(MouseEvent);
    expect(details.event!.type).toBe("click");
  }

  it("closes through the action ('activate'): shown and focused until it settles", async () => {
    const { work, action } = setup();
    await openWithKeyboard();
    expect(item("rename")).toHaveFocus();
    const calls = action.mock.calls.length;
    await user.click(trigger());
    await flushFor();
    await expectPendingClose(action, calls + 1);
    await act(async () => work.resolve());
    await settle(() => expect(isOpen()).toBe(false));
    await expectInvokerExpanded(trigger(), popup(), false);
    expect(trigger()).toHaveFocus();
    expect(action).toHaveBeenCalledTimes(calls + 1);
  });

  it("a split press: the mousedown keeps focus in the menu, the release closes", async () => {
    const { work, action } = setup();
    await openWithKeyboard();
    const calls = action.mock.calls.length;
    const box = trigger().getBoundingClientRect();
    const x = Math.round(box.left + box.width / 2);
    const y = Math.round(box.top + box.height / 2);
    await act(async () => {
      await mouse.down(x, y);
    });
    await flushFor();
    expect(document.activeElement).toBe(item("rename"));
    expect(isOpen()).toBe(true);
    expect(action).toHaveBeenCalledTimes(calls);
    await act(async () => {
      await mouse.up(x, y);
    });
    await flushFor();
    await expectPendingClose(action, calls + 1);
    await act(async () => work.resolve());
    await settle(() => expect(isOpen()).toBe(false));
    await expectInvokerExpanded(trigger(), popup(), false);
    expect(trigger()).toHaveFocus();
    expect(action).toHaveBeenCalledTimes(calls + 1);
  });

  it("while closed the press is not prevented: it focuses the Trigger as a plain button", async () => {
    render(<Basic />);
    // Baseline: whether this engine focuses a clicked button (Chromium, Firefox and Playwright's
    // Linux WebKit do; Safari on macOS does not).
    await user.click(item("outside"));
    const focusesButtons = document.activeElement === item("outside");
    const focusedWhileClosed: boolean[] = [];
    trigger().addEventListener("focus", () => focusedWhileClosed.push(!isOpen()));
    await user.click(trigger());
    await expect.poll(() => isOpen()).toBe(true);
    await flushFor();
    // Focused on mousedown, before the open, exactly as the plain button was.
    expect(focusedWhileClosed).toEqual(focusesButtons ? [true] : []);
    expect(item("rename")).toHaveFocus();
  });
});

// #121: the Triggers are `popovertarget` invokers with no `aria-expanded`; on Chromium the
// accessibility tree is the state assertion (the `menuitem` role included). Firefox and WebKit
// run the DOM assertions (review F5).
describe("the exposed state of the Triggers (browser, #121)", () => {
  it("SubmenuTrigger: collapsed, expanded while the submenu is shown, collapsed after ArrowLeft", async () => {
    render(
      <Basic>
        <Submenu />
      </Basic>,
    );
    await openWithKeyboard();
    await expectInvokerExpanded(item("move"), sub(), false);
    item("move").focus();
    await user.keyboard("{ArrowRight}");
    await expect.poll(() => isOpen(sub())).toBe(true);
    await expectInvokerExpanded(item("move"), sub(), true);
    await user.keyboard("{ArrowLeft}");
    await expect.poll(() => isOpen(sub())).toBe(false);
    await expectInvokerExpanded(item("move"), sub(), false);
    expect(isOpen()).toBe(true);
  });

  it("Menu.Trigger: collapsed during a deferred open, expanded once the menu is shown", async () => {
    const work = deferred();
    const action = vi.fn<OpenAction>((next) => (next ? work.promise : undefined));
    render(<Basic root={{ openChangeAction: action }} />);
    await expectInvokerExpanded(trigger(), popup(), false);
    await user.click(trigger());
    expect(trigger()).toHaveAttribute("data-open", "");
    expect(trigger()).toHaveAttribute("data-pending", "");
    await expectInvokerExpanded(trigger(), popup(), false);
    expect(isOpen()).toBe(false);
    await act(async () => work.resolve());
    await expect.poll(() => isOpen()).toBe(true);
    await expectInvokerExpanded(trigger(), popup(), true);
  });

  it("Menu.Trigger: collapsed after a refused Escape while the notification runs, expanded again on the re-show", async () => {
    const work = deferred();
    render(<Basic root={{ open: true, openChangeAction: () => work.promise }} />);
    await expect.poll(() => isOpen()).toBe(true);
    await expectInvokerExpanded(trigger(), popup(), true);
    await user.keyboard("{Escape}");
    await expect.poll(() => isOpen()).toBe(false);
    expect(trigger()).toHaveAttribute("data-pending", "");
    await expectInvokerExpanded(trigger(), popup(), false);
    expect(trigger()).toHaveAttribute("data-pending", "");
    await act(async () => work.resolve());
    await expect.poll(() => isOpen()).toBe(true);
    await expectInvokerExpanded(trigger(), popup(), true);
  });
});

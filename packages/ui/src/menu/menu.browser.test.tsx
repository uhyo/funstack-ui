// Menu rows that need a real engine (design/components/menu.md 13.2): real focus (the popover
// focusing steps honouring the library's `autofocus` write, platform focus return), Escape and
// light dismiss, Tab leaving the menu, native `focusgroup`, nested auto popovers (submenus) with
// the library's focus return, anchoring and the inline flip, real hover timing, exit animations,
// ViewTransition around the top-layer element, and stacking with Tooltip and Dialog. Real input
// comes from Playwright through `user` (`userEvent` inside `act`); the ViewTransition rows click
// in-page outside `act`, as popover.browser.test.tsx does.
//
// Engine branches (src/__tests__/engine.ts, memo/developer/cross-engine.md):
// - `supportsFocusgroup` (Chromium): the native path moves focus without the library's
//   `preventDefault()` and items have no `tabindex`; elsewhere the JS path prevents the keydown.
//   Both assert the same focus outcome.
// - Firefox animates no CSS exit of a popover: the exit rows branch on what `getAnimations()`
//   found when the popup was hidden.
// - WebKit 302008 (`position-try-fallbacks` on a nested popover hangs / spins): submenu Popups
//   render `side={null}` on WebKit, and the inline-flip row runs on Chromium and Firefox only.
//   One WebKit-only row opens a submenu with the default placement (fallbacks included), with a
//   test timeout, to record whether the bug still bites (design 13.2, review M3).
// - WebKit matched `:focus-visible` on the `autofocus` item after a pointer open (review H1):
//   a pointer open now focuses with `focus({ focusVisible: false })` where supported; the WebKit
//   branch of that row records what WebKit does.
// - `popover="hint"` (`supportsPopoverHint`): the Tooltip row expects the same either way.
import { act, render, screen } from "@testing-library/react";
import { userEvent } from "vitest/browser";
import type { ReactNode, ViewTransitionClass } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { user } from "../__tests__/browser-user.js";
import {
  browserName,
  supportsFocusgroup,
  supportsFocusVisibleOption,
} from "../__tests__/engine.js";
import { Dialog } from "../dialog/index.js";
import { Tooltip } from "../tooltip/index.js";
import { Menu } from "./index.js";
import type { MenuOpenChangeDetails, MenuPopupProps, MenuRootProps } from "./index.js";

type OpenAction = (next: boolean, details: MenuOpenChangeDetails) => unknown;

const trigger = () => screen.getByTestId("trigger");
const popup = () => screen.getByTestId("popup");
const sub = () => screen.getByTestId("subpopup");
const item = (id: string) => screen.getByTestId(id);
const isOpen = (element: Element = popup()) => element.matches(":popover-open");
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Lets queued `toggle` tasks and React's follow-up work run. */
const flush = () =>
  act(async () => {
    await sleep(20);
  });

function addStyle(css: string): () => void {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  return () => style.remove();
}

const cleanups: (() => void)[] = [];

afterEach(async () => {
  for (const dialog of document.querySelectorAll("dialog")) if (dialog.open) dialog.close();
  for (const element of document.querySelectorAll<HTMLElement>("[popover]")) {
    if (element.matches(":popover-open")) element.hidePopover();
  }
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.restoreAllMocks();
});

/** WebKit 302008: no inline placement (no `position-try-fallbacks`) on submenu Popups there. */
const subSide = browserName === "webkit" ? null : undefined;

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
  side = subSide,
}: {
  sub?: Partial<MenuRootProps>;
  onInbox?: () => unknown;
  /** The submenu Popup's `side`; default `subSide` (none on WebKit). */
  side?: MenuPopupProps["side"];
}) {
  return (
    <>
      <Menu.Item data-testid="rename">Rename</Menu.Item>
      <Menu.Root {...subProps}>
        <Menu.SubmenuTrigger data-testid="move">Move to</Menu.SubmenuTrigger>
        <Menu.Popup data-testid="subpopup" side={side} style={popupStyle}>
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
  cleanups.push(addStyle(menuCss));
});

async function openWithKeyboard(key = "{ArrowDown}") {
  trigger().focus();
  await user.keyboard(key);
  await flush();
  await expect.poll(() => isOpen()).toBe(true);
}

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
    await flush();
    expect(isOpen()).toBe(false);
    expect(trigger()).toHaveFocus();
    expect(action.mock.calls.at(-1)![0]).toBe(false);
    expect(action.mock.calls.at(-1)![1].reason).toBe("activate");
  });

  it("Escape closes ('dismiss') with focus on the Trigger", async () => {
    const action = vi.fn<OpenAction>();
    render(<Basic root={{ openChangeAction: action }} />);
    await openWithKeyboard();
    await user.keyboard("{Escape}");
    expect(isOpen()).toBe(false);
    expect(trigger()).toHaveFocus();
    await flush();
    expect(action.mock.calls.at(-1)![1].reason).toBe("dismiss");
  });

  it("Shift+Tab from the first item lands on the Trigger and closes the menu", async () => {
    const action = vi.fn<OpenAction>();
    render(<Basic root={{ openChangeAction: action }} />);
    await openWithKeyboard();
    await user.tab({ shift: true });
    expect(trigger()).toHaveFocus();
    expect(isOpen()).toBe(false);
    await flush();
    expect(action.mock.calls.at(-1)![1].reason).toBe("dismiss");
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
    await flush();
    await expect.poll(() => isOpen()).toBe(true);
    expect(item("rename")).toHaveFocus();
    if (supportsFocusVisibleOption) {
      // The pointer path: no `autofocus` write, a focus call that asks for no ring (H1).
      expect(focus.mock.contexts).toContain(item("rename"));
      const call = focus.mock.calls[focus.mock.contexts.indexOf(item("rename"))]!;
      expect(call[0]).toMatchObject({ focusVisible: false });
    }
    focus.mockRestore();
    const visible = item("rename").matches(":focus-visible");
    if (browserName === "webkit") {
      // Review H1: WebKit matched `:focus-visible` on the `autofocus` target after a click.
      // Recorded rather than asserted until CI shows what `focusVisible: false` does there.
      console.info(`[webkit] :focus-visible after a pointer open: ${visible}`);
    } else {
      expect(visible).toBe(false);
    }
    await user.hover(item("duplicate"));
    expect(item("duplicate")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(item("delete")).toHaveFocus();
  });
});

describe("non-item space (browser, review M1)", () => {
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
      cleanups.push(() => document.removeEventListener("keydown", listener));
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
      await sleep(600);
      await user.keyboard("{Enter}");
      await flush();
      expect(action).toHaveBeenCalledTimes(1);
      expect(isOpen()).toBe(false);
    },
  );
});

describe("submenus (browser)", () => {
  async function openSub() {
    await openWithKeyboard();
    await user.keyboard("{ArrowDown}{ArrowRight}");
    await flush();
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
    if (subSide !== null) {
      const m = item("move").getBoundingClientRect();
      const s = sub().getBoundingClientRect();
      expect(Math.round(s.left)).toBe(Math.round(m.right));
      expect(Math.round(s.top)).toBe(Math.round(m.top));
    }
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
    await flush();
    expect(subAction.mock.calls.at(-1)![1].reason).toBe("dismiss");
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
    await flush();
    expect(isOpen(sub())).toBe(false);
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
    await flush();
    expect(onInbox).toHaveBeenCalledTimes(1);
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

  it("hover intent: opens after ~100 ms without moving focus, closes ~150 ms after leaving", async () => {
    // The hover timers update the Roots outside any `act` scope: like the ViewTransition rows,
    // this row runs outside React's act environment and drives the raw `userEvent` (review L4).
    type ActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const actEnvironment = (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT = false;
    cleanups.push(() => {
      (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT = actEnvironment;
    });
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
    await sleep(300);
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

  it.runIf(subSide !== null)(
    "near the right edge the submenu flips to the inline start",
    async () => {
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
    },
  );

  // WebKit 302008 (design 13.2, review M3): the shipped default placement of a submenu keeps
  // `position-try-fallbacks: flip-inline`, which hung WebKit on nested popovers. This row runs
  // it, twice (the original report hung on the second open), under a test timeout. CI step
  // timeout bounds a hard hang of the page.
  it.runIf(browserName === "webkit")(
    "WebKit 302008: a submenu with the default placement opens beside its trigger and closes",
    { timeout: 15_000 },
    async () => {
      render(
        <Basic>
          <Submenu side={undefined} />
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
      await flush();
      await expect.poll(() => isOpen(sub())).toBe(true);
      expect(item("inbox")).toHaveFocus();
      await user.keyboard("{Escape}{Escape}");
      await expect.poll(() => isOpen()).toBe(false);
    },
  );
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
    await flush();
    expect(isOpen()).toBe(false);
    expect(trigger()).toHaveFocus();
  });
});

describe("exit animation (browser)", () => {
  function fadeStyle() {
    cleanups.push(
      addStyle(`
        .fade {
          opacity: 0;
          transition: opacity 300ms, display 300ms allow-discrete, overlay 300ms allow-discrete;
        }
        .fade:popover-open { opacity: 1; }
        @starting-style { .fade:popover-open { opacity: 0; } }
      `),
    );
  }

  function watchExit() {
    const seen = { count: -1, finished: Promise.resolve() as Promise<unknown> };
    popup().addEventListener("toggle", (event) => {
      if ((event as ToggleEvent).newState !== "closed") return;
      void getComputedStyle(popup()).opacity;
      const animations = popup().getAnimations({ subtree: true });
      seen.count = animations.length;
      seen.finished = Promise.allSettled(animations.map((animation) => animation.finished));
    });
    return seen;
  }

  async function expectHeldThenReleased(seen: { count: number; finished: Promise<unknown> }) {
    expect(seen.count).toBeGreaterThanOrEqual(0);
    if (seen.count > 0) {
      expect(screen.queryByTestId("rename")).not.toBeNull();
      await act(async () => {
        await seen.finished;
        await sleep(20);
      });
      expect(screen.queryByTestId("rename")).toBeNull();
    } else {
      // Firefox: no CSS exit for a popover.
      expect(screen.queryByTestId("rename")).toBeNull();
    }
  }

  it("after an item's activation the items stay while the CSS exit runs; none in Firefox", async () => {
    fadeStyle();
    render(<Basic popup={{ className: "fade" }} />);
    await openWithKeyboard();
    await sleep(350);
    const seen = watchExit();
    await user.keyboard("{Enter}");
    await flush();
    expect(isOpen()).toBe(false);
    await expectHeldThenReleased(seen);
  });

  it("after Escape likewise", async () => {
    fadeStyle();
    render(<Basic popup={{ className: "fade" }} />);
    await openWithKeyboard();
    await sleep(350);
    const seen = watchExit();
    await user.keyboard("{Escape}");
    await flush();
    expect(isOpen()).toBe(false);
    await expectHeldThenReleased(seen);
  });
});

describe("ViewTransition (browser)", () => {
  type ActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  let actEnvironment: boolean | undefined;
  let calls: { openAtStart: boolean }[] = [];
  let transitions: ViewTransition[] = [];

  beforeEach(() => {
    calls = [];
    transitions = [];
    const original = document.startViewTransition.bind(document);
    vi.spyOn(document, "startViewTransition").mockImplementation(((
      arg?: StartViewTransitionOptions | ViewTransitionUpdateCallback,
    ) => {
      const element = document.querySelector("[data-testid=popup]");
      calls.push({ openAtStart: element?.matches(":popover-open") ?? false });
      const transition = original(arg);
      transitions.push(transition);
      return transition;
    }) as typeof document.startViewTransition);
    actEnvironment = (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT = false;
    cleanups.push(
      addStyle(`
        ::view-transition-old(.pop) { animation: 200ms ease-in both vt-pop-out; }
        ::view-transition-new(.pop) { animation: 200ms ease-out both vt-pop-in; }
        @keyframes vt-pop-out { to { opacity: 0; } }
        @keyframes vt-pop-in { from { opacity: 0; } }
      `),
    );
  });

  afterEach(async () => {
    (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT = actEnvironment;
    await Promise.allSettled(transitions.map((transition) => transition.finished));
  });

  /** No wrapper element: the Popup's boundary is the top of what a transition inserts. */
  function Plain({ transition }: { transition?: ViewTransitionClass }) {
    return (
      <Menu.Root>
        <Menu.Trigger data-testid="trigger">Actions</Menu.Trigger>
        <Menu.Popup data-testid="popup" transition={transition} style={popupStyle}>
          <Menu.Item data-testid="rename">Rename</Menu.Item>
          <Menu.Item data-testid="delete">Delete</Menu.Item>
        </Menu.Popup>
      </Menu.Root>
    );
  }

  it('transition="pop": the open and an item activation each run one; focus returns to the Trigger', async () => {
    render(<Plain transition="pop" />);
    trigger().click();
    await expect.poll(() => isOpen()).toBe(true);
    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0]!.openAtStart).toBe(false);
    await transitions[0]!.finished;
    expect(item("rename")).toHaveFocus();

    item("rename").click();
    await expect.poll(() => calls.length).toBe(2);
    expect(calls[1]!.openAtStart).toBe(true);
    await transitions[1]!.ready;
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
    expect(screen.queryByTestId("rename")).toBeNull();
    // The items unmounted in the close commit, before `hidePopover()`; focus still returns.
    await expect.poll(() => document.activeElement).toBe(trigger());
  });

  it('transition="pop": Escape runs one only for the notification commit, popup already hidden', async () => {
    render(<Plain transition="pop" />);
    trigger().click();
    await expect.poll(() => isOpen()).toBe(true);
    await expect.poll(() => calls.length).toBe(1);
    await transitions[0]!.finished;
    popup().hidePopover();
    await expect.poll(() => calls.length).toBe(2);
    expect(calls[1]!.openAtStart).toBe(false);
    await transitions[1]!.finished;
    await expect.poll(() => screen.queryByTestId("rename")).toBeNull();
  });

  it("without transition: no view transition for an open or an activation", async () => {
    render(<Plain />);
    trigger().click();
    await expect.poll(() => isOpen()).toBe(true);
    await sleep(50);
    item("rename").click();
    await expect.poll(() => isOpen()).toBe(false);
    await sleep(50);
    expect(calls).toHaveLength(0);
  });
});

describe("light dismiss and layering (browser)", () => {
  it("a click outside closes with 'dismiss'", async () => {
    const action = vi.fn<OpenAction>();
    render(<Basic root={{ openChangeAction: action }} />);
    await openWithKeyboard();
    await user.click(item("outside"));
    expect(isOpen()).toBe(false);
    await flush();
    expect(action.mock.calls.at(-1)![1].reason).toBe("dismiss");
  });

  it("a Tooltip on an item does not close the menu", async () => {
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
    await flush();
    const dialog = screen.getByTestId("dialog") as HTMLDialogElement;
    await expect.poll(() => dialog.open).toBe(true);
    expect(isOpen()).toBe(true);
    await user.keyboard("{Escape}");
    await flush();
    expect(dialog.open).toBe(false);
    expect(isOpen()).toBe(true);
  });
});

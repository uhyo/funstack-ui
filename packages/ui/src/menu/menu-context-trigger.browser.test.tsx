// Menu.ContextTrigger rows that need a real engine (design/components/context-menu.md 13.2), on
// Chromium, Firefox and WebKit: real right-clicks through Playwright's `page.mouse`
// (`mouse` in src/__tests__/browser-commands.ts), the pending-`pointerup` light dismiss that the
// pointer capture defeats in Firefox and WebKit, the point placement with the shipped
// `@position-try` rules and their flips, the remembered position option on a move, a transformed
// ancestor, the outside right / middle-click close, platform focus return, nesting in a Popover,
// ViewTransition and the CSS exit.
//
// Engine branches (src/__tests__/engine.ts, memo/developer/cross-engine.md):
// - Keyboard `contextmenu`: Playwright synthesises Shift+F10's `contextmenu` in Chromium only.
//   Firefox and WebKit press Shift for real (the modality bookkeeping sees a `keydown`) and
//   dispatch the `contextmenu` the engine would fire, with `button: 0` (Gecko's shape).
// - Long-press: no desktop engine produces a real touch long-press. Every engine runs the
//   synthetic-`pointerdown` wiring row; Chromium also holds a CDP touch and asserts the open if
//   the touch produced a `pointerdown` (recorded), else that it produced none.
// - Firefox runs no CSS exit for a popover: the exit row branches on what `getAnimations()` found.
// - `supportsFocusVisibleOption`: the quiet-focus call is asserted where the engine reads it.
//
// Every native context menu is suppressed by a window listener (bubble, after the library's
// document listener has seen the event), so a headless engine never opens its own menu over the
// page; the listener records whether the library had prevented the event.
import { act, render, screen } from "@testing-library/react";
import { cdp } from "vitest/browser";
import type { ReactNode, ViewTransitionClass } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mouse, toPagePoint, wheel } from "../__tests__/browser-commands.js";
import { user } from "../__tests__/browser-user.js";
import { browserName, supportsFocusVisibleOption } from "../__tests__/engine.js";
import { withPageDirection } from "../__tests__/placement-browser.js";
import { Popover } from "../popover/index.js";
import { Menu } from "./index.js";
import type {
  MenuContextTriggerProps,
  MenuOpenChangeDetails,
  MenuPopupProps,
  MenuRootProps,
} from "./index.js";
import {
  addStyle,
  closeOpenTopLayer,
  flushFor,
  onCleanup,
  runCleanups,
  sleep,
  leaveActEnvironment,
  spyViewTransitions,
  quietPeriod,
  settle,
} from "../__tests__/browser-helpers.js";

type OpenAction = (next: boolean, details: MenuOpenChangeDetails) => unknown;

const region = () => screen.getByTestId("region");
const popup = () => screen.getByTestId("popup");
const item = (id: string) => screen.getByTestId(id);
const isOpen = (element: Element = popup()) => element.matches(":popover-open");

/** The last `contextmenu` the page saw: its point, and whether the library prevented it. */
let lastMenu: { x: number; y: number; prevented: boolean } | null = null;

beforeEach(() => {
  lastMenu = null;
  const suppress = (event: MouseEvent) => {
    lastMenu = { x: event.clientX, y: event.clientY, prevented: event.defaultPrevented };
    event.preventDefault();
  };
  window.addEventListener("contextmenu", suppress);
  onCleanup(() => window.removeEventListener("contextmenu", suppress));
  addStyle(`
      [data-testid="popup"] { margin: 0; padding: 4px; border: 1px solid; width: 120px; box-sizing: border-box; }
      [role="menu"] [role^="menuitem"] { display: block; width: 100%; height: 24px; text-align: start; }
    `);
});

afterEach(async () => {
  // A row that failed between `mouse.down` and `mouse.up` must not leave the (in Firefox, shared,
  // #62) button down for the next rows.
  await mouse.releaseHeld();
  closeOpenTopLayer();
  runCleanups();
  window.scrollTo(0, 0);
});

interface HarnessProps {
  root?: Partial<MenuRootProps>;
  region?: Partial<MenuContextTriggerProps>;
  popup?: Partial<MenuPopupProps>;
  withTrigger?: boolean;
  /** Extra content inside the region. */
  inside?: ReactNode;
  content?: ReactNode;
  /** Wraps the Root (a transformed container, a Popover). */
  wrap?: (menu: ReactNode) => ReactNode;
}

function Items() {
  return (
    <>
      <Menu.Item data-testid="rename">Rename</Menu.Item>
      <Menu.Item data-testid="archive">Archive</Menu.Item>
      <Menu.Item data-testid="delete">Delete</Menu.Item>
    </>
  );
}

/**
 * A region covering most of the viewport (60 px free at the bottom for the outside target), with
 * a focusable button at its top-left.
 */
function Harness({
  root,
  region: regionProps,
  popup: popupProps,
  withTrigger,
  inside,
  content,
  wrap,
}: HarnessProps) {
  const menu = (
    <Menu.Root {...root}>
      <Menu.ContextTrigger
        data-testid="region"
        style={{ position: "fixed", left: 0, top: 0, right: 0, bottom: 60 }}
        {...regionProps}
      >
        <button type="button" data-testid="inner" style={{ margin: 10, width: 80, height: 30 }}>
          Inner
        </button>
        {withTrigger && (
          <Menu.Trigger data-testid="trigger" style={{ width: 60, height: 30 }}>
            More
          </Menu.Trigger>
        )}
        {inside}
      </Menu.ContextTrigger>
      <Menu.Popup data-testid="popup" aria-label="Actions" {...popupProps}>
        {content ?? <Items />}
      </Menu.Popup>
    </Menu.Root>
  );
  return (
    <>
      {wrap ? wrap(menu) : menu}
      <div
        data-testid="outside"
        style={{ position: "fixed", left: 0, bottom: 0, width: 100, height: 40 }}
      />
    </>
  );
}

const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });

/** Right-clicks at (x, y) and waits for the menu to be open. */
async function openAt(x: number, y: number, target: Element = popup()) {
  await act(async () => {
    await mouse.click(x, y, "right");
  });
  await expect.poll(() => isOpen(target)).toBe(true);
  await flushFor();
}

function rect(element: Element = popup()) {
  return element.getBoundingClientRect();
}

/** The popup's top-left equals the recorded `contextmenu` point (sub-pixel tolerance). */
function expectTopLeftAtPoint() {
  expect(lastMenu).not.toBeNull();
  const r = rect();
  expect(Math.abs(r.left - lastMenu!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(r.top - lastMenu!.y)).toBeLessThanOrEqual(1);
}

describe("opening at the pointer (browser)", () => {
  it("a right-click opens the menu with its top-left at the point; quiet focus on the first item", async () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    const action = vi.fn<OpenAction>();
    render(<Harness root={{ openChangeAction: action }} />);
    const { width, height } = viewport();
    await openAt(Math.round(width / 3), Math.round(height / 3));
    expect(lastMenu!.prevented).toBe(true);
    expectTopLeftAtPoint();
    expect(popup()).toHaveAttribute("data-context", "");
    expect(region()).toHaveAttribute("data-open", "");
    expect(item("rename")).toHaveFocus();
    if (supportsFocusVisibleOption) {
      const index = focus.mock.contexts.indexOf(item("rename"));
      expect(index).toBeGreaterThanOrEqual(0);
      expect(focus.mock.calls[index]![0]).toMatchObject({ focusVisible: false });
    }
    expect(item("rename").matches(":focus-visible")).toBe(false);
    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0]![1].event!.type).toBe("contextmenu");
  });

  it("survives the pending pointerup: press, menu opens, move off the menu, release", async () => {
    render(<Harness />);
    const { width, height } = viewport();
    const x = Math.round(width / 3);
    const y = Math.round(height / 3);
    await act(async () => {
      await mouse.down(x, y, "right");
    });
    await expect.poll(() => isOpen()).toBe(true);
    await flushFor();
    // Above the menu's top edge, so over no popover: the release Firefox and WebKit would
    // light-dismiss on. Within the press-drag-release slop (4 px, wave 11), so the gesture keeps
    // the menu open whatever the time; a release farther away is the press-drag-release rows'.
    await act(async () => {
      await mouse.move(x + 2, y - 2);
      await mouse.up(x + 2, y - 2, "right");
    });
    await flushFor();
    // Still open (nothing closed it): checked after the flush, not waited for.
    await flushFor();
    expect(isOpen()).toBe(true);
  });

  it("survives the pending pointerup when it flips away from the pointer (bottom-right corner)", async () => {
    render(<Harness />);
    const { width, height } = viewport();
    // Inside the region (60 px are free at the bottom), close enough to the corner to flip.
    const x = width - 10;
    const y = height - 70;
    await act(async () => {
      await mouse.down(x, y, "right");
    });
    await expect.poll(() => isOpen()).toBe(true);
    await flushFor();
    const r = rect();
    // Flipped up-left: the pointer is not over the menu.
    expect(Math.abs(r.right - lastMenu!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.bottom - lastMenu!.y)).toBeLessThanOrEqual(1);
    await act(async () => {
      await mouse.up(x, y, "right");
    });
    await flushFor();
    // Still open (nothing closed it): checked after the flush, not waited for.
    await flushFor();
    expect(isOpen()).toBe(true);
  });
});

describe("placement (browser)", () => {
  it("flips at the right edge, the bottom edge and the corner", async () => {
    render(<Harness />);
    const { width, height } = viewport();
    await openAt(width - 20, 100);
    let r = rect();
    expect(Math.abs(r.right - lastMenu!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.top - lastMenu!.y)).toBeLessThanOrEqual(1);
    await act(async () => popup().hidePopover());
    await flushFor();

    await openAt(100, height - 80);
    r = rect();
    expect(Math.abs(r.left - lastMenu!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.bottom - lastMenu!.y)).toBeLessThanOrEqual(1);
    await act(async () => popup().hidePopover());
    await flushFor();

    await openAt(width - 20, height - 80);
    r = rect();
    expect(Math.abs(r.right - lastMenu!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.bottom - lastMenu!.y)).toBeLessThanOrEqual(1);
  });

  it("a transformed ancestor does not move the menu (top layer)", async () => {
    render(
      <Harness
        wrap={(menu) => (
          <div style={{ position: "fixed", inset: 0, transform: "translate(50px, 30px)" }}>
            {menu}
          </div>
        )}
      />,
    );
    await openAt(150, 120);
    expectTopLeftAtPoint();
  });

  it("a re-open at a new point while open does not keep the previous flip", async () => {
    render(<Harness />);
    const { width, height } = viewport();
    await openAt(width - 10, height - 70);
    const flipped = rect();
    expect(Math.abs(flipped.right - lastMenu!.x)).toBeLessThanOrEqual(1);
    await openAt(Math.round(width / 3), Math.round(height / 3));
    expectTopLeftAtPoint();
  });

  it("one <style> for two Roots; the computed fallbacks name the library options", async () => {
    render(
      <>
        <Harness />
        <Menu.Root>
          <Menu.ContextTrigger
            data-testid="region2"
            style={{ position: "fixed", right: 0, bottom: 0, width: 100, height: 40 }}
          >
            Second
          </Menu.ContextTrigger>
          <Menu.Popup data-testid="popup2" aria-label="Second">
            <Menu.Item>Only</Menu.Item>
          </Menu.Popup>
        </Menu.Root>
      </>,
    );
    await openAt(100, 100);
    const { width, height } = viewport();
    await openAt(width - 50, height - 20, screen.getByTestId("popup2"));
    const styles = Array.from(document.head.querySelectorAll("style")).filter((style) =>
      (style.textContent ?? "").includes("@position-try --fsui-menu-up"),
    );
    expect(styles).toHaveLength(1);
    const fallbacks = getComputedStyle(screen.getByTestId("popup2")).getPropertyValue(
      "position-try-fallbacks",
    );
    expect(fallbacks).toContain("--fsui-menu-up");
    expect(fallbacks).toContain("--fsui-menu-up-left");
  });
});

describe("direction (browser, wave 11, #88)", () => {
  // The popup's computed direction picks the edge at the point (context-menu.md 4.6): in RTL the
  // menu's right edge sits at the point and the fallbacks mirror. Insets, so Mozilla 2019601
  // does not apply: no engine branch.
  async function expectRtlPointPlacement(): Promise<void> {
    const { width, height } = viewport();
    const mid = { x: Math.round(width / 2), y: Math.round(height / 3) };
    await openAt(mid.x, mid.y);
    let r = rect();
    expect(Math.abs(r.right - lastMenu!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.top - lastMenu!.y)).toBeLessThanOrEqual(1);
    expect(popup().style.getPropertyValue("right")).toBe("calc(100% - var(--menu-point-x))");
    expect(getComputedStyle(popup()).getPropertyValue("position-try-fallbacks")).toContain(
      "--fsui-menu-up-right",
    );
    await act(async () => popup().hidePopover());
    await flushFor();

    // Near the left edge: flipped rightward (`--fsui-menu-right`).
    await openAt(20, mid.y);
    r = rect();
    expect(Math.abs(r.left - lastMenu!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.top - lastMenu!.y)).toBeLessThanOrEqual(1);
    await act(async () => popup().hidePopover());
    await flushFor();

    // The bottom-left corner (the region ends 60 px above the bottom): `--fsui-menu-up-right`.
    await openAt(20, height - 70);
    r = rect();
    expect(Math.abs(r.left - lastMenu!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.bottom - lastMenu!.y)).toBeLessThanOrEqual(1);

    // A move back to the middle while open: right edge at the point again (the flip is not kept).
    await openAt(mid.x, mid.y);
    r = rect();
    expect(Math.abs(r.right - lastMenu!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.top - lastMenu!.y)).toBeLessThanOrEqual(1);
    expect(popup()).not.toHaveAttribute("data-side");
  }

  it('under <html dir="rtl"> the menu opens to the left of the point and mirrors its flips', async () => {
    await withPageDirection("rtl", async () => {
      render(<Harness />);
      await expectRtlPointPlacement();
    });
  });

  it('the same with dir="rtl" on a wrapper around the region and the Popup', async () => {
    render(<Harness wrap={(menu) => <div dir="rtl">{menu}</div>} />);
    await expectRtlPointPlacement();
  });

  it("an LTR region whose Popup is rendered under an RTL wrapper: the popup's direction wins", async () => {
    render(
      <Menu.Root>
        <Menu.ContextTrigger
          data-testid="region"
          dir="ltr"
          style={{ position: "fixed", left: 0, top: 0, right: 0, bottom: 60 }}
        />
        <div dir="rtl">
          <Menu.Popup data-testid="popup" aria-label="Actions">
            <Items />
          </Menu.Popup>
        </div>
      </Menu.Root>,
    );
    await expectRtlPointPlacement();
  });

  it("an LTR popup inside the same layout keeps its left edge at the point", async () => {
    render(<Harness />);
    const { width, height } = viewport();
    await openAt(Math.round(width / 2), Math.round(height / 3));
    expectTopLeftAtPoint();
    expect(popup().style.getPropertyValue("left")).toBe("var(--menu-point-x)");
  });
});

describe("move (browser)", () => {
  it("a right-click elsewhere in the region moves the menu; a checked item keeps its state", async () => {
    const action = vi.fn<OpenAction>();
    render(
      <Harness
        root={{ openChangeAction: action }}
        content={
          <>
            <Menu.Item data-testid="rename">Rename</Menu.Item>
            <Menu.CheckboxItem data-testid="grid">Show grid</Menu.CheckboxItem>
          </>
        }
      />,
    );
    await openAt(100, 100);
    await user.keyboard("{ArrowDown}");
    expect(item("grid")).toHaveFocus();
    await user.keyboard(" ");
    await settle(() => expect(item("grid")).toHaveAttribute("aria-checked", "true"));
    expect(isOpen()).toBe(true);
    await openAt(240, 220);
    expectTopLeftAtPoint();
    expect(item("grid")).toHaveAttribute("aria-checked", "true");
    expect(item("rename")).toHaveFocus();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("a move with the button held survives the pending pointerup (re-capture after the re-show)", async () => {
    const action = vi.fn<OpenAction>();
    render(<Harness root={{ openChangeAction: action }} />);
    await openAt(100, 100);
    await act(async () => {
      await mouse.down(240, 220, "right");
    });
    await expect.poll(() => Math.abs(rect().left - lastMenu!.x)).toBeLessThanOrEqual(1);
    expect(lastMenu!.x).toBeGreaterThan(200);
    await flushFor();
    // Within the slop of the new point and off the menu (it spans 240.. on both axes): the
    // press-drag-release gesture (wave 11) keeps it open, so this is the capture's doing alone.
    await act(async () => {
      await mouse.move(238, 218);
      await mouse.up(238, 218, "right");
    });
    await flushFor();
    // Still open (nothing closed it): checked after the flush, not waited for.
    await flushFor();
    expect(isOpen()).toBe(true);
    expectTopLeftAtPoint();
    expect(action).toHaveBeenCalledTimes(1);
  });
});

describe("closing (browser)", () => {
  it("a right-click outside closes in every engine ('dismiss'); a middle-click likewise", async () => {
    const action = vi.fn<OpenAction>();
    render(<Harness root={{ openChangeAction: action }} />);
    await openAt(100, 100);
    const outside = rect(screen.getByTestId("outside"));
    await act(async () => {
      await mouse.click(outside.left + 20, outside.top + 20, "right");
    });
    await expect.poll(() => isOpen()).toBe(false);
    await settle(() => expect(action.mock.calls.at(-1)![0]).toBe(false));
    expect(action.mock.calls.at(-1)![1].reason).toBe("dismiss");

    await openAt(100, 100);
    await act(async () => {
      await mouse.click(outside.left + 20, outside.top + 20, "middle");
    });
    await expect.poll(() => isOpen()).toBe(false);
    await settle(() => expect(action.mock.calls.at(-1)![1].reason).toBe("dismiss"));
  });

  it("a right-click inside the popup: still open, not moved, no item activated", async () => {
    const activated = vi.fn();
    render(
      <Harness
        content={
          <>
            <Menu.Item data-testid="rename" action={activated}>
              Rename
            </Menu.Item>
            <Menu.Item data-testid="archive">Archive</Menu.Item>
          </>
        }
      />,
    );
    await openAt(100, 100);
    const before = rect();
    const target = rect(item("archive"));
    await act(async () => {
      await mouse.click(target.left + 10, target.top + 10, "right");
    });
    await flushFor();
    await settle(() => expect(lastMenu!.prevented).toBe(true));
    expect(isOpen()).toBe(true);
    const after = rect();
    expect(after.left).toBe(before.left);
    expect(after.top).toBe(before.top);
    expect(activated).not.toHaveBeenCalled();
  });

  it("a left click outside closes ('dismiss'); a left click on an item activates and closes", async () => {
    const action = vi.fn<OpenAction>();
    const activated = vi.fn();
    render(
      <Harness
        root={{ openChangeAction: action }}
        content={
          <Menu.Item data-testid="rename" action={activated}>
            Rename
          </Menu.Item>
        }
      />,
    );
    await openAt(100, 100);
    await user.click(screen.getByTestId("outside"));
    await expect.poll(() => isOpen()).toBe(false);
    await settle(() => expect(action.mock.calls.at(-1)![1].reason).toBe("dismiss"));
    await openAt(100, 100);
    await user.click(item("rename"));
    await expect.poll(() => isOpen()).toBe(false);
    expect(activated).toHaveBeenCalledTimes(1);
    expect(action.mock.calls.at(-1)![1].reason).toBe("activate");
  });
});

describe("keyboard (browser)", () => {
  it(
    browserName === "chromium"
      ? "Shift+F10 on a button in the region opens inside it with the ring; Escape returns focus"
      : "a keyboard contextmenu (Shift for real, the engine's event dispatched) opens inside the button with the ring",
    async () => {
      render(<Harness />);
      const inner = item("inner");
      // A real Tab: the keyboard user's focus (script focus does not count as keyboard in Firefox).
      await user.tab();
      expect(inner).toHaveFocus();
      if (browserName === "chromium") {
        await user.keyboard("{Shift>}{F10}{/Shift}");
      } else {
        await user.keyboard("{Shift}");
        const box = rect(inner);
        await act(async () => {
          inner.dispatchEvent(
            new PointerEvent("contextmenu", {
              bubbles: true,
              cancelable: true,
              composed: true,
              button: 0,
              buttons: 0,
              clientX: box.left + 1,
              clientY: box.top + Math.min(box.height, 16),
            }),
          );
        });
      }
      await expect.poll(() => isOpen()).toBe(true);
      await flushFor();
      const box = rect(inner);
      const r = rect();
      expect(r.left).toBeGreaterThanOrEqual(box.left - 1);
      expect(r.left).toBeLessThanOrEqual(box.right + 1);
      expect(r.top).toBeGreaterThanOrEqual(box.top - 1);
      expect(r.top).toBeLessThanOrEqual(box.bottom + 1);
      expect(item("rename")).toHaveFocus();
      expect(item("rename").matches(":focus-visible")).toBe(true);
      await user.keyboard("{Escape}");
      expect(isOpen()).toBe(false);
      expect(inner).toHaveFocus();
    },
  );
});

describe("focus return (browser)", () => {
  it("a non-focusable region, no Trigger: Escape leaves focus on <body>", async () => {
    render(<Harness />);
    await openAt(200, 150);
    expect(item("rename")).toHaveFocus();
    await user.keyboard("{Escape}");
    await settle(() => expect(isOpen()).toBe(false));
    expect(document.activeElement).toBe(document.body);
  });

  it("with a Menu.Trigger in the Root: Escape focuses the Trigger", async () => {
    render(<Harness withTrigger />);
    await openAt(200, 150);
    await user.keyboard("{Escape}");
    await settle(() => expect(isOpen()).toBe(false));
    expect(item("trigger")).toHaveFocus();
  });

  it('a tabindex="0" region: Escape returns focus to it', async () => {
    render(<Harness region={{ tabIndex: 0 }} />);
    await openAt(200, 150);
    expect(item("rename")).toHaveFocus();
    await user.keyboard("{Escape}");
    await settle(() => expect(region()).toHaveFocus());
  });
});

describe("nesting (browser)", () => {
  it("a region inside an open Popover: the menu opens, the Popover stays; Escape closes the menu only", async () => {
    render(
      <Popover.Root defaultOpen>
        <Popover.Trigger data-testid="ptrigger">Panel</Popover.Trigger>
        <Popover.Popup
          data-testid="panel"
          aria-label="Panel"
          style={{ margin: 0, inset: "auto", left: 20, top: 20, width: 300, height: 200 }}
        >
          <Menu.Root>
            <Menu.ContextTrigger data-testid="region" style={{ width: 280, height: 180 }}>
              <button type="button">Inside</button>
            </Menu.ContextTrigger>
            <Menu.Popup data-testid="popup" aria-label="Actions">
              <Items />
            </Menu.Popup>
          </Menu.Root>
        </Popover.Popup>
      </Popover.Root>,
    );
    await flushFor();
    await expect.poll(() => isOpen(item("panel"))).toBe(true);
    await openAt(120, 100);
    expect(isOpen(item("panel"))).toBe(true);
    await user.keyboard("{Escape}");
    await settle(() => expect(isOpen()).toBe(false));
    expect(isOpen(item("panel"))).toBe(true);
  });

  it("ArrowRight on a SubmenuTrigger of a context-opened menu opens the submenu beside it", async () => {
    render(
      <Harness
        content={
          <>
            <Menu.Item data-testid="rename">Rename</Menu.Item>
            <Menu.Root>
              <Menu.SubmenuTrigger data-testid="move">Move to</Menu.SubmenuTrigger>
              <Menu.Popup
                data-testid="subpopup"
                style={{ margin: 0, padding: 4, width: 120, boxSizing: "border-box" }}
              >
                <Menu.Item data-testid="inbox">Inbox</Menu.Item>
              </Menu.Popup>
            </Menu.Root>
          </>
        }
      />,
    );
    await openAt(100, 100);
    await user.keyboard("{ArrowDown}{ArrowRight}");
    await flushFor();
    await expect.poll(() => isOpen(item("subpopup"))).toBe(true);
    expect(item("inbox")).toHaveFocus();
    const t = rect(item("move"));
    const s = rect(item("subpopup"));
    expect(Math.round(s.left)).toBe(Math.round(t.right));
  });
});

describe("long-press (browser)", () => {
  it("a synthetic touch pointerdown held 600 ms opens; a synthetic pointerup keeps it open", async () => {
    const action = vi.fn<OpenAction>();
    render(<Harness root={{ openChangeAction: action }} />);
    const init = {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerType: "touch",
      isPrimary: true,
      pointerId: 42,
      clientX: 150,
      clientY: 120,
      button: 0,
      buttons: 1,
    };
    await act(async () => {
      region().dispatchEvent(new PointerEvent("pointerdown", init));
      // Inside `act`: the 500 ms timer (earlier deadline, same thread) has fired by then and its
      // updates are in this scope. Polling for the open cannot replace the wait: React queues it
      // in the `act` scope until the scope ends (#101).
      await sleep(600);
    });
    await expect.poll(() => isOpen()).toBe(true);
    await settle(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action.mock.calls[0]![1].event!.type).toBe("pointerdown");
    // Above the touch point with the 16 px gap (wave 11, 4.7).
    expectBottomLeftAt(150, 120 - 16);
    await act(async () => {
      region().dispatchEvent(new PointerEvent("pointerup", { ...init, buttons: 0 }));
    });
    // Still open (nothing closed it): checked after the flush, not waited for.
    await flushFor();
    expect(isOpen()).toBe(true);
  });

  it.runIf(browserName === "chromium")(
    "a CDP touch held 600 ms opens if it produced a pointerdown",
    async () => {
      const action = vi.fn<OpenAction>();
      render(<Harness root={{ openChangeAction: action }} />);
      const downs: string[] = [];
      region().addEventListener("pointerdown", (e) => downs.push(e.pointerType), true);
      const session = cdp();
      const point = toPagePoint(150, 120);
      await act(async () => {
        await session.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [point],
        });
        await sleep(600);
      });
      if (downs.includes("touch")) {
        await expect.poll(() => isOpen()).toBe(true);
        expect(action.mock.calls.filter(([next]) => next)).toHaveLength(1);
      } else {
        expect(downs).toEqual([]);
      }
      await act(async () => {
        await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      });
      await flushFor();
      if (downs.includes("touch")) expect(isOpen()).toBe(true);
    },
  );
});

describe("editable targets (browser)", () => {
  it("a right-click in a textarea keeps the native menu; editableTargets=menu opens", async () => {
    const { unmount } = render(
      <Harness inside={<textarea data-testid="text" style={{ display: "block", margin: 10 }} />} />,
    );
    const box = rect(item("text"));
    await act(async () => {
      await mouse.click(box.left + 10, box.top + 10, "right");
    });
    await flushFor();
    await settle(() => expect(lastMenu).not.toBeNull());
    expect(lastMenu!.prevented).toBe(false);
    expect(isOpen()).toBe(false);
    unmount();
    render(
      <Harness
        region={{ editableTargets: "menu" }}
        inside={<textarea data-testid="text" style={{ display: "block", margin: 10 }} />}
      />,
    );
    const box2 = rect(item("text"));
    await openAt(box2.left + 10, box2.top + 10);
    expect(lastMenu!.prevented).toBe(true);
  });
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
        ::view-transition-old(.pop) { animation: 100ms ease-in both vt-cm-out; }
        ::view-transition-new(.pop) { animation: 100ms ease-out both vt-cm-in; }
        @keyframes vt-cm-out { to { opacity: 0; } }
        @keyframes vt-cm-in { from { opacity: 0; } }
      `);
  });

  afterEach(async () => {
    restoreAct();
    await Promise.allSettled(transitions.map((transition) => transition.finished));
  });

  function Plain({ transition }: { transition?: ViewTransitionClass }) {
    return <Harness popup={transition === undefined ? {} : { transition }} />;
  }

  it('transition="pop": an open runs one, a move none, an item activation one', async () => {
    render(<Plain transition="pop" />);
    await mouse.click(100, 100, "right");
    await expect.poll(() => isOpen()).toBe(true);
    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0]!.openAtStart).toBe(false);
    await transitions[0]!.finished;
    await mouse.click(240, 220, "right");
    await expect.poll(() => lastMenu?.x).toBeGreaterThan(200);
    await expect.poll(() => Math.abs(rect().left - lastMenu!.x)).toBeLessThanOrEqual(1);
    await quietPeriod(50, "a move must not start a view transition");
    expect(calls).toHaveLength(1);
    item("rename").click();
    await expect.poll(() => calls.length).toBe(2);
    expect(calls[1]!.openAtStart).toBe(true);
    await transitions[1]!.finished;
    await expect.poll(() => isOpen()).toBe(false);
  });

  it('transition="pop": the outside right-click hides at once; only the notification commit runs one', async () => {
    render(<Plain transition="pop" />);
    await mouse.click(100, 100, "right");
    await expect.poll(() => isOpen()).toBe(true);
    await expect.poll(() => calls.length).toBe(1);
    await transitions[0]!.finished;
    const outside = rect(screen.getByTestId("outside"));
    await mouse.click(outside.left + 20, outside.top + 20, "right");
    await expect.poll(() => isOpen()).toBe(false);
    // As Escape (menu.browser.test.tsx): the dismissal's notification commit, popup already
    // hidden when it starts.
    await expect.poll(() => calls.length).toBe(2);
    expect(calls[1]!.openAtStart).toBe(false);
    await transitions[1]!.finished;
  });

  it("without transition: none for an open, a move, an outside close or an activation", async () => {
    render(<Plain />);
    await mouse.click(100, 100, "right");
    await expect.poll(() => isOpen()).toBe(true);
    await mouse.click(240, 220, "right");
    await expect.poll(() => Math.abs(rect().left - lastMenu!.x)).toBeLessThanOrEqual(1);
    const outside = rect(screen.getByTestId("outside"));
    await mouse.click(outside.left + 20, outside.top + 20, "right");
    await expect.poll(() => isOpen()).toBe(false);
    await mouse.click(100, 100, "right");
    await expect.poll(() => isOpen()).toBe(true);
    item("rename").click();
    await expect.poll(() => isOpen()).toBe(false);
    await quietPeriod(50, "no part may start a view transition");
    expect(calls).toHaveLength(0);
  });
});

describe("exit animation (browser)", () => {
  it("after the outside right-click close the items stay while the CSS exit runs; none in Firefox", async () => {
    addStyle(`
        .held-exit {
          opacity: 0;
          transition: opacity 60s, display 60s allow-discrete, overlay 60s allow-discrete;
        }
        .held-exit:popover-open { opacity: 1; transition-duration: 0s; }
      `);
    render(<Harness popup={{ className: "held-exit" }} />);
    await openAt(100, 100);
    const exit = new Promise<Animation[]>((resolve) => {
      const element = popup();
      element.addEventListener("toggle", function listener(event) {
        if ((event as ToggleEvent).newState !== "closed") return;
        element.removeEventListener("toggle", listener);
        void getComputedStyle(element).opacity;
        resolve(element.getAnimations({ subtree: true }));
      });
    });
    const outside = rect(screen.getByTestId("outside"));
    await act(async () => {
      await mouse.click(outside.left + 20, outside.top + 20, "right");
    });
    let animations: Animation[] = [];
    await act(async () => {
      animations = await exit;
    });
    expect(isOpen()).toBe(false);
    if (browserName === "chromium") expect(animations.length).toBeGreaterThan(0);
    if (animations.length > 0) {
      expect(screen.queryByTestId("rename")).not.toBeNull();
      // Still placed at the point while it fades (no jump back to an anchored placement).
      expect(popup()).toHaveAttribute("data-context", "");
      await act(async () => {
        for (const animation of animations) animation.finish();
        await Promise.allSettled(animations.map((animation) => animation.finished));
        await sleep(20);
      });
      expect(screen.queryByTestId("rename")).toBeNull();
    } else {
      expect(screen.queryByTestId("rename")).toBeNull();
    }
  });
});

/** The popup's bottom-left equals (x, y). */
function expectBottomLeftAt(x: number, y: number) {
  const r = rect();
  expect(Math.abs(r.left - x)).toBeLessThanOrEqual(1);
  expect(Math.abs(r.bottom - y)).toBeLessThanOrEqual(1);
}

/** The popup's top-left equals (x, y). */
function expectTopLeftAt(x: number, y: number) {
  const r = rect();
  expect(Math.abs(r.left - x)).toBeLessThanOrEqual(1);
  expect(Math.abs(r.top - y)).toBeLessThanOrEqual(1);
}
// --- Wave 11 (#88): press-drag-release, touch offset, scrolling --------------------------------

/** Where an item of the open menu is: its centre. */
function centre(element: Element) {
  const r = element.getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
}

/**
 * The time between the start of the gesture's 500 ms and the next `pointerup`, from the events'
 * own timestamps: the dismissal rule is asserted against what happened, never against a sleep
 * that load could stretch. The library counts from the popup's open `toggle` (review M2), or from
 * the `contextmenu` of a move on a menu already showing; the later of the two is used here, which
 * can only make `elapsed` smaller than the library's.
 */
function watchGestureTime() {
  const times = { menu: Number.NaN, shown: Number.NaN, up: Number.NaN };
  const onMenu = () => (times.menu = performance.now());
  const onToggle = (event: Event) => {
    const target = event.target as Element;
    if ((event as ToggleEvent).newState === "open" && target.matches('[role="menu"]')) {
      times.shown = performance.now();
    }
  };
  const onUp = () => (times.up = performance.now());
  window.addEventListener("contextmenu", onMenu, true);
  window.addEventListener("toggle", onToggle, true);
  window.addEventListener("pointerup", onUp, true);
  onCleanup(() => {
    window.removeEventListener("contextmenu", onMenu, true);
    window.removeEventListener("toggle", onToggle, true);
    window.removeEventListener("pointerup", onUp, true);
  });
  return {
    elapsed: () =>
      times.up - (Number.isNaN(times.shown) ? times.menu : Math.max(times.menu, times.shown)),
  };
}

describe("press-drag-release (browser, wave 11, #88)", () => {
  // context-menu.md 2.6. Linux CI fires `contextmenu` on the right-button press, so the menu
  // opens with the button down and the popup holds the capture for the rest of the gesture.
  function DragItems({ archive }: { archive: () => void }) {
    return (
      <>
        <Menu.Item data-testid="rename">Rename</Menu.Item>
        <Menu.Item data-testid="archive" action={archive}>
          Archive
        </Menu.Item>
        <Menu.Item data-testid="delete">Delete</Menu.Item>
      </>
    );
  }

  it("press, slide onto an item, release: the item is activated and the menu closes", async () => {
    const archive = vi.fn();
    const action = vi.fn<OpenAction>();
    render(
      <Harness root={{ openChangeAction: action }} content={<DragItems archive={archive} />} />,
    );
    const { width, height } = viewport();
    const x = Math.round(width / 3);
    const y = Math.round(height / 3);
    await act(async () => {
      await mouse.down(x, y, "right");
    });
    await expect.poll(() => isOpen()).toBe(true);
    await flushFor();
    const target = centre(item("archive"));
    await act(async () => {
      await mouse.move(target.x, target.y);
    });
    await expect.poll(() => document.activeElement).toBe(item("archive"));
    // The gesture's focus is quiet, as a hover's.
    expect(item("archive").matches(":focus-visible")).toBe(false);
    await act(async () => {
      await mouse.up(target.x, target.y, "right");
    });
    await expect.poll(() => archive.mock.calls.length).toBe(1);
    await expect.poll(() => isOpen()).toBe(false);
    await flushFor();
    expect(action.mock.calls.at(-1)).toEqual([
      false,
      expect.objectContaining({ reason: "activate" }),
    ]);
  });

  it("a stationary press and release keeps it open; a later left click on an item activates", async () => {
    const archive = vi.fn();
    render(<Harness content={<DragItems archive={archive} />} />);
    const { width, height } = viewport();
    const x = Math.round(width / 3);
    const y = Math.round(height / 3);
    await act(async () => {
      await mouse.down(x, y, "right");
    });
    await expect.poll(() => isOpen()).toBe(true);
    await act(async () => {
      await mouse.up(x, y, "right");
    });
    // Still open (nothing closed it): checked after the flush, not waited for.
    await flushFor();
    expect(isOpen()).toBe(true);
    expect(item("rename")).toHaveFocus();
    expect(archive).not.toHaveBeenCalled();
    const target = centre(item("archive"));
    await act(async () => {
      await mouse.click(target.x, target.y);
    });
    await expect.poll(() => archive.mock.calls.length).toBe(1);
    await expect.poll(() => isOpen()).toBe(false);
  });

  it("a held-button move released off the menu stays open before 500 ms and closes after", async () => {
    const action = vi.fn<OpenAction>();
    const time = watchGestureTime();
    render(<Harness root={{ openChangeAction: action }} />);
    await openAt(100, 100);
    // A move with the button held: the menu re-shows at the new point and re-captures.
    await act(async () => {
      await mouse.down(240, 220, "right");
    });
    await expect.poll(() => Math.abs(rect().left - lastMenu!.x)).toBeLessThanOrEqual(1);
    // Off the menu (it spans 240.. on both axes), more than the slop away, at once.
    await act(async () => {
      await mouse.move(180, 160);
      await mouse.up(180, 160, "right");
    });
    await flushFor();
    await flushFor();
    if (time.elapsed() < 500) {
      // A quick release is not a dismissal (and the capture held through the re-show).
      expect(isOpen()).toBe(true);
      expectTopLeftAtPoint();
    } else {
      // The machine was slow enough for the release to count as a deliberate one.
      console.warn(`[L4] the release came ${Math.round(time.elapsed())} ms after the move`);
      expect(isOpen()).toBe(false);
    }
    expect(action.mock.calls.filter(([next]) => next)).toHaveLength(1);

    // The same release at least 500 ms after a move (or an open, if the first release closed
    // it), pressed off the current menu: dismissed.
    await act(async () => {
      await mouse.down(100, 400, "right");
    });
    await expect.poll(() => isOpen()).toBe(true);
    await expect.poll(() => Math.abs(rect().top - 400)).toBeLessThanOrEqual(1);
    await act(async () => {
      // A required duration, not a stand-in for an event: the release must come at least
      // 500 ms (DRAG_DISMISS_DELAY, menu-context-trigger.tsx) after the open.
      await sleep(600);
      await mouse.move(60, 340);
      await mouse.up(60, 340, "right");
    });
    expect(time.elapsed()).toBeGreaterThanOrEqual(500);
    await expect.poll(() => isOpen()).toBe(false);
    await flushFor();
    expect(action.mock.calls.at(-1)).toEqual([
      false,
      expect.objectContaining({ reason: "dismiss" }),
    ]);
  });

  it("flipped away from the pointer, held still for 600 ms and released in place: still open", async () => {
    render(<Harness />);
    const { width, height } = viewport();
    const x = width - 10;
    const y = height - 70;
    await act(async () => {
      await mouse.down(x, y, "right");
    });
    await expect.poll(() => isOpen()).toBe(true);
    await flushFor();
    // Flipped up-left: the pointer is at the corner, over no item.
    expect(Math.abs(rect().right - lastMenu!.x)).toBeLessThanOrEqual(1);
    await act(async () => {
      // Held still past DRAG_DISMISS_DELAY (500 ms): only the missing movement keeps it open.
      await sleep(600);
      await mouse.up(x, y, "right");
    });
    await flushFor();
    await flushFor();
    // Movement is required to dismiss as well as time.
    expect(isOpen()).toBe(true);
  });

  it.runIf(browserName === "chromium")(
    "touch: long-press, slide onto an item, lift (CDP touch emulation, if it produces pointer events)",
    async () => {
      const archive = vi.fn();
      render(<Harness content={<DragItems archive={archive} />} />);
      const downs: string[] = [];
      region().addEventListener("pointerdown", (e) => downs.push(e.pointerType), true);
      const session = cdp();
      const start = { x: 200, y: 300 };
      await act(async () => {
        await session.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [toPagePoint(start.x, start.y)],
        });
        await sleep(600);
      });
      if (!downs.includes("touch")) {
        // This Chromium produced no pointer events for the emulated touch: nothing to drive.
        expect(downs).toEqual([]);
        await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        return;
      }
      await expect.poll(() => isOpen()).toBe(true);
      await flushFor();
      // Above the finger with the 16 px gap (4.7).
      expectBottomLeftAt(start.x, start.y - 16);
      const target = centre(item("archive"));
      await act(async () => {
        for (let step = 1; step <= 5; step++) {
          const x = start.x + ((target.x - start.x) * step) / 5;
          const y = start.y + ((target.y - start.y) * step) / 5;
          await session.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [toPagePoint(x, y)],
          });
        }
      });
      await expect.poll(() => document.activeElement).toBe(item("archive"));
      await act(async () => {
        await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      });
      await expect.poll(() => archive.mock.calls.length).toBe(1);
      await expect.poll(() => isOpen()).toBe(false);
    },
  );
});

describe("touch offset (browser, wave 11, #88)", () => {
  async function longPressAt(x: number, y: number) {
    await act(async () => {
      region().dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerType: "touch",
          isPrimary: true,
          pointerId: 43,
          clientX: x,
          clientY: y,
          button: 0,
          buttons: 1,
        }),
      );
      await sleep(600);
    });
    await expect.poll(() => isOpen()).toBe(true);
    await flushFor();
  }

  it("a touch open sits 16 px above the point, start-aligned; near the top it opens below", async () => {
    render(<Harness />);
    const { height } = viewport();
    const y = Math.round(height / 2);
    await longPressAt(150, y);
    expectBottomLeftAt(150, y - 16);
    expect(popup().style.getPropertyValue("--menu-point-gap")).toBe("16px");
    await act(async () => popup().hidePopover());
    await flushFor();

    // No room above: `--fsui-menu-down`, below the point with the same gap.
    await longPressAt(150, 30);
    expectTopLeftAt(150, 30 + 16);
  });

  it("a mouse open after it is placed at the point again (0px gap)", async () => {
    render(<Harness />);
    const { height } = viewport();
    await longPressAt(150, Math.round(height / 2));
    await openAt(200, 120);
    expectTopLeftAtPoint();
    expect(popup().style.getPropertyValue("--menu-point-gap")).toBe("0px");
  });
});

describe("scrolling (browser, wave 11, #88)", () => {
  // A page taller than the viewport; the region is fixed, so a wheel over it scrolls the document.
  function ScrollPage(props: HarnessProps) {
    return (
      <>
        <Harness {...props} />
        <div style={{ height: 4000 }} />
      </>
    );
  }

  /** Whether the page saw the wheel event prevented (a window listener, after the library's). */
  function watchWheel() {
    const seen = { prevented: null as boolean | null };
    const onWheel = (event: WheelEvent) => (seen.prevented = event.defaultPrevented);
    window.addEventListener("wheel", onWheel, { passive: true });
    onCleanup(() => window.removeEventListener("wheel", onWheel));
    return seen;
  }

  /**
   * Opens at (x, y) and waits for close-on-scroll to be armed: scroll events are ignored until
   * the first frame without one after the popup's open `toggle` (review L6). A frame callback
   * registered after that `toggle` runs after the library's in the same frame.
   */
  async function openArmed(x: number, y: number) {
    const shown = new Promise<void>((resolve) => {
      const onToggle = (event: Event) => {
        if ((event as ToggleEvent).newState !== "open") return;
        popup().removeEventListener("toggle", onToggle);
        resolve();
      };
      popup().addEventListener("toggle", onToggle);
    });
    await openAt(x, y);
    await act(async () => {
      await shown;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
  }

  it("a wheel over the page closes a point menu ('dismiss') and the page scrolls", async () => {
    const action = vi.fn<OpenAction>();
    render(<ScrollPage root={{ openChangeAction: action }} />);
    await openArmed(100, 100);
    await act(async () => {
      await wheel(400, 400, 0, 200);
    });
    await expect.poll(() => window.scrollY).toBeGreaterThan(0);
    await expect.poll(() => isOpen()).toBe(false);
    await flushFor();
    expect(action.mock.calls.at(-1)).toEqual([
      false,
      expect.objectContaining({ reason: "dismiss" }),
    ]);
  });

  it("a Trigger-opened menu stays open and on its Trigger while the page scrolls", async () => {
    render(<ScrollPage withTrigger />);
    await user.click(screen.getByTestId("trigger"));
    await expect.poll(() => isOpen()).toBe(true);
    await flushFor();
    await act(async () => {
      await wheel(400, 400, 0, 200);
    });
    await expect.poll(() => window.scrollY).toBeGreaterThan(0);
    // Still open (nothing closed it): checked after the flush, not waited for.
    await flushFor();
    expect(isOpen()).toBe(true);
    const t = screen.getByTestId("trigger").getBoundingClientRect();
    expect(Math.abs(rect().top - t.bottom)).toBeLessThanOrEqual(1);
  });

  it("a wheel over a menu that cannot scroll never scrolls the page", async () => {
    const seen = watchWheel();
    render(<ScrollPage />);
    await openAt(100, 100);
    const over = centre(item("archive"));
    await act(async () => {
      await wheel(over.x, over.y, 0, 200);
    });
    // The condition, not a wait for "nothing happened": the library prevented the wheel.
    expect(seen.prevented).toBe(true);
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    expect(window.scrollY).toBe(0);
    expect(isOpen()).toBe(true);
  });

  it("a wheel over a menu that can scroll scrolls the menu, not the page", async () => {
    const seen = watchWheel();
    render(<ScrollPage popup={{ style: { maxHeight: 40, overflowY: "auto" } }} />);
    await openAt(100, 100);
    const over = centre(popup());
    await act(async () => {
      await wheel(over.x, over.y, 0, 30);
    });
    expect(seen.prevented).toBe(false);
    await expect.poll(() => popup().scrollTop).toBeGreaterThan(0);
    expect(isOpen()).toBe(true);
    expect(window.scrollY).toBe(0);
  });
});

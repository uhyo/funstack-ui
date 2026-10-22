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
import { mouse, toPagePoint } from "../__tests__/browser-commands.js";
import { user } from "../__tests__/browser-user.js";
import { browserName, supportsFocusVisibleOption } from "../__tests__/engine.js";
import { Popover } from "../popover/index.js";
import { Menu } from "./index.js";
import type {
  MenuContextTriggerProps,
  MenuOpenChangeDetails,
  MenuPopupProps,
  MenuRootProps,
} from "./index.js";

type OpenAction = (next: boolean, details: MenuOpenChangeDetails) => unknown;

const region = () => screen.getByTestId("region");
const popup = () => screen.getByTestId("popup");
const item = (id: string) => screen.getByTestId(id);
const isOpen = (element: Element = popup()) => element.matches(":popover-open");
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Lets queued `toggle` tasks and React's follow-up work run. */
const flush = () =>
  act(async () => {
    await sleep(20);
  });

const cleanups: (() => void)[] = [];

function addStyle(css: string): () => void {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  return () => style.remove();
}

/** The last `contextmenu` the page saw: its point, and whether the library prevented it. */
let lastMenu: { x: number; y: number; prevented: boolean } | null = null;

beforeEach(() => {
  lastMenu = null;
  const suppress = (event: MouseEvent) => {
    lastMenu = { x: event.clientX, y: event.clientY, prevented: event.defaultPrevented };
    event.preventDefault();
  };
  window.addEventListener("contextmenu", suppress);
  cleanups.push(() => window.removeEventListener("contextmenu", suppress));
  cleanups.push(
    addStyle(`
      [data-testid="popup"] { margin: 0; padding: 4px; border: 1px solid; width: 120px; box-sizing: border-box; }
      [role="menu"] [role^="menuitem"] { display: block; width: 100%; height: 24px; text-align: start; }
    `),
  );
});

afterEach(() => {
  for (const element of document.querySelectorAll<HTMLElement>("[popover]")) {
    if (element.matches(":popover-open")) element.hidePopover();
  }
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.restoreAllMocks();
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
  await flush();
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

  it("survives the pending pointerup: press, menu opens, move 60 px away, release", async () => {
    render(<Harness />);
    const { width, height } = viewport();
    const x = Math.round(width / 3);
    const y = Math.round(height / 3);
    await act(async () => {
      await mouse.down(x, y, "right");
    });
    await expect.poll(() => isOpen()).toBe(true);
    await flush();
    await act(async () => {
      await mouse.move(x + 60, y - 60);
      await mouse.up(x + 60, y - 60, "right");
    });
    await flush();
    await flush();
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
    await flush();
    const r = rect();
    // Flipped up-left: the pointer is not over the menu.
    expect(Math.abs(r.right - lastMenu!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.bottom - lastMenu!.y)).toBeLessThanOrEqual(1);
    await act(async () => {
      await mouse.up(x, y, "right");
    });
    await flush();
    await flush();
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
    await flush();

    await openAt(100, height - 80);
    r = rect();
    expect(Math.abs(r.left - lastMenu!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.bottom - lastMenu!.y)).toBeLessThanOrEqual(1);
    await act(async () => popup().hidePopover());
    await flush();

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
    await flush();
    expect(item("grid")).toHaveAttribute("aria-checked", "true");
    expect(isOpen()).toBe(true);
    await openAt(240, 220);
    expectTopLeftAtPoint();
    expect(item("grid")).toHaveAttribute("aria-checked", "true");
    expect(item("rename")).toHaveFocus();
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
    await flush();
    expect(action.mock.calls.at(-1)![0]).toBe(false);
    expect(action.mock.calls.at(-1)![1].reason).toBe("dismiss");

    await openAt(100, 100);
    await act(async () => {
      await mouse.click(outside.left + 20, outside.top + 20, "middle");
    });
    await expect.poll(() => isOpen()).toBe(false);
    await flush();
    expect(action.mock.calls.at(-1)![1].reason).toBe("dismiss");
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
    await flush();
    await flush();
    expect(lastMenu!.prevented).toBe(true);
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
    await flush();
    expect(action.mock.calls.at(-1)![1].reason).toBe("dismiss");
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
      await flush();
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
    await flush();
    expect(isOpen()).toBe(false);
    expect(document.activeElement).toBe(document.body);
  });

  it("with a Menu.Trigger in the Root: Escape focuses the Trigger", async () => {
    render(<Harness withTrigger />);
    await openAt(200, 150);
    await user.keyboard("{Escape}");
    await flush();
    expect(isOpen()).toBe(false);
    expect(item("trigger")).toHaveFocus();
  });

  it('a tabindex="0" region: Escape returns focus to it', async () => {
    render(<Harness region={{ tabIndex: 0 }} />);
    await openAt(200, 150);
    expect(item("rename")).toHaveFocus();
    await user.keyboard("{Escape}");
    await flush();
    expect(region()).toHaveFocus();
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
    await flush();
    await expect.poll(() => isOpen(item("panel"))).toBe(true);
    await openAt(120, 100);
    expect(isOpen(item("panel"))).toBe(true);
    await user.keyboard("{Escape}");
    await flush();
    expect(isOpen()).toBe(false);
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
    await flush();
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
      // updates are in this scope.
      await sleep(600);
    });
    await expect.poll(() => isOpen()).toBe(true);
    await flush();
    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0]![1].event!.type).toBe("pointerdown");
    expectTopLeftAt(150, 120);
    await act(async () => {
      region().dispatchEvent(new PointerEvent("pointerup", { ...init, buttons: 0 }));
    });
    await flush();
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
      await flush();
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
    await flush();
    await flush();
    expect(lastMenu).not.toBeNull();
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
        ::view-transition-old(.pop) { animation: 100ms ease-in both vt-cm-out; }
        ::view-transition-new(.pop) { animation: 100ms ease-out both vt-cm-in; }
        @keyframes vt-cm-out { to { opacity: 0; } }
        @keyframes vt-cm-in { from { opacity: 0; } }
      `),
    );
  });

  afterEach(async () => {
    (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT = actEnvironment;
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
    await sleep(50);
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
    await sleep(50);
    expect(calls).toHaveLength(0);
  });
});

describe("exit animation (browser)", () => {
  it("after the outside right-click close the items stay while the CSS exit runs; none in Firefox", async () => {
    cleanups.push(
      addStyle(`
        .held-exit {
          opacity: 0;
          transition: opacity 60s, display 60s allow-discrete, overlay 60s allow-discrete;
        }
        .held-exit:popover-open { opacity: 1; transition-duration: 0s; }
      `),
    );
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

/** The popup's top-left equals (x, y). */
function expectTopLeftAt(x: number, y: number) {
  const r = rect();
  expect(Math.abs(r.left - x)).toBeLessThanOrEqual(1);
  expect(Math.abs(r.top - y)).toBeLessThanOrEqual(1);
}

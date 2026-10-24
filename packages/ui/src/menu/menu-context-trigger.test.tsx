// Menu.ContextTrigger tests (jsdom), mapped to design/components/context-menu.md section 13.1.
// The Popover shim (src/__tests__/popover-shim.ts) provides the popover half (coalesced `toggle`,
// the recorded `source`); a no-op `setPointerCapture` below is what the rows spy on. `contextmenu` is
// dispatched as a real `PointerEvent` (jsdom implements `pointerId` / `pointerType`).
//
// Not testable here, covered by `menu-context-trigger.browser.test.tsx`: real right-clicks, the
// pending `pointerup` light dismiss in Firefox / WebKit, the placement and its flips, the
// remembered position option, keyboard `contextmenu`, platform focus return.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { Suspense, startTransition, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { popoverSource } from "../__tests__/popover-shim.js";
import {
  createSuspender,
  deferred,
  ErrorCatcher,
  expectNotPending,
  expectPending,
  setupUser,
} from "../__tests__/helpers.js";
import { stubComputedPlacement } from "../__tests__/placement-stub.js";
import { CSPProvider } from "../csp/index.js";
import { Menu } from "./index.js";
import type {
  MenuContextTriggerProps,
  MenuContextTriggerState,
  MenuOpenChangeDetails,
  MenuPopupProps,
  MenuPopupState,
  MenuRootProps,
  MenuRootState,
} from "./index.js";
import { MENU_POINT_FALLBACKS, MENU_POINT_RULES } from "./menu-point.js";

type OpenAction = (next: boolean, details: MenuOpenChangeDetails) => unknown;

// jsdom has no pointer capture: a no-op the rows spy on (the Slider and NumberField suites install
// their own tracking stubs, so the shim does not).
if (typeof Element.prototype.setPointerCapture !== "function") {
  Object.assign(Element.prototype, {
    setPointerCapture() {},
    releasePointerCapture() {},
    hasPointerCapture: () => false,
  });
}

// jsdom's `focus()` ignores `focusVisible`; read it, so that the library takes the quiet-focus
// path for pointer opens (`focus({ focusVisible: false })`) as the engines do. Installed before
// any open: the library detects the option once.
const nativeFocus = HTMLElement.prototype.focus;
HTMLElement.prototype.focus = function (this: HTMLElement, options?: FocusOptions) {
  void (options as { focusVisible?: boolean } | undefined)?.focusVisible;
  nativeFocus.call(this, options);
};

interface HarnessProps {
  root?: Partial<MenuRootProps>;
  region?: Partial<MenuContextTriggerProps>;
  popup?: Partial<MenuPopupProps>;
  /** Render a `Menu.Trigger` inside the region (the dual-trigger Root). */
  withTrigger?: boolean;
  /** Extra content inside the region. */
  inside?: ReactNode;
  content?: ReactNode;
  boundary?: (error: unknown) => void;
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

function Harness({ root, region, popup, withTrigger, inside, content, boundary }: HarnessProps) {
  let menu: ReactNode = (
    <Menu.Root {...root}>
      <Menu.ContextTrigger data-testid="region" {...region}>
        <span data-testid="label">report.pdf</span>
        <button type="button" data-testid="inner">
          Inner
        </button>
        {withTrigger && <Menu.Trigger data-testid="trigger">More</Menu.Trigger>}
        {inside}
      </Menu.ContextTrigger>
      <Menu.Popup data-testid="popup" aria-label="File actions" {...popup}>
        {content ?? <Items />}
      </Menu.Popup>
    </Menu.Root>
  );
  if (boundary) menu = <ErrorCatcher onError={boundary}>{menu}</ErrorCatcher>;
  return (
    <>
      <button type="button" data-testid="elsewhere">
        Elsewhere
      </button>
      {menu}
    </>
  );
}

const region = () => screen.getByTestId("region");
const popup = () => screen.getByTestId("popup");
const item = (id: string) => screen.getByTestId(id);
const isOpen = (element: Element = popup()) => element.matches(":popover-open");

/** Runs the tasks the shim queued (`toggle`) and React's work after them. */
const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

function silenceErrors() {
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

/** A `PointerEvent` of `type`, bubbling and cancelable, a right-button press by default. */
function pointerEvent(type: string, init: PointerEventInit = {}): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: 312,
    clientY: 148,
    button: type === "contextmenu" || type === "pointerdown" ? 2 : 0,
    buttons: type === "contextmenu" || type === "pointerdown" ? 2 : 0,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
    ...init,
  });
}

/** Dispatches `event` at `target` inside `act` (the open's transition commits before it returns). */
async function dispatch(target: Element, event: Event): Promise<Event> {
  await act(async () => {
    target.dispatchEvent(event);
  });
  return event;
}

/** A right-click at (x, y) on `target`: `pointerdown`, then `contextmenu` (Linux / macOS order). */
async function rightClick(target: Element, x = 312, y = 148, init: PointerEventInit = {}) {
  await dispatch(target, pointerEvent("pointerdown", { clientX: x, clientY: y, ...init }));
  const event = await dispatch(
    target,
    pointerEvent("contextmenu", { clientX: x, clientY: y, ...init }),
  );
  await flush();
  return event;
}

/**
 * Records, for every `showPopover()` call, the popup, the element carrying `autofocus` at that
 * moment (the keyboard path) and the `source`.
 */
function watchShow() {
  const calls: { popup: HTMLElement; autofocus: Element | null; source: unknown }[] = [];
  const original = HTMLElement.prototype.showPopover;
  vi.spyOn(HTMLElement.prototype, "showPopover").mockImplementation(function (
    this: HTMLElement,
    options?: ShowPopoverOptions,
  ) {
    const autofocus = this.hasAttribute("autofocus") ? this : this.querySelector("[autofocus]");
    calls.push({ popup: this, autofocus, source: options?.source });
    return original.call(this, options);
  });
  return calls;
}

/**
 * Calls of `focus({ focusVisible: false })` (the quiet path), by element. The library's one-time
 * probe for the option focuses a detached `<div>` the first time a test opens with a pointer; it
 * is not a focus move, so detached elements are left out (#101, T15: the row that ran first in a
 * shuffled order saw the probe).
 */
function watchQuietFocus() {
  const quiet: Element[] = [];
  const original = HTMLElement.prototype.focus;
  vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (
    this: HTMLElement,
    options?: FocusOptions,
  ) {
    if (
      this.isConnected &&
      (options as { focusVisible?: boolean } | undefined)?.focusVisible === false
    ) {
      quiet.push(this);
    }
    original.call(this, options);
  });
  return quiet;
}

function pointStyle(element: HTMLElement) {
  const s = element.style;
  return {
    x: s.getPropertyValue("--menu-point-x"),
    y: s.getPropertyValue("--menu-point-y"),
    left: s.getPropertyValue("left"),
    top: s.getPropertyValue("top"),
    right: s.getPropertyValue("right"),
    bottom: s.getPropertyValue("bottom"),
    positionArea: s.getPropertyValue("position-area"),
    fallbacks: s.getPropertyValue("position-try-fallbacks"),
  };
}

const rulesInHead = (doc: Document = document) =>
  Array.from(doc.head.querySelectorAll("style")).filter((style) =>
    (style.textContent ?? "").includes("@position-try --fsui-menu-up"),
  );

/**
 * Renders `ui` into a new document. React records a hoisted `<style>` per document and never
 * removes it, so rows about the hoisted style start from a document that has none.
 */
function renderFresh(ui: ReactNode) {
  const doc = document.implementation.createHTMLDocument("");
  // A created document has no window; the library reads computed styles and frames through
  // `defaultView`, and user-event needs one. Lend it the test window (same prototypes, so the
  // Popover shim applies).
  Object.defineProperty(doc, "defaultView", { value: window });
  const container = doc.createElement("div");
  doc.body.append(container);
  render(ui, { container });
  const regionIn = container.querySelector<HTMLElement>('[data-testid="region"]')!;
  const styles = () => doc.head.querySelectorAll('style[data-href="@funstack/ui/menu-point"]');
  return { doc, container, regionIn, styles, inside: within(container) };
}

afterEach(() => {
  vi.useRealTimers();
  // Restored here as well as in the setup file (which runs after this hook): the loop below
  // must reach the real `hidePopover`, not a test's spy.
  vi.restoreAllMocks();
  for (const element of document.querySelectorAll("[popover]")) {
    if (element.matches(":popover-open")) (element as HTMLElement).hidePopover();
  }
  document.body.innerHTML = "";
});

describe("Menu.ContextTrigger", () => {
  describe("roles and ARIA", () => {
    it("renders a plain div with no role, no ARIA and no data-* while closed", () => {
      render(<Harness />);
      const r = region();
      expect(r.tagName).toBe("DIV");
      const names = Array.from(r.attributes, (a) => a.name);
      expect(names.filter((n) => n === "role" || n.startsWith("aria-"))).toEqual([]);
      expect(r).not.toHaveAttribute("tabindex");
      expect(r).not.toHaveAttribute("id");
      expect(r).not.toHaveAttribute("data-open");
      expect(r).not.toHaveAttribute("data-pending");
      expect(r).not.toHaveAttribute("data-disabled");
    });

    it("renders inline -webkit-touch-callout: none (server HTML)", () => {
      const html = renderToString(
        <Menu.Root>
          <Menu.ContextTrigger>row</Menu.ContextTrigger>
          <Menu.Popup aria-label="Row" />
        </Menu.Root>,
      );
      expect(html).toMatch(/<div style="-webkit-touch-callout:none"/);
    });

    it("render={<tr />} keeps the row; the Popup keeps role=menu, a dangling aria-labelledby and aria-label", async () => {
      render(
        <table>
          <tbody>
            <Menu.Root>
              <Menu.ContextTrigger data-testid="region" render={<tr />}>
                <td>report.pdf</td>
              </Menu.ContextTrigger>
            </Menu.Root>
          </tbody>
        </table>,
      );
      expect(region().tagName).toBe("TR");
      expect(region()).not.toHaveAttribute("role");
      render(<Harness />);
      const p = popup();
      expect(p).toHaveAttribute("role", "menu");
      expect(p).toHaveAttribute("aria-label", "File actions");
      const labelledBy = p.getAttribute("aria-labelledby")!;
      expect(labelledBy).toBe(`${p.id}-trigger`);
      expect(document.getElementById(labelledBy)).toBeNull();
    });

    it("data-context on a context open, absent on a Trigger open; state.context and state.side", async () => {
      const user = setupUser();
      const seen: { root?: MenuRootState; popup?: MenuPopupState } = {};
      render(
        <Menu.Root>
          {(s: MenuRootState) => {
            seen.root = s;
            return (
              <>
                <Menu.ContextTrigger data-testid="region">
                  <Menu.Trigger data-testid="trigger">More</Menu.Trigger>
                </Menu.ContextTrigger>
                <Menu.Popup
                  data-testid="popup"
                  className={(p: MenuPopupState) => {
                    seen.popup = p;
                    return "menu";
                  }}
                >
                  <Items />
                </Menu.Popup>
              </>
            );
          }}
        </Menu.Root>,
      );
      expect(seen.root!.context).toBe(false);
      expect(seen.popup!.context).toBe(false);
      await rightClick(region());
      expect(isOpen()).toBe(true);
      expect(popup()).toHaveAttribute("data-context", "");
      expect(popup()).not.toHaveAttribute("data-side");
      expect(popup()).not.toHaveAttribute("data-align");
      expect(seen.root).toEqual({ open: true, pending: false, submenu: false, context: true });
      expect(seen.popup).toMatchObject({ open: true, side: null, context: true });
      // Close, then open from the Trigger: anchored.
      await act(async () => popup().hidePopover());
      await flush();
      expect(seen.root!.context).toBe(false);
      await user.click(screen.getByTestId("trigger"));
      await flush();
      expect(isOpen()).toBe(true);
      expect(popup()).not.toHaveAttribute("data-context");
      expect(popup()).toHaveAttribute("data-side", "bottom");
      expect(seen.root!.context).toBe(false);
      expect(seen.popup).toMatchObject({ side: "bottom", context: false });
    });
  });

  describe("opening", () => {
    it("a contextmenu opens at the point: openChangeAction once, prevented, source, inline placement", async () => {
      const action = vi.fn<OpenAction>();
      const calls = watchShow();
      render(<Harness root={{ openChangeAction: action }} />);
      expect(popup().children).toHaveLength(0);
      const event = await rightClick(screen.getByTestId("label"), 312, 148);
      expect(event.defaultPrevented).toBe(true);
      expect(action).toHaveBeenCalledTimes(1);
      const [next, details] = action.mock.calls[0]!;
      expect(next).toBe(true);
      expect(details.reason).toBe("activate");
      expect(details.event).toBe(event);
      expect(isOpen()).toBe(true);
      expect(calls).toHaveLength(1);
      expect(calls[0]!.source).toBe(region());
      expect(popoverSource(popup())).toBe(region());
      expect(pointStyle(popup())).toEqual({
        x: "312px",
        y: "148px",
        left: "var(--menu-point-x)",
        top: "calc(var(--menu-point-y) + var(--menu-point-gap))",
        right: "auto",
        bottom: "auto",
        positionArea: "none",
        fallbacks: MENU_POINT_FALLBACKS.ltr.mouse[1],
      });
      expect(popup()).not.toHaveAttribute("data-side");
      expect(item("rename")).toBeInTheDocument();
      expect(region()).toHaveAttribute("data-open", "");
    });

    it("the open is a transition: data-pending on the region while openChangeAction runs", async () => {
      const work = deferred();
      render(<Harness root={{ openChangeAction: () => work.promise }} />);
      await rightClick(region());
      expect(region()).toHaveAttribute("data-open", "");
      expectPending(region());
      expect(isOpen()).toBe(false);
      await act(async () => work.resolve());
      await flush();
      expect(isOpen()).toBe(true);
      expectNotPending(region());
    });
  });

  describe("modality", () => {
    it("button -1 (Chromium keyboard): the first item gets autofocus (ring)", async () => {
      const calls = watchShow();
      const quiet = watchQuietFocus();
      render(<Harness />);
      await dispatch(region(), pointerEvent("contextmenu", { button: -1, buttons: 0 }));
      await flush();
      expect(calls[0]!.autofocus).toBe(item("rename"));
      expect(quiet).toEqual([]);
      expect(document.activeElement).toBe(item("rename"));
    });

    it("pointerdown then contextmenu: quiet focus on the first item", async () => {
      const calls = watchShow();
      const quiet = watchQuietFocus();
      render(<Harness />);
      await rightClick(region());
      expect(calls[0]!.autofocus).toBeNull();
      expect(quiet).toEqual([item("rename")]);
      expect(document.activeElement).toBe(item("rename"));
    });

    it("keydown on a focused child, then contextmenu with button 0 (Gecko keyboard): ring", async () => {
      const calls = watchShow();
      render(<Harness />);
      // A pointer press earlier must not count once a key came after it.
      await dispatch(region(), pointerEvent("pointerdown", { button: 0, buttons: 1 }));
      const inner = screen.getByTestId("inner");
      act(() => inner.focus());
      fireEvent.keyDown(inner, { key: "F10", shiftKey: true });
      await dispatch(inner, pointerEvent("contextmenu", { button: 0, buttons: 0 }));
      await flush();
      expect(calls[0]!.autofocus).toBe(item("rename"));
    });

    it("a pointerdown a descendant stops still counts (capture phase, review L2)", async () => {
      const quiet = watchQuietFocus();
      render(
        <Harness
          inside={<span data-testid="handle" onPointerDown={(e) => e.stopPropagation()} />}
        />,
      );
      const handle = screen.getByTestId("handle");
      fireEvent.keyDown(handle, { key: "a" });
      await rightClick(handle);
      expect(quiet).toEqual([item("rename")]);
    });

    it("neither signal (a script, VoiceOver): a pointer open (quiet)", async () => {
      const quiet = watchQuietFocus();
      render(<Harness />);
      await dispatch(region(), pointerEvent("contextmenu", { button: 0, buttons: 0 }));
      await flush();
      expect(quiet).toEqual([item("rename")]);
    });
  });

  describe("pointer capture", () => {
    it("is taken on the popup synchronously in the contextmenu dispatch, before showPopover", async () => {
      const order: string[] = [];
      const capture = vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(function (
        this: Element,
      ) {
        order.push(`capture:${this === popup() ? "popup" : "other"}`);
      });
      const original = HTMLElement.prototype.showPopover;
      vi.spyOn(HTMLElement.prototype, "showPopover").mockImplementation(function (
        this: HTMLElement,
        options?: ShowPopoverOptions,
      ) {
        order.push("show");
        return original.call(this, options);
      });
      render(<Harness />);
      let capturedDuringDispatch = false;
      // Registered after React's root listener: runs after the region's handler.
      document.addEventListener(
        "contextmenu",
        () => {
          capturedDuringDispatch = capture.mock.calls.length > 0;
        },
        { once: true },
      );
      await rightClick(region(), 10, 10, { pointerId: 7 });
      expect(capturedDuringDispatch).toBe(true);
      expect(capture).toHaveBeenCalledWith(7);
      expect(order).toEqual(["capture:popup", "show"]);
    });

    it("is not taken when no button is down (Windows, keyboard)", async () => {
      const capture = vi.spyOn(Element.prototype, "setPointerCapture");
      render(<Harness />);
      await dispatch(region(), pointerEvent("contextmenu", { buttons: 0 }));
      await flush();
      expect(isOpen()).toBe(true);
      expect(capture).not.toHaveBeenCalled();
    });

    it("a throwing setPointerCapture is swallowed", async () => {
      vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {
        throw new DOMException("No active pointer", "NotFoundError");
      });
      render(<Harness />);
      await rightClick(region());
      expect(isOpen()).toBe(true);
    });
  });

  describe("defaultPrevented and nesting", () => {
    it("an already-prevented contextmenu opens nothing", async () => {
      const action = vi.fn<OpenAction>();
      render(
        <Harness
          root={{ openChangeAction: action }}
          inside={<span data-testid="own" onContextMenu={(e) => e.preventDefault()} />}
        />,
      );
      await rightClick(screen.getByTestId("own"));
      expect(action).not.toHaveBeenCalled();
      expect(isOpen()).toBe(false);
    });

    function Nested({ innerDisabled = false }: { innerDisabled?: boolean }) {
      return (
        <Menu.Root>
          <Menu.ContextTrigger data-testid="outer">
            <Menu.Root>
              <Menu.ContextTrigger data-testid="inner-region" disabled={innerDisabled}>
                <span data-testid="target">x</span>
              </Menu.ContextTrigger>
              <Menu.Popup data-testid="inner-popup" aria-label="Inner">
                <Menu.Item>Inner item</Menu.Item>
              </Menu.Popup>
            </Menu.Root>
          </Menu.ContextTrigger>
          <Menu.Popup data-testid="outer-popup" aria-label="Outer">
            <Menu.Item>Outer item</Menu.Item>
          </Menu.Popup>
        </Menu.Root>
      );
    }

    it("nested regions: the inner one opens, the outer one does not", async () => {
      const error = vi.spyOn(console, "error");
      render(<Nested />);
      await flush();
      // A Root inside a region is the nested region's own menu, not a misplaced submenu.
      expect(error).not.toHaveBeenCalledWith(expect.stringContaining("outside its Menu.Popup"));
      await rightClick(screen.getByTestId("target"));
      expect(isOpen(screen.getByTestId("inner-popup"))).toBe(true);
      expect(isOpen(screen.getByTestId("outer-popup"))).toBe(false);
      expect(screen.getByTestId("outer")).not.toHaveAttribute("data-open");
    });

    it("a disabled inner region lets the outer one open", async () => {
      render(<Nested innerDisabled />);
      expect(screen.getByTestId("inner-region")).toHaveAttribute("data-disabled", "");
      await rightClick(screen.getByTestId("target"));
      expect(isOpen(screen.getByTestId("inner-popup"))).toBe(false);
      expect(isOpen(screen.getByTestId("outer-popup"))).toBe(true);
      expect(popoverSource(screen.getByTestId("outer-popup"))).toBe(screen.getByTestId("outer"));
    });

    it("a consumer onContextMenu calling preventDefault keeps both regions closed", async () => {
      render(
        <Menu.Root>
          <Menu.ContextTrigger data-testid="outer">
            <Menu.Root>
              <Menu.ContextTrigger>
                <canvas data-testid="canvas" onContextMenu={(e) => e.preventDefault()} />
              </Menu.ContextTrigger>
              <Menu.Popup data-testid="inner-popup" aria-label="Inner" />
            </Menu.Root>
          </Menu.ContextTrigger>
          <Menu.Popup data-testid="outer-popup" aria-label="Outer" />
        </Menu.Root>,
      );
      await rightClick(screen.getByTestId("canvas"));
      expect(isOpen(screen.getByTestId("inner-popup"))).toBe(false);
      expect(isOpen(screen.getByTestId("outer-popup"))).toBe(false);
    });
  });

  describe("a Popup inside the region (a table row's cell)", () => {
    function Row() {
      return (
        <table>
          <tbody>
            <Menu.Root>
              <Menu.ContextTrigger data-testid="region" render={<tr />}>
                <td data-testid="label">report.pdf</td>
                <td>
                  <Menu.Popup data-testid="popup" aria-label="File actions">
                    <Items />
                  </Menu.Popup>
                </td>
              </Menu.ContextTrigger>
            </Menu.Root>
          </tbody>
        </table>
      );
    }

    it("a right-click inside the popup is neither a move nor an outer open", async () => {
      render(<Row />);
      await rightClick(screen.getByTestId("label"), 100, 100);
      expect(isOpen()).toBe(true);
      const event = await rightClick(item("archive"), 300, 250);
      expect(event.defaultPrevented).toBe(true);
      expect(pointStyle(popup()).x).toBe("100px");
      // A right-click elsewhere in the row still moves.
      await rightClick(screen.getByTestId("label"), 40, 50);
      expect(pointStyle(popup()).x).toBe("40px");
    });

    it("a long-press inside the popup starts no timer", async () => {
      render(<Row />);
      await rightClick(screen.getByTestId("label"), 100, 100);
      vi.useFakeTimers();
      act(() => {
        item("archive").dispatchEvent(
          pointerEvent("pointerdown", { pointerType: "touch", button: 0, buttons: 1, clientX: 5 }),
        );
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });
      expect(pointStyle(popup()).x).toBe("100px");
      expect(isOpen()).toBe(true);
    });
  });

  describe("editable targets", () => {
    const editable: [string, ReactNode][] = [
      ["input type=text", <input key="i" data-testid="target" />],
      ["textarea", <textarea key="t" data-testid="target" />],
      ["contenteditable", <div key="c" data-testid="target" contentEditable />],
      [
        "a child of contenteditable",
        <div key="cc" contentEditable suppressContentEditableWarning>
          <b data-testid="target">bold</b>
        </div>,
      ],
    ];

    it.each(editable)("%s: nothing opens and the event is not prevented", async (_, node) => {
      render(<Harness inside={node} />);
      const event = await rightClick(screen.getByTestId("target"));
      expect(event.defaultPrevented).toBe(false);
      expect(isOpen()).toBe(false);
    });

    it.each(editable)('%s with editableTargets="menu": opens', async (_, node) => {
      render(<Harness inside={node} region={{ editableTargets: "menu" }} />);
      const event = await rightClick(screen.getByTestId("target"));
      expect(event.defaultPrevented).toBe(true);
      expect(isOpen()).toBe(true);
    });

    it.each(["checkbox", "button"])("input type=%s opens by default", async (type) => {
      render(<Harness inside={<input data-testid="target" type={type} />} />);
      await rightClick(screen.getByTestId("target"));
      expect(isOpen()).toBe(true);
    });
  });

  describe("long-press", () => {
    async function advance(ms: number) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
      });
    }

    function press(target: Element, init: PointerEventInit = {}) {
      act(() => {
        target.dispatchEvent(
          pointerEvent("pointerdown", {
            pointerType: "touch",
            button: 0,
            buttons: 1,
            pointerId: 5,
            clientX: 100,
            clientY: 120,
            ...init,
          }),
        );
      });
    }

    it.each(["touch", "pen"])(
      "%s held 500 ms opens at the touch point with the pointerdown as details.event",
      async (pointerType) => {
        vi.useFakeTimers();
        const action = vi.fn<OpenAction>();
        const quiet = watchQuietFocus();
        const capture = vi.spyOn(Element.prototype, "setPointerCapture");
        render(<Harness root={{ openChangeAction: action }} />);
        press(region(), { pointerType });
        await advance(499);
        expect(action).not.toHaveBeenCalled();
        await advance(1);
        await advance(10);
        expect(action).toHaveBeenCalledTimes(1);
        const details = action.mock.calls[0]![1];
        expect(details.event!.type).toBe("pointerdown");
        expect((details.event as PointerEvent).pointerType).toBe(pointerType);
        expect(isOpen()).toBe(true);
        expect(pointStyle(popup()).x).toBe("100px");
        expect(pointStyle(popup()).y).toBe("120px");
        expect(quiet).toEqual([item("rename")]);
        expect(capture).toHaveBeenCalledWith(5);
      },
    );

    it("longPressDelay={300}", async () => {
      vi.useFakeTimers();
      render(<Harness region={{ longPressDelay: 300 }} />);
      press(region());
      await advance(310);
      expect(isOpen()).toBe(true);
    });

    const cancellers: [string, (target: Element) => void][] = [
      ["pointerup", (t) => t.dispatchEvent(pointerEvent("pointerup", { pointerId: 5 }))],
      ["pointercancel", (t) => t.dispatchEvent(pointerEvent("pointercancel", { pointerId: 5 }))],
      [
        "a pointermove 11 px away",
        (t) =>
          t.dispatchEvent(
            pointerEvent("pointermove", { pointerId: 5, clientX: 111, clientY: 120 }),
          ),
      ],
      [
        "a second pointerdown",
        (t) =>
          t.dispatchEvent(
            pointerEvent("pointerdown", { pointerType: "touch", pointerId: 6, isPrimary: false }),
          ),
      ],
    ];

    it.each(cancellers)("cancelled by %s", async (_, cancel) => {
      vi.useFakeTimers();
      const action = vi.fn<OpenAction>();
      render(<Harness root={{ openChangeAction: action }} />);
      press(region());
      await advance(200);
      act(() => cancel(region()));
      await advance(600);
      expect(action).not.toHaveBeenCalled();
      expect(isOpen()).toBe(false);
    });

    it("a pointermove 9 px away does not cancel", async () => {
      vi.useFakeTimers();
      render(<Harness />);
      press(region());
      act(() => {
        region().dispatchEvent(
          pointerEvent("pointermove", { pointerId: 5, clientX: 109, clientY: 120 }),
        );
      });
      await advance(510);
      expect(isOpen()).toBe(true);
    });

    it("a contextmenu during the gesture (Android) opens once and cancels the timer", async () => {
      vi.useFakeTimers();
      const action = vi.fn<OpenAction>();
      render(<Harness root={{ openChangeAction: action }} />);
      press(region());
      await advance(400);
      act(() => {
        region().dispatchEvent(
          pointerEvent("contextmenu", { pointerType: "touch", pointerId: 5, button: 0 }),
        );
      });
      await advance(600);
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]![1].event!.type).toBe("contextmenu");
      expect(isOpen()).toBe(true);
    });

    it("a mouse pointerdown starts no timer; a disabled region none", async () => {
      vi.useFakeTimers();
      const action = vi.fn<OpenAction>();
      const { rerender } = render(<Harness root={{ openChangeAction: action }} />);
      press(region(), { pointerType: "mouse" });
      await advance(600);
      expect(action).not.toHaveBeenCalled();
      rerender(<Harness root={{ openChangeAction: action }} region={{ disabled: true }} />);
      press(region());
      await advance(600);
      expect(action).not.toHaveBeenCalled();
    });

    it("the next click after a long-press open is swallowed, the one after is not", async () => {
      vi.useFakeTimers();
      render(<Harness />);
      press(region());
      await advance(510);
      expect(isOpen()).toBe(true);
      const first = new MouseEvent("click", { bubbles: true, cancelable: true });
      item("rename").dispatchEvent(first);
      expect(first.defaultPrevented).toBe(true);
      const second = new MouseEvent("click", { bubbles: true, cancelable: true });
      screen.getByTestId("elsewhere").dispatchEvent(second);
      expect(second.defaultPrevented).toBe(false);
    });

    it("a pointerdown disarms the swallow", async () => {
      vi.useFakeTimers();
      render(<Harness />);
      press(region());
      await advance(510);
      act(() => {
        item("rename").dispatchEvent(pointerEvent("pointerdown", { button: 0, buttons: 1 }));
      });
      const click = new MouseEvent("click", { bubbles: true, cancelable: true });
      screen.getByTestId("elsewhere").dispatchEvent(click);
      expect(click.defaultPrevented).toBe(false);
    });

    it("a long-press on an editable target does nothing by default", async () => {
      vi.useFakeTimers();
      render(<Harness inside={<textarea data-testid="text" />} />);
      press(screen.getByTestId("text"));
      await advance(600);
      expect(isOpen()).toBe(false);
    });

    describe("the click swallow is scoped to the release (review H1)", () => {
      function withAction() {
        const activate = vi.fn();
        render(
          <Harness
            content={
              <>
                <Menu.Item data-testid="rename" action={activate} closeOnActivate={false}>
                  Rename
                </Menu.Item>
                <Menu.Item data-testid="archive">Archive</Menu.Item>
              </>
            }
          />,
        );
        return activate;
      }

      /** Enter on an item: its `keydown` handler activates through `element.click()`. */
      function pressEnter(target: HTMLElement) {
        act(() => {
          fireEvent.keyDown(target, { key: "Enter" });
        });
      }

      const release = () =>
        act(() => {
          popup().dispatchEvent(pointerEvent("pointerup", { pointerId: 5, pointerType: "touch" }));
        });

      it("long-press open + pointerup + Enter gives 1 activation", async () => {
        vi.useFakeTimers();
        const activate = withAction();
        press(region());
        await advance(510);
        expect(isOpen()).toBe(true);
        release();
        await advance(1);
        pressEnter(item("rename"));
        await advance(10);
        expect(activate).toHaveBeenCalledTimes(1);
      });

      it("no release at all (iOS: no click after a long-press): Enter on an item activates", async () => {
        vi.useFakeTimers();
        const activate = withAction();
        press(region());
        await advance(510);
        pressEnter(item("rename"));
        await advance(10);
        expect(activate).toHaveBeenCalledTimes(1);
      });

      it("a bare click (no keydown) after the release task activates", async () => {
        vi.useFakeTimers();
        const activate = withAction();
        press(region());
        await advance(510);
        release();
        await advance(1);
        act(() => item("rename").click());
        await advance(10);
        expect(activate).toHaveBeenCalledTimes(1);
      });

      it("the click the release synthesises (same task) is swallowed; a release of another pointer does not count", async () => {
        vi.useFakeTimers();
        const activate = withAction();
        press(region());
        await advance(510);
        act(() => {
          popup().dispatchEvent(pointerEvent("pointerup", { pointerId: 9, pointerType: "touch" }));
        });
        await advance(1);
        release();
        const click = new MouseEvent("click", { bubbles: true, cancelable: true });
        act(() => {
          item("rename").dispatchEvent(click);
        });
        expect(click.defaultPrevented).toBe(true);
        await advance(10);
        expect(activate).not.toHaveBeenCalled();
      });

      it("a close disarms it: the next click anywhere is not swallowed", async () => {
        vi.useFakeTimers();
        withAction();
        press(region());
        await advance(510);
        expect(isOpen()).toBe(true);
        await act(async () => popup().hidePopover());
        await advance(10);
        expect(isOpen()).toBe(false);
        const click = new MouseEvent("click", { bubbles: true, cancelable: true });
        screen.getByTestId("elsewhere").dispatchEvent(click);
        expect(click.defaultPrevented).toBe(false);
      });
    });

    it("a long-press on an item of another menu inside the region does not open the region's menu (review M1)", async () => {
      const user = setupUser();
      const outerAction = vi.fn<OpenAction>();
      render(
        <Harness
          root={{ openChangeAction: outerAction }}
          inside={
            <Menu.Root>
              <Menu.Trigger data-testid="inner-trigger">Inner</Menu.Trigger>
              <Menu.Popup data-testid="inner-popup">
                <Menu.Item data-testid="inner-item">Inner item</Menu.Item>
              </Menu.Popup>
            </Menu.Root>
          }
        />,
      );
      await user.click(screen.getByTestId("inner-trigger"));
      await flush();
      expect(isOpen(screen.getByTestId("inner-popup"))).toBe(true);
      vi.useFakeTimers();
      press(item("inner-item"));
      await advance(600);
      expect(outerAction).not.toHaveBeenCalled();
      expect(isOpen()).toBe(false);
      expect(isOpen(screen.getByTestId("inner-popup"))).toBe(true);
    });
  });

  describe("move", () => {
    it("a second contextmenu while open moves the menu: no dispatch, new point, respelled fallbacks, re-show", async () => {
      const action = vi.fn<OpenAction>();
      render(<Harness root={{ openChangeAction: action }} />);
      await rightClick(region(), 100, 100);
      expect(isOpen()).toBe(true);
      const firstFallbacks = pointStyle(popup()).fallbacks;
      act(() => item("delete").focus());
      const calls = watchShow();
      const hide = vi.spyOn(HTMLElement.prototype, "hidePopover");
      const quiet = watchQuietFocus();
      const event = await rightClick(screen.getByTestId("label"), 300, 250);
      expect(event.defaultPrevented).toBe(true);
      expect(action).toHaveBeenCalledTimes(1);
      expect(isOpen()).toBe(true);
      const style = pointStyle(popup());
      expect(style.x).toBe("300px");
      expect(style.y).toBe("250px");
      expect(style.fallbacks).not.toBe(firstFallbacks);
      expect(hide).toHaveBeenCalledTimes(1);
      expect(calls).toHaveLength(1);
      expect(calls[0]!.source).toBe(region());
      expect(quiet).toEqual([item("rename")]);
      expect(document.activeElement).toBe(item("rename"));
      // The coalesced toggle notified nothing.
      await flush();
      expect(action).toHaveBeenCalledTimes(1);
    });

    it("a move keeps a pending item action running", async () => {
      const work = deferred();
      render(
        <Harness
          content={
            <>
              <Menu.Item data-testid="rename">Rename</Menu.Item>
              <Menu.Item data-testid="slow" action={() => work.promise}>
                Slow
              </Menu.Item>
            </>
          }
        />,
      );
      await rightClick(region(), 100, 100);
      fireEvent.click(item("slow"));
      await flush();
      expectPending(item("slow"));
      await rightClick(region(), 300, 250);
      expect(isOpen()).toBe(true);
      expect(pointStyle(popup()).x).toBe("300px");
      expectPending(item("slow"));
      await act(async () => work.resolve());
      await flush();
      expect(isOpen()).toBe(false);
    });

    it("a move during a pending open: one showPopover, at the latest point", async () => {
      const work = deferred();
      const calls = watchShow();
      const action = vi.fn<OpenAction>(() => work.promise);
      render(<Harness root={{ openChangeAction: action }} />);
      await rightClick(region(), 100, 100);
      await rightClick(region(), 300, 250);
      expect(action).toHaveBeenCalledTimes(1);
      expect(isOpen()).toBe(false);
      await act(async () => work.resolve());
      await flush();
      expect(isOpen()).toBe(true);
      expect(calls).toHaveLength(1);
      expect(pointStyle(popup()).x).toBe("300px");
    });
  });

  describe("outside close (every menu)", () => {
    const openers: [string, () => Promise<void>][] = [
      [
        "from the region",
        async () => {
          await rightClick(region());
        },
      ],
      [
        "from the Trigger",
        async () => {
          const user = setupUser();
          await user.click(screen.getByTestId("trigger"));
          await flush();
        },
      ],
    ];

    it.each(openers)(
      "opened %s: a contextmenu outside hides at once, then 'dismiss'",
      async (_, open) => {
        const action = vi.fn<OpenAction>();
        render(<Harness withTrigger root={{ openChangeAction: action }} />);
        await open();
        expect(isOpen()).toBe(true);
        const hide = vi.spyOn(HTMLElement.prototype, "hidePopover");
        act(() => {
          document.body.dispatchEvent(pointerEvent("contextmenu"));
        });
        expect(hide).toHaveBeenCalledTimes(1);
        expect(isOpen()).toBe(false);
        await flush();
        expect(action.mock.calls.at(-1)![0]).toBe(false);
        expect(action.mock.calls.at(-1)![1].reason).toBe("dismiss");
      },
    );

    it.each(openers)("opened %s: a middle-button pointerdown outside closes", async (_, open) => {
      const action = vi.fn<OpenAction>();
      render(<Harness withTrigger root={{ openChangeAction: action }} />);
      await open();
      act(() => {
        screen
          .getByTestId("elsewhere")
          .dispatchEvent(pointerEvent("pointerdown", { button: 1, buttons: 4 }));
      });
      expect(isOpen()).toBe(false);
      await flush();
      expect(action.mock.calls.at(-1)![1].reason).toBe("dismiss");
    });

    it("a left or right pointerdown outside is not the library's (left: light dismiss)", async () => {
      render(<Harness />);
      await rightClick(region());
      act(() => {
        screen.getByTestId("elsewhere").dispatchEvent(pointerEvent("pointerdown", { button: 0 }));
        screen.getByTestId("elsewhere").dispatchEvent(pointerEvent("pointerdown", { button: 2 }));
      });
      expect(isOpen()).toBe(true);
    });

    it("a contextmenu inside the popup is prevented and neither hides nor moves", async () => {
      render(<Harness />);
      await rightClick(region(), 100, 100);
      const hide = vi.spyOn(HTMLElement.prototype, "hidePopover");
      const event = await dispatch(
        item("archive"),
        pointerEvent("contextmenu", { clientX: 400, clientY: 400 }),
      );
      await flush();
      expect(event.defaultPrevented).toBe(true);
      expect(hide).not.toHaveBeenCalled();
      expect(isOpen()).toBe(true);
      expect(pointStyle(popup()).x).toBe("100px");
    });

    it("a contextmenu on an editable target inside the region closes (unmarked event)", async () => {
      render(<Harness inside={<textarea data-testid="text" />} />);
      await rightClick(region());
      const event = await dispatch(screen.getByTestId("text"), pointerEvent("contextmenu"));
      expect(event.defaultPrevented).toBe(false);
      expect(isOpen()).toBe(false);
    });

    it("a contextmenu stopped in a child never reaches the listener: stays open (documented)", async () => {
      render(
        <Harness inside={<span data-testid="stop" onContextMenu={(e) => e.stopPropagation()} />} />,
      );
      await rightClick(region());
      await dispatch(screen.getByTestId("stop"), pointerEvent("contextmenu"));
      expect(isOpen()).toBe(true);
    });

    it("the listeners are removed after close", async () => {
      render(<Harness />);
      await rightClick(region());
      await act(async () => popup().hidePopover());
      await flush();
      const hide = vi.spyOn(HTMLElement.prototype, "hidePopover");
      act(() => {
        document.body.dispatchEvent(pointerEvent("contextmenu"));
        document.body.dispatchEvent(pointerEvent("pointerdown", { button: 1 }));
      });
      expect(hide).not.toHaveBeenCalled();
    });

    it("a submenu installs none: one hide, on the root popup", async () => {
      const user = setupUser();
      render(
        <Harness
          content={
            <>
              <Menu.Item data-testid="rename">Rename</Menu.Item>
              <Menu.Root>
                <Menu.SubmenuTrigger data-testid="move">Move to</Menu.SubmenuTrigger>
                <Menu.Popup data-testid="subpopup">
                  <Menu.Item data-testid="inbox">Inbox</Menu.Item>
                </Menu.Popup>
              </Menu.Root>
            </>
          }
        />,
      );
      await rightClick(region());
      act(() => item("move").focus());
      await user.keyboard("{ArrowRight}");
      await flush();
      expect(isOpen(screen.getByTestId("subpopup"))).toBe(true);
      const hidden: Element[] = [];
      const original = HTMLElement.prototype.hidePopover;
      vi.spyOn(HTMLElement.prototype, "hidePopover").mockImplementation(function (
        this: HTMLElement,
      ) {
        hidden.push(this);
        original.call(this);
      });
      act(() => {
        document.body.dispatchEvent(pointerEvent("contextmenu"));
      });
      expect(hidden).toEqual([popup()]);
      expect(isOpen(screen.getByTestId("subpopup"))).toBe(false);
    });
  });

  describe("dual-trigger Root", () => {
    it("Trigger: anchored; region: point; aria-expanded on the Trigger during a context open", async () => {
      const user = setupUser();
      const calls = watchShow();
      render(<Harness withTrigger />);
      const t = screen.getByTestId("trigger");
      await user.click(t);
      await flush();
      expect(calls.at(-1)!.source).toBe(t);
      expect(popup()).toHaveAttribute("data-side", "bottom");
      expect(popup().style.getPropertyValue("position-area")).toBe("bottom span-self-x-end");
      await act(async () => popup().hidePopover());
      await flush();
      await rightClick(screen.getByTestId("label"));
      expect(calls.at(-1)!.source).toBe(region());
      expect(popup()).toHaveAttribute("data-context", "");
      expect(t).toHaveAttribute("aria-expanded", "true");
      expect(t).toHaveAttribute("data-open", "");
    });

    it("a Trigger click while context-open closes through requestClose ('activate')", async () => {
      const user = setupUser();
      const action = vi.fn<OpenAction>();
      render(<Harness withTrigger root={{ openChangeAction: action }} />);
      await rightClick(region());
      await user.click(screen.getByTestId("trigger"));
      await flush();
      expect(isOpen()).toBe(false);
      expect(action.mock.calls.at(-1)![0]).toBe(false);
      expect(action.mock.calls.at(-1)![1].reason).toBe("activate");
    });

    it("a right-click while Trigger-open switches to the point placement (re-shown)", async () => {
      const user = setupUser();
      render(<Harness withTrigger />);
      await user.click(screen.getByTestId("trigger"));
      await flush();
      const calls = watchShow();
      await rightClick(screen.getByTestId("label"), 50, 60);
      expect(isOpen()).toBe(true);
      expect(popup()).toHaveAttribute("data-context", "");
      expect(pointStyle(popup()).x).toBe("50px");
      expect(calls).toHaveLength(1);
      expect(calls[0]!.source).toBe(region());
    });

    it("two ContextTriggers in one Root: the right-clicked one is the source", async () => {
      render(
        <Menu.Root>
          <Menu.ContextTrigger data-testid="a">A</Menu.ContextTrigger>
          <Menu.ContextTrigger data-testid="b">B</Menu.ContextTrigger>
          <Menu.Popup data-testid="popup" aria-label="Rows">
            <Items />
          </Menu.Popup>
        </Menu.Root>,
      );
      await rightClick(screen.getByTestId("b"));
      expect(popoverSource(popup())).toBe(screen.getByTestId("b"));
      expect(screen.getByTestId("a")).toHaveAttribute("data-open", "");
      expect(screen.getByTestId("b")).toHaveAttribute("data-open", "");
    });

    it("after a context menu closes, a controlled open with no dispatch is anchored", async () => {
      function Controlled() {
        const [open, setOpen] = useState(false);
        return (
          <>
            <button type="button" data-testid="flip" onClick={() => setOpen((o) => !o)} />
            <Harness
              withTrigger
              root={{
                open,
                openChangeAction: (next) => {
                  startTransition(() => setOpen(next));
                },
              }}
            />
          </>
        );
      }
      render(<Controlled />);
      await rightClick(region());
      expect(isOpen()).toBe(true);
      expect(popup()).toHaveAttribute("data-context", "");
      await act(async () => popup().hidePopover());
      await flush();
      expect(isOpen()).toBe(false);
      fireEvent.click(screen.getByTestId("flip"));
      await flush();
      expect(isOpen()).toBe(true);
      expect(popup()).not.toHaveAttribute("data-context");
      expect(popup()).toHaveAttribute("data-side", "bottom");
    });
  });

  describe("direction (wave 11, #88)", () => {
    // The popup's computed direction, read by `openAt` once per open and per move, picks the
    // edge at the point (context-menu.md 4.6). jsdom computes `direction` from `dir` for nothing,
    // so it is stubbed for the popup.
    const stubDirection = (direction: string) =>
      stubComputedPlacement(() => screen.queryByTestId("popup"), { direction });

    it("an RTL popup puts its right edge at the point and names the mirrored options", async () => {
      stubDirection("rtl");
      render(<Harness />);
      await rightClick(region(), 312, 148);
      expect(isOpen()).toBe(true);
      const first = pointStyle(popup());
      expect(first).toEqual({
        x: "312px",
        y: "148px",
        left: "auto",
        top: "calc(var(--menu-point-y) + var(--menu-point-gap))",
        right: "calc(100% - var(--menu-point-x))",
        bottom: "auto",
        positionArea: "none",
        // Generation 1 is odd: `--fsui-menu-right` first.
        fallbacks: MENU_POINT_FALLBACKS.rtl.mouse[1],
      });
      expect(first.fallbacks.startsWith("--fsui-menu-right")).toBe(true);
      expect(first.fallbacks).toContain("--fsui-menu-up-right");
      expect(popup()).toHaveAttribute("data-context", "");
      expect(popup()).not.toHaveAttribute("data-side");
    });

    it("a move after the direction flipped back to LTR uses the LTR insets and list", async () => {
      const stub = stubDirection("rtl");
      render(<Harness />);
      await rightClick(region(), 100, 100);
      expect(pointStyle(popup()).right).toBe("calc(100% - var(--menu-point-x))");
      stub.set({ direction: "ltr" });
      await rightClick(region(), 300, 250);
      expect(isOpen()).toBe(true);
      expect(pointStyle(popup())).toEqual({
        x: "300px",
        y: "250px",
        left: "var(--menu-point-x)",
        top: "calc(var(--menu-point-y) + var(--menu-point-gap))",
        right: "auto",
        bottom: "auto",
        positionArea: "none",
        fallbacks: MENU_POINT_FALLBACKS.ltr.mouse[0],
      });
      expect(popup()).toHaveAttribute("data-context", "");
      expect(popup()).not.toHaveAttribute("data-side");
    });

    it("side={null}: the direction does not add insets", async () => {
      stubDirection("rtl");
      render(<Harness popup={{ side: null }} />);
      await rightClick(region(), 312, 148);
      const s = pointStyle(popup());
      expect(s.x).toBe("312px");
      expect(s.left).toBe("");
      expect(s.right).toBe("");
      expect(s.fallbacks).toBe("");
    });
  });

  describe("<style> resource", () => {
    // React keeps a hoisted `<style>` in <head> after its Root unmounts and remembers it per
    // document, so with one shared document an earlier row's open decided what these rows saw
    // (#101, T15: failed under --sequence.shuffle). Each row renders into a document of its own.
    it("one hoisted <style> after the first point open; a second Root adds none", async () => {
      const { doc, regionIn, inside } = renderFresh(
        <>
          <Harness />
          <Menu.Root>
            <Menu.ContextTrigger data-testid="region2">Second</Menu.ContextTrigger>
            <Menu.Popup data-testid="popup2" aria-label="Second">
              <Menu.Item>Only</Menu.Item>
            </Menu.Popup>
          </Menu.Root>
        </>,
      );
      expect(rulesInHead(doc)).toHaveLength(0);
      await rightClick(regionIn);
      expect(rulesInHead(doc)).toHaveLength(1);
      const style = rulesInHead(doc)[0]!;
      expect(style.getAttribute("data-href")).toBe("@funstack/ui/menu-point");
      expect(style.getAttribute("data-precedence")).toBe("fsui");
      // Eight options since wave 11: mirrored for an RTL menu, offset for a touch open (#88).
      for (const name of [
        "up",
        "down",
        "left",
        "right",
        "up-left",
        "up-right",
        "down-left",
        "down-right",
      ]) {
        expect(style.textContent).toContain(`@position-try --fsui-menu-${name} {`);
      }
      // Nothing lands inside the popup.
      expect(inside.getByTestId("popup").querySelector("style")).toBeNull();
      await rightClick(inside.getByTestId("region2"));
      expect(isOpen(inside.getByTestId("popup2"))).toBe(true);
      expect(rulesInHead(doc)).toHaveLength(1);
    });

    it("side={null}: no <style>, only the two custom properties", async () => {
      const { doc, regionIn, inside } = renderFresh(<Harness popup={{ side: null }} />);
      await rightClick(regionIn, 20, 30);
      const popupIn = inside.getByTestId("popup");
      expect(isOpen(popupIn)).toBe(true);
      expect(rulesInHead(doc)).toHaveLength(0);
      expect(popupIn).toHaveAttribute("data-context", "");
      expect(pointStyle(popupIn)).toEqual({
        x: "20px",
        y: "30px",
        left: "",
        top: "",
        right: "",
        bottom: "",
        positionArea: "",
        fallbacks: "",
      });
    });

    it("an anchored-only Root renders none", async () => {
      const { doc, inside } = renderFresh(
        <Menu.Root>
          <Menu.Trigger data-testid="trigger">More</Menu.Trigger>
          <Menu.Popup data-testid="popup">
            <Items />
          </Menu.Popup>
        </Menu.Root>,
      );
      const user = setupUser({ document: doc });
      await user.click(inside.getByTestId("trigger"));
      await flush();
      expect(isOpen(inside.getByTestId("popup"))).toBe(true);
      expect(rulesInHead(doc)).toHaveLength(0);
    });

    it("the consumer's style wins over the inline point placement", async () => {
      render(<Harness popup={{ style: { positionTryFallbacks: "--mine", left: "1px" } }} />);
      await rightClick(region());
      expect(popup().style.getPropertyValue("position-try-fallbacks")).toBe("--mine");
      expect(popup().style.getPropertyValue("left")).toBe("1px");
      expect(popup().style.getPropertyValue("--menu-point-x")).toBe("312px");
    });
  });

  describe("touch offset (wave 11, #88)", () => {
    // A touch or pen open is placed above the point with `--menu-point-gap` (4.7).
    const ABOVE = "calc(100% - var(--menu-point-y) + var(--menu-point-gap))";
    const BELOW = "calc(var(--menu-point-y) + var(--menu-point-gap))";
    const gap = () => popup().style.getPropertyValue("--menu-point-gap");

    async function longPress(target: Element, x = 100, y = 120) {
      vi.useFakeTimers();
      act(() => {
        target.dispatchEvent(
          pointerEvent("pointerdown", {
            pointerType: "touch",
            button: 0,
            buttons: 1,
            pointerId: 5,
            clientX: x,
            clientY: y,
          }),
        );
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(520);
      });
    }

    it("a long-press opens above the point with a 16 px gap and the touch fallbacks", async () => {
      render(<Harness />);
      await longPress(region());
      expect(isOpen()).toBe(true);
      expect(gap()).toBe("16px");
      expect(pointStyle(popup())).toEqual({
        x: "100px",
        y: "120px",
        left: "var(--menu-point-x)",
        top: "auto",
        right: "auto",
        bottom: ABOVE,
        positionArea: "none",
        fallbacks: MENU_POINT_FALLBACKS.ltr.touch[1],
      });
    });

    it("a contextmenu with pointerType touch is placed the same way", async () => {
      render(<Harness />);
      await rightClick(region(), 200, 220, { pointerType: "touch", pointerId: 7 });
      expect(gap()).toBe("16px");
      expect(pointStyle(popup()).bottom).toBe(ABOVE);
      expect(pointStyle(popup()).top).toBe("auto");
      expect(pointStyle(popup()).fallbacks).toBe(MENU_POINT_FALLBACKS.ltr.touch[1]);
    });

    it("an RTL touch open names the mirrored touch options", async () => {
      stubComputedPlacement(() => screen.queryByTestId("popup"), { direction: "rtl" });
      render(<Harness />);
      await rightClick(region(), 200, 220, { pointerType: "pen", pointerId: 7 });
      const s = pointStyle(popup());
      expect(s.right).toBe("calc(100% - var(--menu-point-x))");
      expect(s.left).toBe("auto");
      expect(s.bottom).toBe(ABOVE);
      expect(s.fallbacks).toBe(MENU_POINT_FALLBACKS.rtl.touch[1]);
      expect(s.fallbacks).toBe("--fsui-menu-down, --fsui-menu-right, --fsui-menu-down-right");
    });

    it("a mouse open has a 0px gap and opens below; a mouse move after a touch open switches back", async () => {
      render(<Harness />);
      await rightClick(region(), 200, 220, { pointerType: "touch", pointerId: 7 });
      expect(gap()).toBe("16px");
      await rightClick(region(), 300, 250);
      expect(isOpen()).toBe(true);
      expect(gap()).toBe("0px");
      expect(pointStyle(popup())).toEqual({
        x: "300px",
        y: "250px",
        left: "var(--menu-point-x)",
        top: BELOW,
        right: "auto",
        bottom: "auto",
        positionArea: "none",
        fallbacks: MENU_POINT_FALLBACKS.ltr.mouse[0],
      });
    });

    it("the keyboard is placed as a mouse", async () => {
      render(<Harness />);
      await dispatch(region(), pointerEvent("contextmenu", { button: -1, buttons: 0 }));
      await flush();
      expect(gap()).toBe("0px");
      expect(pointStyle(popup()).top).toBe(BELOW);
    });

    it("a consumer's --menu-point-gap wins", async () => {
      render(<Harness popup={{ style: { "--menu-point-gap": "24px" } as CSSProperties }} />);
      await rightClick(region(), 200, 220, { pointerType: "touch", pointerId: 7 });
      expect(gap()).toBe("24px");
    });

    it("side={null} still hands the gap over with the point", async () => {
      render(<Harness popup={{ side: null }} />);
      await rightClick(region(), 200, 220, { pointerType: "touch", pointerId: 7 });
      expect(gap()).toBe("16px");
      expect(pointStyle(popup()).bottom).toBe("");
    });
  });

  describe("press-drag-release (wave 11, #88)", () => {
    // context-menu.md 2.6. jsdom has no `elementFromPoint` and no pointer capture: the hit is
    // stubbed per test, and the events the captured pointer would deliver are dispatched at the
    // popup. The clock is `performance.now()`.
    let hit: Element | null = null;
    let now = 1000;
    beforeEach(() => {
      hit = null;
      now = 1000;
      Object.defineProperty(document, "elementFromPoint", {
        configurable: true,
        value: vi.fn(() => hit),
      });
      vi.spyOn(performance, "now").mockImplementation(() => now);
    });
    afterEach(() => {
      delete (document as { elementFromPoint?: unknown }).elementFromPoint;
    });

    const actions = {
      rename: vi.fn(),
      archive: vi.fn(),
      delete: vi.fn(),
    };
    beforeEach(() => {
      for (const fn of Object.values(actions)) fn.mockReset();
    });

    function DragItems() {
      return (
        <>
          <Menu.Item data-testid="rename" action={actions.rename}>
            Rename
          </Menu.Item>
          <Menu.Item data-testid="archive" action={actions.archive}>
            Archive
          </Menu.Item>
          <Menu.Item data-testid="delete" action={actions.delete} disabled>
            Delete
          </Menu.Item>
          <Menu.Separator data-testid="separator" />
          <Menu.Root>
            <Menu.SubmenuTrigger data-testid="move">Move to</Menu.SubmenuTrigger>
            <Menu.Popup data-testid="submenu" aria-label="Folders">
              <Menu.Item data-testid="inbox">Inbox</Menu.Item>
            </Menu.Popup>
          </Menu.Root>
        </>
      );
    }

    /** What the captured pointer delivers: dispatched at the popup, at (x, y). */
    function captured(type: string, x: number, y: number, init: PointerEventInit = {}) {
      act(() => {
        popup().dispatchEvent(
          pointerEvent(type, { clientX: x, clientY: y, button: 2, buttons: 2, ...init }),
        );
      });
    }

    it("a move over an item focuses it quietly", async () => {
      render(<Harness content={<DragItems />} />);
      await rightClick(region(), 312, 148);
      const quiet = watchQuietFocus();
      hit = item("archive");
      captured("pointermove", 320, 180);
      expect(document.activeElement).toBe(item("archive"));
      expect(quiet).toEqual([item("archive")]);
      // A disabled item is focused too (keyboard and pointer agree on the current item).
      hit = item("delete");
      captured("pointermove", 320, 200);
      expect(document.activeElement).toBe(item("delete"));
      // Nothing under the pointer: nothing.
      hit = document.body;
      captured("pointermove", 20, 20);
      expect(document.activeElement).toBe(item("delete"));
    });

    it("a move over a SubmenuTrigger focuses it and opens its submenu after the delay", async () => {
      render(<Harness content={<DragItems />} />);
      await rightClick(region(), 312, 148);
      hit = item("move");
      captured("pointermove", 320, 230);
      expect(document.activeElement).toBe(item("move"));
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });
      await flush();
      expect(isOpen(screen.getByTestId("submenu"))).toBe(true);
      // Into the submenu: the submenu stays open, its item takes focus.
      hit = item("inbox");
      captured("pointermove", 420, 230);
      expect(document.activeElement).toBe(item("inbox"));
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });
      await flush();
      expect(isOpen(screen.getByTestId("submenu"))).toBe(true);
    });

    it("a release 10 px away over an enabled item activates it and closes with 'activate'", async () => {
      const open = vi.fn<OpenAction>();
      render(<Harness root={{ openChangeAction: open }} content={<DragItems />} />);
      await rightClick(region(), 312, 148);
      hit = item("archive");
      captured("pointermove", 318, 156);
      let click: Event | undefined;
      act(() => {
        popup().dispatchEvent(
          pointerEvent("pointerup", { clientX: 318, clientY: 156, button: 2, buttons: 0 }),
        );
        // The click an engine may synthesise from this release, in the same task: swallowed.
        click = new MouseEvent("click", { bubbles: true, cancelable: true });
        document.body.dispatchEvent(click);
      });
      expect(actions.archive).toHaveBeenCalledTimes(1);
      expect(click!.defaultPrevented).toBe(true);
      await flush();
      expect(isOpen()).toBe(false);
      expect(open.mock.calls.at(-1)).toEqual([
        false,
        expect.objectContaining({ reason: "activate" }),
      ]);
      // One task later the swallow is gone.
      const later = new MouseEvent("click", { bubbles: true, cancelable: true });
      document.body.dispatchEvent(later);
      expect(later.defaultPrevented).toBe(false);
    });

    it("a release within the slop, over a disabled item or a SubmenuTrigger does nothing", async () => {
      render(<Harness content={<DragItems />} />);
      for (const [target, dx] of [
        ["archive", 2],
        ["delete", 10],
        ["move", 10],
        ["separator", 10],
      ] as const) {
        await rightClick(region(), 312, 148);
        hit = item(target);
        captured("pointerup", 312 + dx, 148, { buttons: 0 });
        await flush();
        expect(isOpen()).toBe(true);
      }
      expect(actions.archive).not.toHaveBeenCalled();
      expect(actions.delete).not.toHaveBeenCalled();
    });

    it("a release outside after moving dismisses only after 500 ms", async () => {
      const open = vi.fn<OpenAction>();
      render(<Harness root={{ openChangeAction: open }} content={<DragItems />} />);
      // 100 ms after the open, 10 px away, outside: still open.
      await rightClick(region(), 312, 148);
      hit = document.body;
      now += 100;
      captured("pointerup", 322, 148, { buttons: 0 });
      await flush();
      expect(isOpen()).toBe(true);
      // 600 ms after a fresh open (a move restarts the clock), 0 px away: still open.
      await rightClick(region(), 312, 148);
      now += 600;
      captured("pointerup", 312, 148, { buttons: 0 });
      await flush();
      expect(isOpen()).toBe(true);
      // 600 ms, 10 px away: dismissed.
      await rightClick(region(), 312, 148);
      const hide = vi.spyOn(HTMLElement.prototype, "hidePopover");
      now += 600;
      captured("pointerup", 322, 148, { buttons: 0 });
      expect(hide).toHaveBeenCalledTimes(1);
      expect(isOpen()).toBe(false);
      await flush();
      expect(open.mock.calls.at(-1)![1].reason).toBe("dismiss");
    });

    it("the 500 ms count from the show, not the press: a pending openChangeAction (review M2)", async () => {
      let settle: () => void = () => {};
      // Only the open is slow.
      const open = vi.fn<OpenAction>().mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            settle = resolve;
          }),
      );
      render(<Harness root={{ openChangeAction: open }} content={<DragItems />} />);
      await rightClick(region(), 312, 148);
      // The action is pending: the popup is not shown yet.
      expect(isOpen()).toBe(false);
      now += 500;
      await act(async () => settle());
      await flush();
      expect(isOpen()).toBe(true);
      // 600 ms after the press but 100 ms after the show, 10 px away, outside: still open.
      hit = document.body;
      now += 100;
      captured("pointerup", 322, 148, { buttons: 0 });
      await flush();
      expect(isOpen()).toBe(true);
    });

    it("ignores another pointer, and ends at lostpointercapture", async () => {
      render(<Harness content={<DragItems />} />);
      await rightClick(region(), 312, 148);
      hit = item("archive");
      captured("pointerup", 330, 148, { pointerId: 9, buttons: 0 });
      expect(actions.archive).not.toHaveBeenCalled();
      captured("lostpointercapture", 330, 148);
      captured("pointerup", 330, 148, { buttons: 0 });
      await flush();
      expect(actions.archive).not.toHaveBeenCalled();
      expect(isOpen()).toBe(true);
    });

    it("the release ends the gesture: a later pointerup does nothing", async () => {
      render(<Harness content={<DragItems />} />);
      await rightClick(region(), 312, 148);
      hit = item("archive");
      captured("pointerup", 313, 148, { buttons: 0 });
      captured("pointerup", 330, 148, { buttons: 0 });
      await flush();
      expect(actions.archive).not.toHaveBeenCalled();
      expect(isOpen()).toBe(true);
    });

    it("no gesture without a button down (Windows, the keyboard)", async () => {
      render(<Harness content={<DragItems />} />);
      await dispatch(region(), pointerEvent("contextmenu", { buttons: 0 }));
      await flush();
      expect(isOpen()).toBe(true);
      hit = item("archive");
      captured("pointermove", 330, 160, { buttons: 0 });
      expect(document.activeElement).toBe(item("rename"));
      captured("pointerup", 330, 160, { buttons: 0 });
      await flush();
      expect(actions.archive).not.toHaveBeenCalled();
    });

    it("a move restarts the gesture from the new point", async () => {
      render(<Harness content={<DragItems />} />);
      await rightClick(region(), 312, 148);
      await rightClick(region(), 100, 100);
      hit = item("archive");
      // 2 px from the new point (far from the first one): within the slop.
      captured("pointerup", 102, 100, { buttons: 0 });
      await flush();
      expect(actions.archive).not.toHaveBeenCalled();
      await rightClick(region(), 100, 100);
      captured("pointerup", 110, 100, { buttons: 0 });
      await flush();
      expect(actions.archive).toHaveBeenCalledTimes(1);
    });

    describe("touch", () => {
      async function longPress() {
        vi.useFakeTimers();
        act(() => {
          region().dispatchEvent(
            pointerEvent("pointerdown", {
              pointerType: "touch",
              button: 0,
              buttons: 1,
              pointerId: 5,
              clientX: 100,
              clientY: 120,
            }),
          );
        });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(510);
        });
        expect(isOpen()).toBe(true);
      }
      const touch = (type: string, x: number, y: number) =>
        captured(type, x, y, { pointerType: "touch", pointerId: 5, button: 0, buttons: 0 });

      it("guards touchmove while the finger is down; cancels the lift's touchend (no click), then stops", async () => {
        const listen = vi.spyOn(document, "addEventListener");
        render(<Harness content={<DragItems />} />);
        await longPress();
        const call = listen.mock.calls.find(([type]) => type === "touchmove");
        expect(call?.[2]).toEqual({ passive: false });
        const move = new Event("touchmove", { cancelable: true });
        document.dispatchEvent(move);
        expect(move.defaultPrevented).toBe(true);
        hit = null;
        // The pointerup comes first; the touch events of the same lift follow.
        touch("pointerup", 100, 120);
        const stillDown = new Event("touchmove", { cancelable: true });
        document.dispatchEvent(stillDown);
        expect(stillDown.defaultPrevented).toBe(true);
        const end = new Event("touchend", { cancelable: true });
        document.dispatchEvent(end);
        expect(end.defaultPrevented).toBe(true);
        const after = new Event("touchmove", { cancelable: true });
        document.dispatchEvent(after);
        expect(after.defaultPrevented).toBe(false);
        const nextEnd = new Event("touchend", { cancelable: true });
        document.dispatchEvent(nextEnd);
        expect(nextEnd.defaultPrevented).toBe(false);
        expect(isOpen()).toBe(true);
      });

      it("another finger's lift does not end the guard; the gesture finger's does (review L4)", async () => {
        render(<Harness content={<DragItems />} />);
        await longPress();
        // A second finger taps and lifts while the first is still down: its touchend is
        // prevented (no click mid-gesture) but the first finger's slide stays guarded.
        const other = new Event("touchend", { cancelable: true });
        document.dispatchEvent(other);
        expect(other.defaultPrevented).toBe(true);
        const slide = new Event("touchmove", { cancelable: true });
        document.dispatchEvent(slide);
        expect(slide.defaultPrevented).toBe(true);
        // Another pointer's pointerup is not the gesture's either.
        captured("pointerup", 300, 300, {
          pointerType: "touch",
          pointerId: 9,
          button: 0,
          buttons: 0,
        });
        const second = new Event("touchend", { cancelable: true });
        document.dispatchEvent(second);
        const stillDown = new Event("touchmove", { cancelable: true });
        document.dispatchEvent(stillDown);
        expect(stillDown.defaultPrevented).toBe(true);
        // The gesture finger lifts: pointerup, then its touchend ends the guard.
        hit = null;
        touch("pointerup", 100, 120);
        const own = new Event("touchend", { cancelable: true });
        document.dispatchEvent(own);
        expect(own.defaultPrevented).toBe(true);
        const after = new Event("touchmove", { cancelable: true });
        document.dispatchEvent(after);
        expect(after.defaultPrevented).toBe(false);
        expect(isOpen()).toBe(true);
      });

      it("without a touchend after the pointerup, the guard stops on its own", async () => {
        render(<Harness content={<DragItems />} />);
        await longPress();
        hit = null;
        touch("pointerup", 100, 120);
        await act(async () => {
          await vi.advanceTimersByTimeAsync(300);
        });
        const after = new Event("touchmove", { cancelable: true });
        document.dispatchEvent(after);
        expect(after.defaultPrevented).toBe(false);
      });

      it("pointercancel lifts the guard too", async () => {
        render(<Harness content={<DragItems />} />);
        await longPress();
        touch("pointercancel", 100, 120);
        const after = new Event("touchmove", { cancelable: true });
        document.dispatchEvent(after);
        expect(after.defaultPrevented).toBe(false);
      });

      it("a plain lift never closes, even late", async () => {
        render(<Harness content={<DragItems />} />);
        await longPress();
        await act(async () => {
          await vi.advanceTimersByTimeAsync(700);
        });
        hit = document.body;
        touch("pointerup", 100, 120);
        await act(async () => {
          await vi.advanceTimersByTimeAsync(10);
        });
        expect(isOpen()).toBe(true);
      });

      it("a slide of 20 px onto an item activates it; 5 px does not (10 px slop)", async () => {
        render(<Harness content={<DragItems />} />);
        await longPress();
        hit = item("archive");
        touch("pointerup", 105, 120);
        expect(actions.archive).not.toHaveBeenCalled();
        await act(async () => {
          await vi.advanceTimersByTimeAsync(10);
        });
        expect(isOpen()).toBe(true);
        // The release ended that gesture; a fresh long-press for the second half.
        act(() => popup().hidePopover());
        await act(async () => {
          await vi.advanceTimersByTimeAsync(10);
        });
        await longPress();
        hit = item("archive");
        touch("pointermove", 100, 140);
        expect(document.activeElement).toBe(item("archive"));
        touch("pointerup", 100, 140);
        // The long-press click swallow did not eat the activation.
        expect(actions.archive).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("close-on-scroll and the wheel guard (wave 11, #88)", () => {
    const scroll = (target: EventTarget) => {
      act(() => {
        // `scroll` does not bubble; the library listens in the capture phase.
        target.dispatchEvent(new Event("scroll"));
      });
    };
    // Frames advance only when a row says so. With jsdom's timer-driven frames, a frame could
    // pass inside `rightClick`'s task flush on a loaded machine and end the in-flight scroll
    // window before the row's first scroll (#101: flaky under a shuffled, parallel run).
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
    });
    /**
     * One animation frame: runs the library's frame callback. Scroll events in flight at the
     * open are ignored until the first frame that had none (review L6).
     */
    const nextFrame = () =>
      act(() => {
        vi.advanceTimersToNextFrame();
      });

    it("a point menu closes on a scroll of the document, with 'dismiss'", async () => {
      const open = vi.fn<OpenAction>();
      render(<Harness root={{ openChangeAction: open }} />);
      await rightClick(region());
      await nextFrame();
      const hide = vi.spyOn(HTMLElement.prototype, "hidePopover");
      scroll(document);
      expect(hide).toHaveBeenCalledTimes(1);
      expect(isOpen()).toBe(false);
      await flush();
      expect(open.mock.calls.at(-1)![1].reason).toBe("dismiss");
      // Removed with the close.
      await rightClick(region());
      hide.mockClear();
      act(() => popup().hidePopover());
      await flush();
      hide.mockClear();
      scroll(document);
      expect(hide).not.toHaveBeenCalled();
    });

    it("closes on a scroll of an ancestor of the region, not of an unrelated element or the popup", async () => {
      const { container } = render(<Harness />);
      await rightClick(region());
      await nextFrame();
      scroll(screen.getByTestId("elsewhere"));
      expect(isOpen()).toBe(true);
      scroll(popup());
      expect(isOpen()).toBe(true);
      scroll(item("rename"));
      expect(isOpen()).toBe(true);
      scroll(container);
      expect(isOpen()).toBe(false);
    });

    it("a Trigger-opened menu stays open on a document scroll", async () => {
      const user = setupUser();
      render(<Harness withTrigger />);
      await user.click(screen.getByTestId("trigger"));
      await flush();
      expect(isOpen()).toBe(true);
      await nextFrame();
      scroll(document);
      expect(isOpen()).toBe(true);
      // Re-placed at a point by a right-click: the rule applies from then on.
      await rightClick(region());
      expect(popup()).toHaveAttribute("data-context", "");
      scroll(document);
      expect(isOpen()).toBe(false);
    });

    it("a scroll in flight at the open is ignored until a frame passes without one (review L6)", async () => {
      render(<Harness />);
      await rightClick(region());
      // A smooth scroll or momentum: one scroll event per frame.
      scroll(document);
      await nextFrame();
      expect(isOpen()).toBe(true);
      scroll(document);
      await nextFrame();
      expect(isOpen()).toBe(true);
      // A frame with no scroll: the in-flight scroll is over, and the next one is the user's.
      await nextFrame();
      expect(isOpen()).toBe(true);
      scroll(document);
      expect(isOpen()).toBe(false);
    });

    it("the frame watch stops with the close", async () => {
      render(<Harness />);
      await rightClick(region());
      const cancel = vi.spyOn(window, "cancelAnimationFrame");
      act(() => popup().hidePopover());
      await flush();
      expect(cancel).toHaveBeenCalledTimes(1);
    });

    const wheel = (target: Element, deltaY: number, init: WheelEventInit = {}) => {
      const event = new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true, ...init });
      act(() => {
        target.dispatchEvent(event);
      });
      return event;
    };

    it.each(["region", "Trigger"])(
      "a wheel over a menu opened from the %s never scrolls the page",
      async (from) => {
        const user = setupUser();
        render(<Harness withTrigger />);
        if (from === "region") await rightClick(region());
        else {
          await user.click(screen.getByTestId("trigger"));
          await flush();
        }
        expect(wheel(item("archive"), 10).defaultPrevented).toBe(true);
        expect(wheel(popup(), -10).defaultPrevented).toBe(true);
        // Removed with the close.
        act(() => popup().hidePopover());
        await flush();
        expect(wheel(popup(), 10).defaultPrevented).toBe(false);
      },
    );

    it("a zoom (Ctrl+wheel, trackpad pinch) is never prevented (review L3)", async () => {
      render(<Harness />);
      await rightClick(region());
      expect(wheel(item("archive"), 10, { ctrlKey: true }).defaultPrevented).toBe(false);
      expect(wheel(popup(), -10, { ctrlKey: true }).defaultPrevented).toBe(false);
      expect(wheel(item("archive"), 10).defaultPrevented).toBe(true);
    });

    it("a menu that can scroll that way takes the wheel", async () => {
      render(<Harness popup={{ style: { overflowY: "auto" } }} />);
      await rightClick(region());
      Object.defineProperties(popup(), {
        scrollHeight: { configurable: true, value: 400 },
        clientHeight: { configurable: true, value: 100 },
      });
      popup().scrollTop = 0;
      expect(wheel(item("archive"), 10).defaultPrevented).toBe(false);
      expect(wheel(item("archive"), -10).defaultPrevented).toBe(true);
    });
  });

  describe("CSP (wave 11, #88)", () => {
    // React records a hoisted style per document and never removes it: each row renders into a
    // document of its own (renderFresh).

    it("the nonce of a <CSPProvider> lands on the hoisted <style>", async () => {
      const { regionIn, styles } = renderFresh(
        <CSPProvider nonce="abc">
          <Harness />
        </CSPProvider>,
      );
      await rightClick(regionIn);
      expect(styles()).toHaveLength(1);
      expect(styles()[0]!.getAttribute("nonce")).toBe("abc");
      expect(styles()[0]!.textContent).toBe(MENU_POINT_RULES);
    });

    it("without the provider, no nonce attribute", async () => {
      const { regionIn, styles } = renderFresh(<Harness />);
      await rightClick(regionIn);
      expect(styles()).toHaveLength(1);
      expect(styles()[0]!.hasAttribute("nonce")).toBe(false);
    });
  });
  describe("closing paths as Menu", () => {
    it("item activation closes through the Root with 'activate'", async () => {
      const action = vi.fn<OpenAction>();
      render(<Harness root={{ openChangeAction: action }} />);
      await rightClick(region());
      fireEvent.click(item("archive"));
      await flush();
      expect(isOpen()).toBe(false);
      expect(action.mock.calls.at(-1)).toEqual([
        false,
        expect.objectContaining({ reason: "activate" }),
      ]);
    });

    it("Escape (hidePopover in the shim) notifies 'dismiss'", async () => {
      const action = vi.fn<OpenAction>();
      render(<Harness root={{ openChangeAction: action }} />);
      await rightClick(region());
      await act(async () => popup().hidePopover());
      await flush();
      expect(action.mock.calls.at(-1)![1].reason).toBe("dismiss");
      expect(region()).not.toHaveAttribute("data-open");
    });

    it("Tab out closes the stack", async () => {
      render(<Harness />);
      await rightClick(region());
      act(() => {
        fireEvent.blur(item("rename"), { relatedTarget: screen.getByTestId("elsewhere") });
      });
      expect(isOpen()).toBe(false);
    });

    it("a controlled open={false} hides without a dispatch", async () => {
      const action = vi.fn<OpenAction>();
      function Controlled() {
        const [open, setOpen] = useState(false);
        return (
          <>
            <button type="button" data-testid="close" onClick={() => setOpen(false)} />
            <Harness
              root={{
                open,
                openChangeAction: (next, details) => {
                  action(next, details);
                  startTransition(() => setOpen(next));
                },
              }}
            />
          </>
        );
      }
      render(<Controlled />);
      await rightClick(region());
      expect(isOpen()).toBe(true);
      fireEvent.click(screen.getByTestId("close"));
      await flush();
      expect(isOpen()).toBe(false);
      expect(action).toHaveBeenCalledTimes(1);
    });
  });

  describe("focus return", () => {
    it("with a Menu.Trigger in the Root, a close from <body> focuses the Trigger (6.2 rule)", async () => {
      render(<Harness withTrigger />);
      act(() => (document.activeElement as HTMLElement | null)?.blur());
      await rightClick(screen.getByTestId("label"));
      expect(document.activeElement).toBe(item("rename"));
      await act(async () => popup().hidePopover());
      await flush();
      expect(document.activeElement).toBe(screen.getByTestId("trigger"));
    });

    it("without a Trigger, nothing is focused (<body>)", async () => {
      render(<Harness />);
      await rightClick(screen.getByTestId("label"));
      expect(document.activeElement).toBe(item("rename"));
      await act(async () => popup().hidePopover());
      await flush();
      expect(document.activeElement).toBe(document.body);
    });
  });

  describe("Suspense and rejection", () => {
    it("items that suspend hold the open: data-pending on the region and the Trigger; then at the point", async () => {
      const { Suspender, resolve } = createSuspender();
      const calls = watchShow();
      render(
        <Suspense fallback={<span data-testid="fallback" />}>
          <Harness
            withTrigger
            content={
              <>
                <Menu.Item data-testid="rename">Rename</Menu.Item>
                <Suspender value="items" />
              </>
            }
          />
        </Suspense>,
      );
      await rightClick(region(), 40, 50);
      expect(calls).toHaveLength(0);
      expectPending(region());
      expectPending(screen.getByTestId("trigger"));
      expect(screen.queryByTestId("fallback")).toBeNull();
      await act(async () => resolve("items"));
      await flush();
      expect(calls).toHaveLength(1);
      expect(isOpen()).toBe(true);
      expect(pointStyle(popup()).x).toBe("40px");
      expectNotPending(region());
    });

    it("a rejected openChangeAction: data-open gone, nothing shown, the boundary has it", async () => {
      silenceErrors();
      const onError = vi.fn();
      render(
        <Harness
          boundary={onError}
          root={{
            openChangeAction: async () => {
              throw new Error("no menu");
            },
          }}
        />,
      );
      await rightClick(region());
      await flush();
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "no menu" }));
      expect(screen.getByTestId("error-catcher")).toHaveTextContent("no menu");
    });

    it("an openChangeAction that refuses (resolves without opening, controlled): data-open rolls back", async () => {
      function Refusing() {
        const [open] = useState(false);
        return <Harness root={{ open, openChangeAction: async () => {} }} />;
      }
      render(<Refusing />);
      await rightClick(region());
      await flush();
      expect(region()).not.toHaveAttribute("data-open");
      expect(isOpen()).toBe(false);
    });

    it("a refused point open leaves no point placement; a later open with no dispatch is anchored (review L1)", async () => {
      const seen: MenuPopupState[] = [];
      function Refusing() {
        const [open, setOpen] = useState(false);
        return (
          <>
            <button type="button" data-testid="flip" onClick={() => setOpen(true)} />
            <Harness
              withTrigger
              root={{ open, openChangeAction: async () => {} }}
              popup={{
                className: (s: MenuPopupState) => {
                  seen.push(s);
                  return undefined;
                },
              }}
            />
          </>
        );
      }
      render(<Refusing />);
      await rightClick(region(), 70, 80);
      await flush();
      expect(isOpen()).toBe(false);
      expect(popup()).not.toHaveAttribute("data-context");
      expect(popup().style.getPropertyValue("--menu-point-x")).toBe("");
      expect(seen.at(-1)!.context).toBe(false);
      fireEvent.click(screen.getByTestId("flip"));
      await flush();
      expect(isOpen()).toBe(true);
      expect(popup()).not.toHaveAttribute("data-context");
      expect(popup()).toHaveAttribute("data-side", "bottom");
    });
  });

  describe("function props and render", () => {
    it("className / style / children / render receive { open, pending, disabled }", async () => {
      const seen: MenuContextTriggerState[] = [];
      const work = deferred();
      render(
        <Menu.Root openChangeAction={() => work.promise}>
          <Menu.ContextTrigger
            data-testid="region"
            className={(s: MenuContextTriggerState) => {
              seen.push(s);
              return s.open ? "open" : "closed";
            }}
            style={(s: MenuContextTriggerState) => ({ opacity: s.pending ? 0.5 : 1 })}
            render={(props, s: MenuContextTriggerState) => (
              <section {...props} data-render={String(s.disabled)} />
            )}
          >
            {(s: MenuContextTriggerState) => (s.open ? "Open" : "Closed")}
          </Menu.ContextTrigger>
          <Menu.Popup aria-label="Menu">
            <Items />
          </Menu.Popup>
        </Menu.Root>,
      );
      expect(region().tagName).toBe("SECTION");
      expect(region()).toHaveAttribute("data-render", "false");
      expect(region()).toHaveClass("closed");
      expect(seen.at(-1)).toEqual({ open: false, pending: false, disabled: false });
      await rightClick(region());
      expect(region()).toHaveClass("open");
      expect(region()).toHaveTextContent("Open");
      expect(region().style.opacity).toBe("0.5");
      expect(seen.at(-1)).toEqual({ open: true, pending: true, disabled: false });
      await act(async () => work.resolve());
      await flush();
      expect(region().style.opacity).toBe("1");
    });

    it("render={<canvas tabIndex={0} />}: a focusable canvas region", async () => {
      render(
        <Menu.Root>
          <Menu.ContextTrigger
            data-testid="region"
            render={<canvas tabIndex={0} aria-label="Diagram" />}
          />
          <Menu.Popup data-testid="popup" aria-label="Diagram options">
            <Items />
          </Menu.Popup>
        </Menu.Root>,
      );
      expect(region().tagName).toBe("CANVAS");
      expect(region()).toHaveAttribute("tabindex", "0");
      expect(region()).toHaveAttribute("aria-label", "Diagram");
      await rightClick(region());
      expect(isOpen()).toBe(true);
    });

    it("the consumer's style wins over WebkitTouchCallout; onKeyDown and onClick pass through", () => {
      const onKeyDown = vi.fn();
      const onClick = vi.fn();
      const html = renderToString(
        <Menu.Root>
          <Menu.ContextTrigger style={{ WebkitTouchCallout: "default" }}>row</Menu.ContextTrigger>
          <Menu.Popup aria-label="Row" />
        </Menu.Root>,
      );
      expect(html).toContain("-webkit-touch-callout:default");
      render(<Harness region={{ onKeyDown, onClick }} />);
      fireEvent.keyDown(screen.getByTestId("inner"), { key: "a" });
      fireEvent.click(screen.getByTestId("inner"));
      expect(onKeyDown).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("post-await rule", () => {
    it("a controlled Root opened from the region, parent updating after its own await", async () => {
      function Controlled() {
        const [open, setOpen] = useState(false);
        return (
          <Harness
            root={{
              open,
              openChangeAction: async (next) => {
                await Promise.resolve();
                startTransition(() => setOpen(next));
              },
            }}
          />
        );
      }
      render(<Controlled />);
      await rightClick(region());
      await flush();
      expect(isOpen()).toBe(true);
      fireEvent.click(item("rename"));
      await flush();
      await flush();
      expect(isOpen()).toBe(false);
    });
  });

  describe("development warnings", () => {
    it("in a submenu Root", async () => {
      const error = silenceErrors();
      render(
        <Menu.Root defaultOpen>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Popup aria-label="Root">
            <Menu.Root>
              <Menu.ContextTrigger>bad</Menu.ContextTrigger>
              <Menu.Popup aria-label="Sub" />
            </Menu.Root>
          </Menu.Popup>
        </Menu.Root>,
      );
      await flush();
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining("Menu.ContextTrigger: rendered in a submenu"),
      );
    });

    it("a negative longPressDelay", () => {
      const error = silenceErrors();
      render(<Harness region={{ longPressDelay: -1 }} />);
      expect(error).toHaveBeenCalledWith(expect.stringContaining("`longPressDelay` is negative"));
    });

    it("a contextmenu with no mounted Popup: warns, opens nothing, the native menu stays", async () => {
      const error = silenceErrors();
      render(
        <Menu.Root>
          <Menu.ContextTrigger data-testid="region">row</Menu.ContextTrigger>
        </Menu.Root>,
      );
      const event = await rightClick(region());
      expect(event.defaultPrevented).toBe(false);
      expect(error).toHaveBeenCalledWith(expect.stringContaining("no mounted Menu.Popup"));
    });
  });
});

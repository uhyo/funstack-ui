// Drawer tests (jsdom), design/components/drawer.md. A Drawer runs the Dialog parts' code, so
// the shared overlay suites run against it as they do against Dialog and AlertDialog (open
// state, requests and facts, the Close part with an `action`), and this file adds what differs:
// `side` and `data-side`, the inline `touch-action`, `lightDismiss` following `modal`, the swipe
// as a fact (synthetic pointer events), its candidates, aborts and walkthroughs, and the
// development warnings. The jsdom `<dialog>` shim is src/__tests__/dialog-shim.ts; the tracker's
// own rows are internal/swipe.test.ts, its arithmetic internal/swipe-arithmetic.test.ts.
//
// Not testable here, covered by drawer.browser.test.tsx: real mouse drags with pointer capture
// on a top-layer dialog, the CSS transition the release waits for, `exitAnimations` of a
// custom-property write, the scroll of an inner scroller, a real backdrop press, and the click
// that follows a drag. Real touch input is a device check (memo/developer/issue-168.md).
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dragBy,
  DrawerHarness,
  drawerPopup as popup,
  mockPopupRect,
  releaseAt,
  swipePointer,
} from "../__tests__/drawer-harness.js";
import type { DrawerActionFn } from "../__tests__/drawer-harness.js";
import { dispatchCommand } from "../__tests__/dialog-shim.js";
import {
  deferred,
  expectNotPending,
  expectPending,
  flushTasks,
  setupUser,
  silenceErrors,
} from "../__tests__/helpers.js";
import { describeOverlayClosePart } from "../__tests__/overlay-close-part-suite.js";
import { describeOverlayOpenState } from "../__tests__/overlay-open-state-suite.js";
import { Dialog } from "../dialog/index.js";
import { Drawer } from "./index.js";
import type {
  DrawerOpenChangeDetails,
  DrawerPopupProps,
  DrawerPopupState,
  DrawerRootProps,
} from "./index.js";

const trigger = () => screen.getByTestId("trigger");
const spyShowModal = () => vi.spyOn(HTMLDialogElement.prototype, "showModal");
const spyClose = () => vi.spyOn(HTMLDialogElement.prototype, "close");

describeOverlayOpenState<DrawerOpenChangeDetails>({
  name: "Drawer",
  Harness: DrawerHarness,
  isOpen: () => popup().open,
  spyOpen: spyShowModal,
  spyClose,
  openArgs: () => [],
  dismiss: (value) => popup().requestClose(value),
  dismissEvent: "close",
  partCloses: [
    {
      name: "the Close part",
      close: (user) => user.click(screen.getByTestId("close")),
      cancelsClick: true,
      closeArgs: ["x"],
      returnsFocus: true,
    },
  ],
  detailsKeys: ["reason", "returnValue"],
  triggerToggles: false,
  popoverTarget: false,
  foreignOpen: () => dispatchCommand(popup(), "show-modal", screen.getByTestId("elsewhere")),
  foreignOpenCallsOpen: false,
  openBeforeHydration: (element) => element.setAttribute("open", ""),
  controlledOpenArgs: [],
  controlledCloseArgs: [""],
});

describeOverlayClosePart<DrawerOpenChangeDetails>({
  name: "Drawer",
  Harness: DrawerHarness,
  isOpen: () => popup().open,
  Close: (props) => <Drawer.Close value="v" {...props} />,
  spyClose,
  closeArgs: ["v"],
  value: "v",
  dismiss: () => popup().requestClose(),
  openStatic: async () => {
    await act(async () => popup().showModal());
  },
});

/** A minimal Drawer: a Trigger, a Popup with a Title, a handle, a body and a Close. */
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
      <Drawer.Popup data-testid="popup" {...popupProps}>
        <Drawer.Title data-testid="title">Filters</Drawer.Title>
        <div data-testid="handle" />
        {children}
        <Drawer.Close data-testid="close">Done</Drawer.Close>
      </Drawer.Popup>
    </Drawer.Root>
  );
}

const handle = () => screen.getByTestId("handle");

async function openSheet(user: ReturnType<typeof setupUser>): Promise<void> {
  await user.click(trigger());
  await flushTasks(2);
  expect(popup().open).toBe(true);
  mockPopupRect();
}

const swipeVars = (element: HTMLElement = popup()) => ({
  x: element.style.getPropertyValue("--drawer-swipe-x"),
  y: element.style.getPropertyValue("--drawer-swipe-y"),
  progress: element.style.getPropertyValue("--drawer-swipe-progress"),
});
const NO_VARS = { x: "", y: "", progress: "" };

describe("Drawer", () => {
  describe("markup and ARIA (design 1, 2, 5.1)", () => {
    it("renders a dialog with data-side, data-modal and the inline touch-action (JS-free mode)", () => {
      render(<DrawerHarness mode="static" />);
      const t = trigger();
      expect(t.tagName).toBe("BUTTON");
      expect(t).toHaveAttribute("command", "show-modal");
      const p = popup();
      expect(p.tagName).toBe("DIALOG");
      expect(p.id).toBe(t.getAttribute("commandfor"));
      expect(p).toHaveAttribute("data-side", "bottom");
      expect(p).toHaveAttribute("data-modal", "");
      expect(p).not.toHaveAttribute("data-swiping");
      expect(p).not.toHaveAttribute("role");
      expect(p.style.touchAction).toBe("pan-x pinch-zoom");
      expect(p.getAttribute("aria-labelledby")).toBe(screen.getByTestId("title").id);
      expect(p.getAttribute("aria-describedby")).toBe(screen.getByTestId("description").id);
      expect(screen.getByTestId("close")).toHaveAttribute("command", "request-close");
    });

    it("data-side and touch-action are in the server HTML", () => {
      const html = renderToString(
        <Drawer.Root>
          <Drawer.Popup side="inline-end" aria-label="Menu" />
        </Drawer.Root>,
      );
      expect(html).toContain('data-side="inline-end"');
      expect(html).toContain("touch-action:pan-y pinch-zoom");
    });

    it.each([
      ["top", "pan-x pinch-zoom"],
      ["bottom", "pan-x pinch-zoom"],
      ["left", "pan-y pinch-zoom"],
      ["right", "pan-y pinch-zoom"],
      ["inline-start", "pan-y pinch-zoom"],
      ["inline-end", "pan-y pinch-zoom"],
    ] as const)("side=%s renders data-side and touch-action %s", (side, touchAction) => {
      render(<DrawerHarness mode="static" popup={{ side }} />);
      expect(popup()).toHaveAttribute("data-side", side);
      expect(popup().style.touchAction).toBe(touchAction);
    });

    it("without swipeDismiss there is no touch-action", () => {
      render(<DrawerHarness mode="static" popup={{ swipeDismiss: false }} />);
      expect(popup().style.touchAction).toBe("");
      expect(popup()).toHaveAttribute("data-side", "bottom");
    });

    it("the consumer's style merges over the touch-action", () => {
      render(
        <DrawerHarness
          mode="static"
          popup={{ style: { touchAction: "none", color: "red" } as const }}
        />,
      );
      expect(popup().style.touchAction).toBe("none");
      expect(popup().style.color).toBe("red");
    });

    it("data-side and data-swiping are owned", () => {
      const props = { "data-side": "top", "data-swiping": "" } as Partial<DrawerPopupProps>;
      render(<DrawerHarness mode="static" popup={props} />);
      expect(popup()).toHaveAttribute("data-side", "bottom");
      expect(popup()).not.toHaveAttribute("data-swiping");
    });

    it("the function forms receive side in the Popup's state", () => {
      const seen: DrawerPopupState[] = [];
      render(
        <Drawer.Root defaultOpen={false}>
          <Drawer.Popup
            data-testid="popup"
            side="left"
            keepMounted
            className={(s) => `side-${s.side}`}
            style={(s) => ({ outlineWidth: s.side === "left" ? "1px" : "2px" })}
            render={(props, s) => {
              seen.push(s);
              return <dialog {...props} data-state-side={s.side} />;
            }}
          >
            {(s) => <span data-testid="child">{s.side}</span>}
          </Drawer.Popup>
        </Drawer.Root>,
      );
      expect(popup()).toHaveClass("side-left");
      expect(popup().style.outlineWidth).toBe("1px");
      expect(popup().style.touchAction).toBe("pan-y pinch-zoom");
      expect(popup()).toHaveAttribute("data-state-side", "left");
      expect(seen.at(-1)).toEqual({ open: false, modal: true, side: "left" });
    });

    it("a part outside a Root throws with the Drawer name", () => {
      silenceErrors();
      expect(() => render(<Drawer.Close>Close</Drawer.Close>)).toThrow(
        "Drawer.Close must be rendered inside a Drawer.Root.",
      );
      expect(() => render(<Drawer.Popup aria-label="x" />)).toThrow(
        "Drawer.Popup must be rendered inside a Drawer.Root.",
      );
    });

    it("the Root's state is Dialog's; modal={false} opens with show()", async () => {
      const user = setupUser();
      const show = vi.spyOn(HTMLDialogElement.prototype, "show");
      render(
        <Drawer.Root defaultOpen={false} modal={false}>
          {(state) => (
            <>
              <span data-testid="state">{JSON.stringify(state)}</span>
              <Drawer.Trigger data-testid="trigger">Inspector</Drawer.Trigger>
              <Drawer.Popup data-testid="popup" side="inline-end" aria-label="Inspector">
                <Drawer.Close>Close</Drawer.Close>
              </Drawer.Popup>
            </>
          )}
        </Drawer.Root>,
      );
      expect(JSON.parse(screen.getByTestId("state").textContent!)).toEqual({
        open: false,
        pending: false,
        modal: false,
      });
      await user.click(trigger());
      await flushTasks(2);
      expect(show).toHaveBeenCalledTimes(1);
      expect(popup()).not.toHaveAttribute("data-modal");
    });

    // Conventions 15 (#191): Dialog's Escape, so an IME composition's Escape is not a dismissal.
    it("modal={false}: an Escape of an IME composition keeps it open; the next one closes", async () => {
      render(
        <Drawer.Root defaultOpen modal={false}>
          <Drawer.Popup data-testid="popup" side="inline-end" aria-label="Inspector">
            <input data-testid="text" />
          </Drawer.Popup>
        </Drawer.Root>,
      );
      await flushTasks(2);
      const dialog = popup() as HTMLDialogElement;
      expect(dialog.open).toBe(true);
      for (const init of [{ isComposing: true }, { keyCode: 229 }]) {
        fireEvent.keyDown(screen.getByTestId("text"), { key: "Escape", ...init });
        await flushTasks(2);
        expect(dialog.open).toBe(true);
      }
      fireEvent.keyDown(screen.getByTestId("text"), { key: "Escape" });
      await flushTasks(2);
      expect(dialog.open).toBe(false);
    });
  });

  describe("light dismiss follows modal (design 3)", () => {
    /** A press and a click on the ::backdrop: the dialog itself, outside its box. */
    function pressBackdrop(): void {
      fireEvent.pointerDown(popup(), { clientX: 5, clientY: 5 });
      fireEvent.click(popup(), { clientX: 5, clientY: 5 });
    }

    it("a modal drawer closes on a backdrop press: a dismissal", async () => {
      const user = setupUser();
      const onOpenChange = vi.fn();
      render(<Sheet root={{ defaultOpen: false, onOpenChange }} />);
      await openSheet(user);
      act(pressBackdrop);
      await flushTasks(2);
      expect(popup().open).toBe(false);
      expect(onOpenChange).toHaveBeenCalledWith(
        false,
        expect.objectContaining({ reason: "dismiss" }),
      );
    });

    it("lightDismiss={false} keeps a modal drawer open", async () => {
      const user = setupUser();
      render(<Sheet root={{ defaultOpen: false }} popup={{ lightDismiss: false }} />);
      await openSheet(user);
      act(pressBackdrop);
      await flushTasks(2);
      expect(popup().open).toBe(true);
    });

    it("a non-modal drawer stays open on a click outside, unless lightDismiss is set", async () => {
      const user = setupUser();
      const { unmount } = render(
        <>
          <button data-testid="page">Page</button>
          <Sheet root={{ defaultOpen: false, modal: false }} popup={{ side: "inline-end" }} />
        </>,
      );
      await user.click(trigger());
      await flushTasks(2);
      await user.click(screen.getByTestId("page"));
      await flushTasks(2);
      expect(popup().open).toBe(true);
      unmount();

      render(
        <>
          <button data-testid="page">Page</button>
          <Sheet
            root={{ defaultOpen: false, modal: false }}
            popup={{ side: "inline-end", lightDismiss: true }}
          />
        </>,
      );
      await user.click(trigger());
      await flushTasks(2);
      await user.click(screen.getByTestId("page"));
      await flushTasks(2);
      expect(popup().open).toBe(false);
    });

    it("experimental_closedBy renders closedby from the defaulted lightDismiss", () => {
      const { unmount } = render(
        <Sheet root={{ defaultOpen: false }} popup={{ experimental_closedBy: true }} />,
      );
      expect(popup()).toHaveAttribute("closedby", "any");
      unmount();
      render(
        <Sheet
          root={{ defaultOpen: false, modal: false }}
          popup={{ experimental_closedBy: true }}
        />,
      );
      expect(popup()).toHaveAttribute("closedby", "closerequest");
    });
  });

  describe("swipe to dismiss (design 4)", () => {
    beforeEach(() => {
      // jsdom's `Event.timeStamp` is `Date.now()`: the velocity runs on a fake clock.
      vi.useFakeTimers({ toFake: ["Date"] });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("a drag past a quarter of the drawer closes it: a fact, with the pointerup", async () => {
      const user = setupUser();
      const openChangeAction = vi.fn<DrawerActionFn>();
      const onOpenChange = vi.fn<DrawerActionFn>();
      render(<Sheet root={{ defaultOpen: false, openChangeAction, onOpenChange }} />);
      await openSheet(user);
      openChangeAction.mockClear();

      dragBy(handle(), [3, 20, 40]);
      expect(popup()).toHaveAttribute("data-swiping", "");
      expect(swipeVars()).toEqual({ x: "0px", y: "40px", progress: "0.2" });
      vi.advanceTimersByTime(10);
      swipePointer("pointermove", handle(), 500, 660);
      expect(swipeVars()).toEqual({ x: "0px", y: "60px", progress: "0.3" });

      const up = releaseAt(handle(), 60);
      expect(popup()).not.toHaveAttribute("data-swiping");
      // No animation to wait for (jsdom): closed at the release, from the full extent.
      expect(popup().open).toBe(false);
      expect(swipeVars()).toEqual({ x: "0px", y: "200px", progress: "1" });
      await flushTasks(2);
      expect(swipeVars()).toEqual(NO_VARS);
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      const [next, details] = onOpenChange.mock.calls[0]!;
      expect(next).toBe(false);
      expect(details.reason).toBe("dismiss");
      expect(details.event).toBe(up);
      expect(details.returnValue).toBe("");
      expect(openChangeAction).not.toHaveBeenCalled();
      expectNotPending(trigger());
    });

    it("a short slow drag returns: the properties go, the drawer stays open", async () => {
      const user = setupUser();
      const onOpenChange = vi.fn();
      render(<Sheet root={{ defaultOpen: false, onOpenChange }} />);
      await openSheet(user);
      dragBy(handle(), [10, 30]);
      releaseAt(handle(), 30);
      await flushTasks(2);
      expect(popup().open).toBe(true);
      expect(popup()).not.toHaveAttribute("data-swiping");
      expect(swipeVars()).toEqual(NO_VARS);
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it("a short flick closes", async () => {
      const user = setupUser();
      const onOpenChange = vi.fn();
      render(<Sheet root={{ defaultOpen: false, onOpenChange }} />);
      await openSheet(user);
      dragBy(handle(), [10, 20, 30], { step: 5 });
      releaseAt(handle(), 35, { hold: 5 });
      await flushTasks(2);
      expect(popup().open).toBe(false);
      expect(onOpenChange).toHaveBeenCalledTimes(1);
    });

    it("moving back at the release returns, however far the drag went", async () => {
      const user = setupUser();
      render(<Sheet root={{ defaultOpen: false }} />);
      await openSheet(user);
      dragBy(handle(), [40, 120, 160]);
      vi.advanceTimersByTime(60);
      swipePointer("pointermove", handle(), 500, 750);
      releaseAt(handle(), 140, { hold: 50 });
      await flushTasks(2);
      expect(popup().open).toBe(true);
    });

    it("controlled: a parent that adopts closes; one that keeps open re-opens (no veto)", async () => {
      const user = setupUser();
      function Controlled({ adopt }: { adopt: boolean }) {
        const [open, setOpen] = useState(false);
        return (
          <Sheet
            root={{
              open,
              openChangeAction: setOpen,
              onOpenChange: (next) => {
                if (adopt) setOpen(next);
              },
            }}
          />
        );
      }
      const showModal = spyShowModal();
      const { unmount } = render(<Controlled adopt />);
      await openSheet(user);
      dragBy(handle(), [20, 80]);
      releaseAt(handle(), 80);
      await flushTasks(2);
      expect(popup().open).toBe(false);
      unmount();

      showModal.mockClear();
      render(<Controlled adopt={false} />);
      await openSheet(user);
      expect(showModal).toHaveBeenCalledTimes(1);
      dragBy(handle(), [20, 80]);
      releaseAt(handle(), 80);
      await flushTasks(2);
      expect(popup().open).toBe(true);
      expect(showModal).toHaveBeenCalledTimes(2);
      expect(swipeVars()).toEqual(NO_VARS);
    });

    it("JS-free mode: the same gesture closes the dialog", async () => {
      render(<Sheet />);
      await act(async () => popup().showModal());
      mockPopupRect();
      dragBy(handle(), [20, 80]);
      releaseAt(handle(), 80);
      await flushTasks(2);
      expect(popup().open).toBe(false);
    });

    it("swipeDismiss={false}: a drag does nothing", async () => {
      const user = setupUser();
      render(<Sheet root={{ defaultOpen: false }} popup={{ swipeDismiss: false }} />);
      await openSheet(user);
      dragBy(handle(), [20, 80]);
      expect(popup()).not.toHaveAttribute("data-swiping");
      releaseAt(handle(), 80);
      await flushTasks(2);
      expect(popup().open).toBe(true);
      expect(swipeVars()).toEqual(NO_VARS);
    });

    it.each([
      ["top", 0, -80, "0px", "-80px"],
      ["left", -80, 0, "-80px", "0px"],
      ["right", 80, 0, "80px", "0px"],
    ] as const)("side=%s swipes toward its edge", async (side, dx, dy, x, y) => {
      const user = setupUser();
      const rects = {
        top: { left: 0, top: 0, right: 1024, bottom: 200, width: 1024, height: 200 },
        left: { left: 0, top: 0, right: 300, bottom: 768, width: 300, height: 768 },
        right: { left: 724, top: 0, right: 1024, bottom: 768, width: 300, height: 768 },
      };
      render(<Sheet root={{ defaultOpen: false }} popup={{ side }} />);
      await openSheet(user);
      mockPopupRect(popup(), rects[side]);
      swipePointer("pointerdown", handle(), 500, 100);
      for (const f of [0.1, 0.5, 1]) {
        vi.advanceTimersByTime(10);
        swipePointer("pointermove", handle(), 500 + dx * f, 100 + dy * f);
      }
      expect(swipeVars()).toMatchObject({ x, y });
      vi.advanceTimersByTime(200);
      swipePointer("pointerup", handle(), 500 + dx, 100 + dy);
      await flushTasks(2);
      expect(popup().open).toBe(false);
    });

    it("inline-end follows the drawer's direction: left in a right-to-left drawer", async () => {
      const user = setupUser();
      render(
        <Sheet
          root={{ defaultOpen: false }}
          popup={{ side: "inline-end", dir: "rtl", style: { direction: "rtl" } }}
        />,
      );
      await openSheet(user);
      mockPopupRect(popup(), { left: 0, top: 0, right: 300, bottom: 768, width: 300, height: 768 });
      swipePointer("pointerdown", handle(), 200, 100);
      for (const x of [190, 150, 100]) {
        vi.advanceTimersByTime(10);
        swipePointer("pointermove", handle(), x, 100);
      }
      expect(swipeVars()).toMatchObject({ x: "-100px", y: "0px" });
      releaseAt(handle(), 0, { dx: -400 });
      await flushTasks(2);
      expect(popup().open).toBe(false);
    });

    it("a drag across the axis or away from the edge does not move the drawer", async () => {
      const user = setupUser();
      render(<Sheet root={{ defaultOpen: false }} />);
      await openSheet(user);
      dragBy(handle(), [-10, -40]);
      dragBy(handle(), [0, 60], { dx: 30 });
      expect(popup()).not.toHaveAttribute("data-swiping");
      releaseAt(handle(), 60, { dx: 30 });
      await flushTasks(2);
      expect(popup().open).toBe(true);
    });
  });

  describe("not a candidate (design 4.1, 5.1, 8.1)", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    async function expectNoSwipe(target: () => Element): Promise<void> {
      dragBy(target(), [20, 80]);
      expect(popup()).not.toHaveAttribute("data-swiping");
      releaseAt(target(), 80);
      await flushTasks(2);
      expect(popup().open).toBe(true);
    }

    it("a press in a text field, a select or a contenteditable", async () => {
      const user = setupUser();
      render(
        <Sheet root={{ defaultOpen: false }}>
          <input data-testid="input" />
          <select data-testid="select" />
          <div contentEditable suppressContentEditableWarning data-testid="editable">
            <b data-testid="bold">x</b>
          </div>
        </Sheet>,
      );
      await openSheet(user);
      await expectNoSwipe(() => screen.getByTestId("input"));
      await expectNoSwipe(() => screen.getByTestId("select"));
      await expectNoSwipe(() => screen.getByTestId("bold"));
    });

    it("a press inside a scroll container along the drawer's axis, whatever it overflows", async () => {
      const user = setupUser();
      render(
        <Sheet root={{ defaultOpen: false }}>
          <div data-testid="body" style={{ overflowY: "auto" }}>
            <p data-testid="row">Row</p>
          </div>
          <div data-testid="carousel" style={{ overflowX: "auto" }}>
            <p data-testid="slide">Slide</p>
          </div>
        </Sheet>,
      );
      await openSheet(user);
      await expectNoSwipe(() => screen.getByTestId("row"));
      // A horizontal scroller is not on a bottom drawer's axis.
      dragBy(screen.getByTestId("slide"), [20, 80]);
      expect(popup()).toHaveAttribute("data-swiping");
      releaseAt(screen.getByTestId("slide"), 80);
      await flushTasks(2);
      expect(popup().open).toBe(false);
    });

    it("a press in a nested dialog or an open popover", async () => {
      const user = setupUser();
      render(
        <Sheet root={{ defaultOpen: false }}>
          <Dialog.Root defaultOpen={false}>
            <Dialog.Popup data-testid="inner" aria-label="Inner" keepMounted>
              <span data-testid="inner-content">inner</span>
            </Dialog.Popup>
          </Dialog.Root>
          <div popover="manual" data-testid="tip">
            <span data-testid="tip-content">tip</span>
          </div>
        </Sheet>,
      );
      await openSheet(user);
      const inner = screen.getByTestId("inner") as HTMLDialogElement;
      await act(async () => inner.showModal());
      await expectNoSwipe(() => screen.getByTestId("inner-content"));
      await act(async () => inner.close());
      await flushTasks(2);
      act(() => screen.getByTestId("tip").showPopover());
      await expectNoSwipe(() => screen.getByTestId("tip-content"));
      act(() => screen.getByTestId("tip").hidePopover());
      // Closed, the same element is part of the drawer.
      dragBy(screen.getByTestId("tip-content"), [20, 80]);
      expect(popup()).toHaveAttribute("data-swiping");
    });

    it("a press on the backdrop", async () => {
      const user = setupUser();
      render(<Sheet root={{ defaultOpen: false }} popup={{ lightDismiss: false }} />);
      await openSheet(user);
      swipePointer("pointerdown", popup(), 500, 100);
      vi.advanceTimersByTime(10);
      swipePointer("pointermove", popup(), 500, 200);
      expect(popup()).not.toHaveAttribute("data-swiping");
      swipePointer("pointerup", popup(), 500, 200);
    });

    it("a press whose pointerdown a consumer prevented", async () => {
      const user = setupUser();
      render(
        <Sheet root={{ defaultOpen: false }}>
          <div data-testid="map" onPointerDown={(event) => event.preventDefault()} />
        </Sheet>,
      );
      await openSheet(user);
      await expectNoSwipe(() => screen.getByTestId("map"));
    });
  });

  describe("aborts (design 4.1, 11)", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("pointercancel returns the drawer", async () => {
      const user = setupUser();
      render(<Sheet root={{ defaultOpen: false }} />);
      await openSheet(user);
      dragBy(handle(), [20, 120]);
      swipePointer("pointercancel", handle(), 500, 720);
      expect(popup()).not.toHaveAttribute("data-swiping");
      expect(swipeVars()).toEqual(NO_VARS);
      expect(popup().open).toBe(true);
    });

    it("Escape during a drag: one fact, with the close event; the gesture ends", async () => {
      const user = setupUser();
      const onOpenChange = vi.fn<DrawerActionFn>();
      render(<Sheet root={{ defaultOpen: false, onOpenChange }} />);
      await openSheet(user);
      dragBy(handle(), [20, 120]);
      act(() => popup().requestClose());
      expect(popup()).not.toHaveAttribute("data-swiping");
      // The closing frame keeps the offset; the close event removes it.
      expect(swipeVars().y).toBe("120px");
      await flushTasks(2);
      expect(swipeVars()).toEqual(NO_VARS);
      releaseAt(document.body, 120);
      await flushTasks(2);
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange.mock.calls[0]![1].event?.type).toBe("close");
    });

    it("a consumer's onCancel that prevents the close: the drawer slides back and stays open", async () => {
      const user = setupUser();
      let refusedOnce = false;
      const onOpenChange = vi.fn();
      render(
        <Sheet
          root={{ defaultOpen: false, onOpenChange }}
          popup={{
            onCancel: (event) => {
              if (!refusedOnce) event.preventDefault();
              refusedOnce = true;
            },
          }}
        />,
      );
      await openSheet(user);
      dragBy(handle(), [20, 120]);
      releaseAt(handle(), 120);
      await flushTasks(2);
      expect(popup().open).toBe(true);
      expect(swipeVars()).toEqual(NO_VARS);
      expect(onOpenChange).not.toHaveBeenCalled();
      // The stale intent is gone: a later Escape is reported with its own event.
      act(() => popup().requestClose());
      await flushTasks(2);
      expect(onOpenChange.mock.calls[0]![1].event?.type).toBe("close");
    });

    it("children re-rendering during a drag change nothing", async () => {
      const user = setupUser();
      const ticker: { bump?: () => void } = {};
      function Ticker() {
        const [n, setN] = useState(0);
        useEffect(() => {
          ticker.bump = () => setN((v) => v + 1);
        });
        return <span>{n}</span>;
      }
      render(
        <Sheet root={{ defaultOpen: false }}>
          <Ticker />
        </Sheet>,
      );
      await openSheet(user);
      dragBy(handle(), [20, 80]);
      act(() => ticker.bump!());
      expect(popup()).toHaveAttribute("data-swiping");
      expect(swipeVars().y).toBe("80px");
    });
  });

  describe("async walkthroughs (design 11)", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("a swipe while a Close action is pending: the fact supersedes, the action keeps running", async () => {
      const user = setupUser();
      const onOpenChange = vi.fn();
      const save = deferred();
      const action = vi.fn(() => save.promise);
      render(
        <Drawer.Root defaultOpen={false} onOpenChange={onOpenChange}>
          <Drawer.Trigger data-testid="trigger">Edit</Drawer.Trigger>
          <Drawer.Popup data-testid="popup" aria-label="Edit">
            <div data-testid="handle" />
            <Drawer.Close data-testid="save" action={action}>
              Save
            </Drawer.Close>
          </Drawer.Popup>
        </Drawer.Root>,
      );
      await openSheet(user);
      await user.click(screen.getByTestId("save"));
      expectPending(screen.getByTestId("save"));
      dragBy(handle(), [20, 80]);
      releaseAt(handle(), 80);
      await flushTasks(2);
      expect(popup().open).toBe(false);
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      const showModal = spyShowModal();
      const close = spyClose();
      await act(async () => save.resolve());
      await flushTasks(2);
      expect(action).toHaveBeenCalledTimes(1);
      expect(close).not.toHaveBeenCalled();
      expect(showModal).not.toHaveBeenCalled();
    });

    it("a swipe while openChangeAction(false) is awaited is reported at once", async () => {
      const user = setupUser();
      const closing = deferred();
      const openChangeAction = vi.fn<DrawerActionFn>((next) =>
        next ? undefined : closing.promise,
      );
      const onOpenChange = vi.fn<DrawerActionFn>();
      render(<Sheet root={{ defaultOpen: false, openChangeAction, onOpenChange }} />);
      await openSheet(user);
      await user.click(screen.getByTestId("close"));
      expectPending(trigger());
      expect(popup().open).toBe(true);
      dragBy(handle(), [20, 80]);
      releaseAt(handle(), 80);
      await flushTasks(2);
      expect(popup().open).toBe(false);
      expect(onOpenChange).toHaveBeenCalledWith(
        false,
        expect.objectContaining({ reason: "dismiss" }),
      );
      await act(async () => closing.resolve());
      await flushTasks(2);
      expect(popup().open).toBe(false);
      expectNotPending(trigger());
    });
  });

  describe("development warnings (design 5.1, 7)", () => {
    it("warns once when a swiping drawer has shown without a Close part", async () => {
      const user = setupUser();
      const error = silenceErrors();
      render(
        <Drawer.Root defaultOpen={false}>
          <Drawer.Trigger data-testid="trigger">Open</Drawer.Trigger>
          <Drawer.Popup data-testid="popup" aria-label="No close" />
        </Drawer.Root>,
      );
      await user.click(trigger());
      await flushTasks(2);
      expect(error).not.toHaveBeenCalled();
      act(() => popup().requestClose());
      await flushTasks(2);
      expect(error).toHaveBeenCalledTimes(1);
      expect(String(error.mock.calls[0]![0])).toContain(
        "Drawer.Popup: the drawer has no Drawer.Close",
      );
      await user.click(trigger());
      await flushTasks(2);
      act(() => popup().requestClose());
      await flushTasks(2);
      expect(error).toHaveBeenCalledTimes(1);
    });

    it("no warning with a Drawer.Close or a Dialog.Close, or without the swipe", async () => {
      const user = setupUser();
      const error = silenceErrors();
      const cases = [
        <Drawer.Popup data-testid="popup" aria-label="a" key="a">
          <Drawer.Close>Done</Drawer.Close>
        </Drawer.Popup>,
        <Drawer.Popup data-testid="popup" aria-label="b" key="b">
          <Dialog.Close>Done</Dialog.Close>
        </Drawer.Popup>,
        <Drawer.Popup data-testid="popup" aria-label="c" key="c" swipeDismiss={false} />,
      ];
      for (const popupElement of cases) {
        const { unmount } = render(
          <Drawer.Root defaultOpen={false}>
            <Drawer.Trigger data-testid="trigger">Open</Drawer.Trigger>
            {popupElement}
          </Drawer.Root>,
        );
        await user.click(trigger());
        await flushTasks(2);
        act(() => popup().requestClose());
        await flushTasks(2);
        unmount();
      }
      expect(error).not.toHaveBeenCalled();
    });

    it("warns once when a top or bottom drawer scrolls itself", async () => {
      const user = setupUser();
      const error = silenceErrors();
      vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(900);
      vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(400);
      const { unmount } = render(
        <Sheet
          root={{ defaultOpen: false }}
          popup={{ side: "inline-end", style: { overflowY: "auto" } }}
        />,
      );
      await user.click(trigger());
      await flushTasks(2);
      expect(error).not.toHaveBeenCalled();
      unmount();
      render(<Sheet root={{ defaultOpen: false }} popup={{ style: { overflowY: "auto" } }} />);
      await user.click(trigger());
      await flushTasks(2);
      expect(error).toHaveBeenCalledTimes(1);
      expect(String(error.mock.calls[0]![0])).toContain(
        "this bottom drawer scrolls its own content",
      );
    });
  });
});

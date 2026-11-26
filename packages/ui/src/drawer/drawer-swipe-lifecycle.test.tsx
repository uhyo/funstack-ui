// Drawer swipe rows about the gesture's lifetime (jsdom, design/components/drawer.md 4.2, 5.1):
// the release that waits for a slide (a fake finite animation stands in for the consumer's
// `translate` transition, which jsdom cannot run), a press during that wait, a release that
// outlives its showing, unmount and a `side` change during a drag and during the wait, and the
// development warning for a vertical list in a side drawer. Synthetic pointer events and a fake
// `Date` (jsdom's `timeStamp`), as in drawer.test.tsx.
import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dragBy,
  drawerPopup as popup,
  mockPopupRect,
  releaseAt,
} from "../__tests__/drawer-harness.js";
import { deferred, flushTasks, setupUser, silenceErrors } from "../__tests__/helpers.js";
import { Drawer } from "./index.js";
import type { DrawerPopupProps, DrawerRootProps, DrawerSide } from "./index.js";

const handle = () => screen.getByTestId("handle");
const swipeY = () => popup().style.getPropertyValue("--drawer-swipe-y");

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
        <Drawer.Title>Filters</Drawer.Title>
        <div data-testid="handle" />
        {children}
        <Drawer.Close>Done</Drawer.Close>
      </Drawer.Popup>
    </Drawer.Root>
  );
}

async function open(user: ReturnType<typeof setupUser>): Promise<void> {
  await user.click(screen.getByTestId("trigger"));
  await flushTasks(2);
  expect(popup().open).toBe(true);
  mockPopupRect();
}

/**
 * The slide a release starts: the dialog's `getAnimations()` returns nothing for the baseline
 * read and then one finite animation that finishes when `finish()` is called.
 */
function fakeSlide(): { finish: () => Promise<void> } {
  const done = deferred();
  const animation = {
    finished: done.promise,
    effect: { getComputedTiming: () => ({ endTime: 300 }) },
  } as unknown as Animation;
  const element = popup();
  let calls = 0;
  Object.defineProperty(element, "getAnimations", {
    configurable: true,
    value: () => (calls++ === 0 ? [] : [animation]),
  });
  return {
    finish: async () => {
      await act(async () => done.resolve());
      await flushTasks(2);
    },
  };
}

/** Drags the handle 80 px down (past the quarter of the 200 px sheet) and releases. */
function swipeAway(): void {
  dragBy(handle(), [20, 80]);
  releaseAt(handle(), 80);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("Drawer swipe lifetime (design 4.2)", () => {
  it("the release waits for the slide, then closes; a press meanwhile starts nothing", async () => {
    const user = setupUser();
    const onOpenChange = vi.fn();
    render(<Sheet root={{ defaultOpen: false, onOpenChange }} />);
    await open(user);
    const slide = fakeSlide();
    swipeAway();
    expect(popup().open).toBe(true);
    expect(swipeY()).toBe("200px");

    dragBy(handle(), [20, 60]);
    expect(popup()).not.toHaveAttribute("data-swiping");
    expect(swipeY()).toBe("200px");
    releaseAt(handle(), 60);

    await slide.finish();
    expect(popup().open).toBe(false);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0]![1].event?.type).toBe("pointerup");
  });

  it("a release that outlives its showing does not close the next one", async () => {
    const user = setupUser();
    const onOpenChange = vi.fn();
    render(<Sheet root={{ defaultOpen: false, onOpenChange }} />);
    await open(user);
    const slide = fakeSlide();
    swipeAway();
    // Escape during the slide, then the user opens the drawer again before it settled.
    act(() => popup().requestClose());
    await flushTasks(2);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    await open(user);

    await slide.finish();
    expect(popup().open).toBe(true);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    // The new showing takes a swipe.
    dragBy(handle(), [20, 80]);
    expect(popup()).toHaveAttribute("data-swiping");
  });

  it("unmounting the Popup during a drag or during the slide leaves nothing behind", async () => {
    const user = setupUser();
    const requestClose = vi.spyOn(HTMLDialogElement.prototype, "requestClose");
    function Toggle() {
      const [shown, setShown] = useState(true);
      return (
        <>
          <button type="button" data-testid="remove" onClick={() => setShown(false)}>
            Remove
          </button>
          {shown && <Sheet root={{ defaultOpen: false }} />}
        </>
      );
    }
    const { unmount } = render(<Toggle />);
    await open(user);
    dragBy(handle(), [20, 80]);
    const dialog = popup();
    act(() => screen.getByTestId("remove").click());
    expect(dialog).not.toHaveAttribute("data-swiping");
    expect(dialog.style.getPropertyValue("--drawer-swipe-y")).toBe("");
    unmount();

    render(<Toggle />);
    await open(user);
    const slide = fakeSlide();
    swipeAway();
    act(() => screen.getByTestId("remove").click());
    await slide.finish();
    expect(requestClose).not.toHaveBeenCalled();
  });

  it("a side change during a drag or during the slide ends the gesture; the drawer stays open", async () => {
    const user = setupUser();
    const onOpenChange = vi.fn();
    let setSide!: (side: DrawerSide) => void;
    function Sided() {
      const [side, set] = useState<DrawerSide>("bottom");
      setSide = set;
      return <Sheet root={{ defaultOpen: false, onOpenChange }} popup={{ side }} />;
    }
    render(<Sided />);
    await open(user);
    dragBy(handle(), [20, 80]);
    act(() => setSide("top"));
    expect(popup()).not.toHaveAttribute("data-swiping");
    expect(swipeY()).toBe("");
    releaseAt(handle(), 80);
    await flushTasks(2);
    expect(popup().open).toBe(true);

    act(() => setSide("bottom"));
    const slide = fakeSlide();
    swipeAway();
    act(() => setSide("top"));
    expect(swipeY()).toBe("");
    await slide.finish();
    expect(popup().open).toBe(true);
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe("Drawer: a vertical list in a side drawer (design 5.1)", () => {
  it("warns once when a press is refused by a list that scrolls only vertically", async () => {
    const user = setupUser();
    const error = silenceErrors();
    render(
      <Sheet root={{ defaultOpen: false }} popup={{ side: "right" }}>
        {/* What `overflow-y: auto` computes to in a browser. */}
        <div style={{ overflowX: "auto", overflowY: "auto" }}>
          <p data-testid="row">Row</p>
        </div>
        <div style={{ overflowX: "hidden", overflowY: "auto" }}>
          <p data-testid="fixed-row">Row</p>
        </div>
      </Sheet>,
    );
    await open(user);
    dragBy(screen.getByTestId("row"), [0], { dx: 40 });
    releaseAt(screen.getByTestId("row"), 0, { dx: 40 });
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0]![0])).toContain(
      "`overflow-x: hidden; touch-action: pan-y pinch-zoom`",
    );
    dragBy(screen.getByTestId("row"), [0], { dx: 40 });
    releaseAt(screen.getByTestId("row"), 0, { dx: 40 });
    expect(error).toHaveBeenCalledTimes(1);

    // The recipe: the list drags.
    swipeFrom(screen.getByTestId("fixed-row"));
    expect(popup()).toHaveAttribute("data-swiping");
  });

  it("no warning for a bottom drawer's list, or a list that overflows horizontally", async () => {
    const user = setupUser();
    const error = silenceErrors();
    const { unmount } = render(
      <Sheet root={{ defaultOpen: false }}>
        <div style={{ overflowX: "auto", overflowY: "auto" }}>
          <p data-testid="row">Row</p>
        </div>
      </Sheet>,
    );
    await open(user);
    dragBy(screen.getByTestId("row"), [20, 80]);
    releaseAt(screen.getByTestId("row"), 80);
    unmount();

    render(
      <Sheet root={{ defaultOpen: false }} popup={{ side: "right" }}>
        <div data-testid="carousel" style={{ overflowX: "auto", overflowY: "auto" }}>
          <p data-testid="slide">Slide</p>
        </div>
      </Sheet>,
    );
    await open(user);
    const carousel = screen.getByTestId("carousel");
    vi.spyOn(carousel, "scrollWidth", "get").mockReturnValue(900);
    vi.spyOn(carousel, "clientWidth", "get").mockReturnValue(300);
    dragBy(screen.getByTestId("slide"), [0], { dx: 40 });
    releaseAt(screen.getByTestId("slide"), 0, { dx: 40 });
    expect(error).not.toHaveBeenCalled();
  });
});

/** Presses on `target` and drags 40 px to the right (a right drawer's edge). */
function swipeFrom(target: Element): void {
  dragBy(target, [0, 0], { dx: 40 });
}

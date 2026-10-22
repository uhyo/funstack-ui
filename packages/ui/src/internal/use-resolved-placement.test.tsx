// The resolved-placement hook's scroll / resize path (design/conventions.md 13.2), driven
// deterministically in jsdom: `getComputedStyle` is stubbed for the popup (placement-stub), the
// popover shim provides `:popover-open` and the task-queued `toggle`, animation frames are a
// manual queue, and the listener calls are spied. The engines apply a scroll's option only in the
// layout after the event, so the stub is changed between the first and the second frame, which
// is where the hook must see it. The browser rows cover the real engines.
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import { stubComputedPlacement } from "../__tests__/placement-stub.js";
import type { PlacementStub } from "../__tests__/placement-stub.js";
import type { AnchorSide } from "./anchor-position.js";
import { useResolvedPlacement } from "./use-resolved-placement.js";

let renders = 0;

function Probe({ side }: { side: AnchorSide | null }) {
  const { side: resolved, ref } = useResolvedPlacement({ side, align: "center" });
  renders++;
  return <div data-testid="popup" popover="manual" ref={ref} data-side={resolved ?? undefined} />;
}

const popup = () => screen.getByTestId("popup");
const side = () => popup().getAttribute("data-side");
/** Lets the shim's queued `toggle` task run. */
const flush = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
let rafSpy: MockInstance<typeof requestAnimationFrame>;
let cafSpy: MockInstance<typeof cancelAnimationFrame>;
let docAdd: MockInstance<typeof document.addEventListener>;
let docRemove: MockInstance<typeof document.removeEventListener>;
let winAdd: MockInstance<typeof window.addEventListener>;
let winRemove: MockInstance<typeof window.removeEventListener>;
let stub: PlacementStub;

/** Runs the frame callbacks queued so far (not those they queue), as one animation frame. */
const runFrame = () => {
  const due = [...frames.values()];
  frames.clear();
  act(() => {
    for (const callback of due) callback(performance.now());
  });
};

const calls = (spy: MockInstance<(type: string, ...rest: never[]) => void>, type: string) =>
  spy.mock.calls.filter(([t]) => t === type);

const scroll = () => act(() => void document.dispatchEvent(new Event("scroll")));

const show = async () => {
  act(() => popup().showPopover());
  await flush();
};

beforeEach(() => {
  renders = 0;
  frames = new Map();
  nextFrame = 1;
  rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  });
  cafSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    frames.delete(id);
  });
  docAdd = vi.spyOn(document, "addEventListener");
  docRemove = vi.spyOn(document, "removeEventListener");
  winAdd = vi.spyOn(window, "addEventListener");
  winRemove = vi.spyOn(window, "removeEventListener");
  stub = stubComputedPlacement(() => screen.queryByTestId("popup"), { positionArea: "top" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useResolvedPlacement: scroll and resize (conventions 13.2)", () => {
  it("installs the scroll and resize listeners only while shown, and removes the same ones on hide", async () => {
    render(<Probe side="top" />);
    expect(calls(docAdd, "scroll")).toHaveLength(0);
    expect(calls(winAdd, "resize")).toHaveLength(0);

    await show();
    expect(calls(docAdd, "scroll")).toHaveLength(1);
    expect(calls(winAdd, "resize")).toHaveLength(1);
    const [, onScroll, options] = calls(docAdd, "scroll")[0]!;
    expect(options).toEqual({ capture: true, passive: true });
    const [, onResize] = calls(winAdd, "resize")[0]!;

    act(() => popup().hidePopover());
    await flush();
    expect(calls(docRemove, "scroll")).toEqual([["scroll", onScroll, { capture: true }]]);
    expect(calls(winRemove, "resize")).toEqual([["resize", onResize]]);
  });

  it("a scroll reads at once and in the next two frames; the second frame sees the new option", async () => {
    render(<Probe side="top" />);
    await show();
    expect(side()).toBe("top");
    scroll();
    expect(frames.size).toBe(1);
    runFrame();
    // Still the old option in the first frame (the engine lays the new one out after it).
    expect(side()).toBe("top");
    expect(frames.size).toBe(1);
    stub.set({ positionArea: "bottom" });
    runFrame();
    expect(side()).toBe("bottom");
    // The pair is over: nothing more is scheduled.
    expect(frames.size).toBe(0);
    expect(rafSpy).toHaveBeenCalledTimes(2);
  });

  it("a resize on the window takes the same path", async () => {
    render(<Probe side="top" />);
    await show();
    act(() => void window.dispatchEvent(new Event("resize")));
    runFrame();
    stub.set({ positionArea: "bottom" });
    runFrame();
    expect(side()).toBe("bottom");
  });

  it("coalesces: any number of scrolls during a pair add at most one more pair", async () => {
    render(<Probe side="top" />);
    await show();
    scroll();
    scroll();
    scroll();
    expect(rafSpy).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(1);
    runFrame();
    runFrame();
    // The later scrolls restart the pair once, at its end.
    expect(frames.size).toBe(1);
    runFrame();
    runFrame();
    expect(frames.size).toBe(0);
    expect(rafSpy).toHaveBeenCalledTimes(4);
  });

  it("a scroll during a pending pair runs one more pair after it", async () => {
    render(<Probe side="top" />);
    await show();
    scroll();
    runFrame();
    // Between the two frames: two more scrolls, one restart.
    scroll();
    scroll();
    expect(frames.size).toBe(1);
    runFrame();
    expect(frames.size).toBe(1);
    runFrame();
    expect(side()).toBe("top");
    stub.set({ positionArea: "bottom" });
    runFrame();
    expect(side()).toBe("bottom");
    expect(frames.size).toBe(0);
    expect(rafSpy).toHaveBeenCalledTimes(4);
  });

  it("hide cancels the pending frame and removes the listeners; no read after", async () => {
    render(<Probe side="top" />);
    await show();
    scroll();
    const pending = [...frames.keys()][0];
    act(() => popup().hidePopover());
    await flush();
    expect(cafSpy).toHaveBeenCalledWith(pending);
    expect(frames.size).toBe(0);
    expect(calls(docRemove, "scroll")).toHaveLength(1);
    expect(calls(winRemove, "resize")).toHaveLength(1);
    const reads = stub.calls();
    scroll();
    expect(frames.size).toBe(0);
    expect(stub.calls()).toBe(reads);
  });

  it("unmount cancels the pending frame and removes the listeners; no read after", async () => {
    const { unmount } = render(<Probe side="top" />);
    await show();
    scroll();
    runFrame();
    const pending = [...frames.keys()][0];
    expect(pending).toBeDefined();
    unmount();
    expect(cafSpy).toHaveBeenCalledWith(pending);
    expect(frames.size).toBe(0);
    expect(calls(docRemove, "scroll")).toHaveLength(1);
    expect(calls(winRemove, "resize")).toHaveLength(1);
    const reads = stub.calls();
    act(() => {
      document.dispatchEvent(new Event("scroll"));
      window.dispatchEvent(new Event("resize"));
    });
    expect(frames.size).toBe(0);
    expect(stub.calls()).toBe(reads);
  });

  it("side={null} while shown removes the listeners and cancels the pending frame", async () => {
    const { rerender } = render(<Probe side="top" />);
    await show();
    scroll();
    rerender(<Probe side={null} />);
    expect(calls(docRemove, "scroll")).toHaveLength(1);
    expect(calls(winRemove, "resize")).toHaveLength(1);
    expect(cafSpy).toHaveBeenCalled();
    expect(frames.size).toBe(0);
  });

  it("a first frame that finds the popup hidden schedules no second frame", async () => {
    render(<Probe side="top" />);
    await show();
    scroll();
    // Hidden, but the shim's `toggle` task has not run yet: the first frame is the one to notice.
    act(() => popup().hidePopover());
    runFrame();
    expect(frames.size).toBe(0);
    expect(rafSpy).toHaveBeenCalledTimes(1);
    expect(calls(docRemove, "scroll")).toHaveLength(1);
    await flush();
  });
});

describe("useResolvedPlacement: costs", () => {
  it("a hidden popup never forces a layout on mount or on a request change", () => {
    const rects = vi.spyOn(Element.prototype, "getClientRects");
    const { rerender } = render(<Probe side="top" />);
    rerender(<Probe side="bottom" />);
    expect(rects).not.toHaveBeenCalled();
  });

  it("a physical side shown where it was asked renders nothing on show or hide", async () => {
    render(<Probe side="top" />);
    const before = renders;
    await show();
    act(() => popup().hidePopover());
    await flush();
    expect(renders).toBe(before);
  });

  it("a logical side renders exactly once on show and once on hide (data-side turns physical)", async () => {
    stub.set({ positionArea: "self-x-end", direction: "ltr" });
    render(<Probe side="inline-end" />);
    expect(side()).toBe("inline-end");
    const before = renders;
    await show();
    expect(side()).toBe("right");
    expect(renders).toBe(before + 1);
    act(() => popup().hidePopover());
    await flush();
    expect(side()).toBe("inline-end");
    expect(renders).toBe(before + 2);
  });
});

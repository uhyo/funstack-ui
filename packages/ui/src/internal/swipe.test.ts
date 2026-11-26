// The swipe tracker (design/components/drawer.md 4.1, 9) on a plain element, with synthetic
// pointer events: what starts a drag, what drops a press, the release decision and the aborts.
// jsdom's `Event.timeStamp` is `Date.now()`, so fake timers drive the velocity. Real pointer
// input in three engines is drawer.browser.test.tsx.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { capturedPointers } from "../__tests__/pointer-capture-shim.js";
import { trackSwipe } from "./swipe.js";
import type { SwipeEnd, SwipeTrackerOptions } from "./swipe.js";

let element: HTMLDivElement;
let inner: HTMLButtonElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  element = document.createElement("div");
  inner = document.createElement("button");
  element.append(inner);
  document.body.append(element);
});

afterEach(() => {
  vi.useRealTimers();
  element.remove();
});

interface PointerInit {
  pointerId?: number;
  pointerType?: string;
  isPrimary?: boolean;
  button?: number;
}

function fire(
  type: string,
  target: EventTarget,
  x: number,
  y: number,
  init: PointerInit = {},
): PointerEvent {
  const event = new PointerEvent(type, {
    pointerId: init.pointerId ?? 1,
    pointerType: init.pointerType ?? "mouse",
    isPrimary: init.isPrimary ?? true,
    button: init.button ?? 0,
    clientX: x,
    clientY: y,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

function setup(overrides: Partial<SwipeTrackerOptions> = {}) {
  const calls = {
    start: vi.fn(),
    move: vi.fn<(offset: number, progress: number) => void>(),
    end: vi.fn<(end: SwipeEnd) => void>(),
  };
  const tracker = trackSwipe(element, {
    press: () => "down",
    extent: () => 200,
    start: calls.start,
    move: calls.move,
    end: calls.end,
    ...overrides,
  });
  return { tracker, ...calls };
}

/** Press at (0, 0) on `inner`, then move down to each y, `step` ms apart. */
function drag(ys: readonly number[], step = 10, init?: PointerInit): void {
  fire("pointerdown", inner, 0, 0, init);
  for (const y of ys) {
    vi.advanceTimersByTime(step);
    fire("pointermove", document, 0, y, init);
  }
}

describe("trackSwipe", () => {
  it("a press alone is only recorded: no capture, no start, the pointerdown is not prevented", () => {
    const { start } = setup();
    const down = fire("pointerdown", inner, 0, 0);
    expect(down.defaultPrevented).toBe(false);
    expect(capturedPointers.size).toBe(0);
    fire("pointermove", document, 0, 5);
    expect(start).not.toHaveBeenCalled();
  });

  it("starts after 6 px toward the edge, captures the pointer on the element and reports offsets", () => {
    const { tracker, start, move } = setup();
    drag([3, 8]);
    expect(start).toHaveBeenCalledTimes(1);
    expect(capturedPointers.get(1)).toBe(element);
    expect(tracker.dragging()).toBe(true);
    expect(move).toHaveBeenLastCalledWith(8, 0.04, expect.any(PointerEvent));
    vi.advanceTimersByTime(10);
    fire("pointermove", document, 0, -30);
    // Never below 0.
    expect(move).toHaveBeenLastCalledWith(0, 0, expect.any(PointerEvent));
  });

  it("a first move across the axis or away from the edge drops the press for good", () => {
    const { start } = setup();
    drag([0, 0]);
    fire("pointermove", document, 10, 0);
    fire("pointermove", document, 10, 60);
    fire("pointermove", document, 10, 100);
    expect(start).not.toHaveBeenCalled();
    fire("pointerup", document, 10, 100);
    fire("pointerdown", inner, 0, 0);
    fire("pointermove", document, 0, -10);
    fire("pointermove", document, 0, 50);
    expect(start).not.toHaveBeenCalled();
  });

  it("ignores a non-primary pointer, another button, and a press the caller rejects", () => {
    const { start } = setup({ press: (event) => (event.target === inner ? "down" : null) });
    drag([20], 10, { isPrimary: false });
    fire("pointerup", document, 0, 20, { isPrimary: false });
    drag([20], 10, { button: 2 });
    fire("pointerup", document, 0, 20, { button: 2 });
    fire("pointerdown", element, 0, 0);
    fire("pointermove", document, 0, 20);
    expect(start).not.toHaveBeenCalled();
  });

  it("a pointerdown prevented after the capture-phase listener (a consumer's opt-out) never starts", () => {
    const { start } = setup();
    inner.addEventListener("pointerdown", (event) => event.preventDefault(), { once: true });
    drag([20]);
    expect(start).not.toHaveBeenCalled();
  });

  it("another element taking the capture never starts; a touch press's implicit capture does not count", () => {
    const { start } = setup();
    fire("pointerdown", inner, 0, 0);
    const other = document.createElement("span");
    element.append(other);
    other.dispatchEvent(new PointerEvent("gotpointercapture", { pointerId: 1, bubbles: true }));
    fire("pointermove", document, 0, 20);
    expect(start).not.toHaveBeenCalled();
    fire("pointerup", document, 0, 20);

    fire("pointerdown", inner, 0, 0, { pointerType: "touch" });
    inner.dispatchEvent(new PointerEvent("gotpointercapture", { pointerId: 1, bubbles: true }));
    fire("pointermove", document, 0, 20, { pointerType: "touch" });
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("a mouse press that made a text selection never starts; a selection it found does not count", () => {
    const { start } = setup();
    const text = document.createElement("p");
    text.textContent = "Some text to select";
    element.append(text);
    const select = () => {
      const range = document.createRange();
      range.setStart(text.firstChild!, 0);
      range.setEnd(text.firstChild!, 4);
      document.getSelection()!.removeAllRanges();
      document.getSelection()!.addRange(range);
    };
    fire("pointerdown", inner, 0, 0);
    select();
    fire("pointermove", document, 0, 20);
    expect(start).not.toHaveBeenCalled();
    fire("pointerup", document, 0, 20);

    // Found at the press and unchanged (a press on a `user-select: none` grabber).
    drag([20]);
    expect(start).toHaveBeenCalledTimes(1);
    document.getSelection()!.removeAllRanges();
  });

  it("dismisses at a quarter of the extent, after a slow drag", () => {
    const { end } = setup();
    drag([10, 30, 50]);
    vi.advanceTimersByTime(200);
    fire("pointerup", document, 0, 50);
    expect(end).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "dismiss", offset: 50, extent: 200 }),
    );
    expect(end.mock.calls[0]![0].event.type).toBe("pointerup");
  });

  it("returns short of it, and dismisses a short flick", () => {
    const { end } = setup();
    drag([10, 30]);
    vi.advanceTimersByTime(200);
    fire("pointerup", document, 0, 30);
    expect(end).toHaveBeenLastCalledWith(expect.objectContaining({ outcome: "return" }));

    drag([10, 20, 30], 5);
    fire("pointerup", document, 0, 30);
    expect(end).toHaveBeenLastCalledWith(expect.objectContaining({ outcome: "dismiss" }));
  });

  it("returns when the pointer was moving back at the release, however far it went", () => {
    const { end } = setup();
    drag([20, 80, 150, 180]);
    // The velocity is over the last 100 ms: here from the move at 170 to the release at 160.
    vi.advanceTimersByTime(60);
    fire("pointermove", document, 0, 170);
    vi.advanceTimersByTime(50);
    fire("pointerup", document, 0, 160);
    expect(end).toHaveBeenLastCalledWith(expect.objectContaining({ outcome: "return" }));
  });

  it("pointercancel, a lost capture and a second primary press cancel", () => {
    const { end } = setup();
    drag([20]);
    fire("pointercancel", document, 0, 20);
    expect(end).toHaveBeenLastCalledWith(expect.objectContaining({ outcome: "cancel" }));

    drag([20]);
    element.dispatchEvent(new PointerEvent("lostpointercapture", { pointerId: 1 }));
    expect(end).toHaveBeenLastCalledWith(expect.objectContaining({ outcome: "cancel" }));

    drag([20]);
    fire("pointerdown", inner, 0, 0, { pointerId: 2, pointerType: "pen" });
    expect(end).toHaveBeenLastCalledWith(expect.objectContaining({ outcome: "cancel" }));
    expect(end).toHaveBeenCalledTimes(3);
  });

  it("cancel() and dispose() end without calling end and release the capture", () => {
    const { tracker, end, start } = setup();
    drag([20]);
    tracker.cancel();
    expect(tracker.dragging()).toBe(false);
    expect(capturedPointers.size).toBe(0);
    fire("pointerup", document, 0, 20);
    drag([20]);
    tracker.dispose();
    fire("pointerup", document, 0, 20);
    drag([20]);
    expect(end).not.toHaveBeenCalled();
    expect(start).toHaveBeenCalledTimes(2);
  });
});

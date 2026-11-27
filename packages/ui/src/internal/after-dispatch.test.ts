import { afterEach, describe, expect, it, vi } from "vitest";
import { afterDispatch } from "./after-dispatch.js";

const microtask = () => Promise.resolve();

describe("afterDispatch", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("a script-dispatched event: runs in the microtask, after a later ancestor listener", async () => {
    const parent = document.createElement("div");
    const child = document.createElement("span");
    parent.append(child);
    document.body.append(parent);
    const order: string[] = [];
    child.addEventListener("reset", (event) => {
      afterDispatch(event, () => order.push(`callback:${event.eventPhase}`));
    });
    parent.addEventListener("reset", () => order.push("ancestor"));
    child.dispatchEvent(new Event("reset", { bubbles: true }));
    order.push("dispatched");
    expect(order).toEqual(["ancestor", "dispatched"]);
    await microtask();
    expect(order).toEqual(["ancestor", "dispatched", `callback:${Event.NONE}`]);
    parent.remove();
  });

  it("cancel before the microtask: never runs", async () => {
    const callback = vi.fn();
    const target = document.createElement("div");
    let cancel = () => {};
    target.addEventListener("reset", (event) => {
      cancel = afterDispatch(event, callback);
    });
    target.dispatchEvent(new Event("reset"));
    cancel();
    await microtask();
    await new Promise((r) => setTimeout(r, 0));
    expect(callback).not.toHaveBeenCalled();
  });

  // A dispatch still running at the microtask checkpoint (only a real click gives one; the
  // browser rows in form-reset-button.browser.test.tsx) is modelled by an event whose phase is
  // not NONE: the callback waits for a task.
  describe("an event still dispatching at the microtask", () => {
    const dispatching = { eventPhase: Event.AT_TARGET } as Event;

    it("runs in a task, not in the microtask", async () => {
      vi.useFakeTimers();
      const callback = vi.fn();
      afterDispatch(dispatching, callback);
      await microtask();
      expect(callback).not.toHaveBeenCalled();
      vi.runAllTimers();
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("cancel between the microtask and the task: never runs", async () => {
      vi.useFakeTimers();
      const callback = vi.fn();
      const cancel = afterDispatch(dispatching, callback);
      await microtask();
      cancel();
      vi.runAllTimers();
      expect(callback).not.toHaveBeenCalled();
    });
  });
});

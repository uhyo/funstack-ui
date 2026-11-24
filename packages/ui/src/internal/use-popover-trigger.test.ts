// The Trigger click rule (popover.md 2.8, #115) shared by usePopoverTrigger and Combobox.Trigger.
// The component suites cover the clicks themselves; this pins the decision table.
import { describe, expect, it, vi } from "vitest";
import type { PopoverRootValue } from "./use-overlay-root.js";
import { toggleFromTrigger } from "./use-popover-trigger.js";

function fakeRoot(intended: boolean, hiddenBeforeToggle = false) {
  const calls: string[] = [];
  const ctx = {
    intended: () => intended,
    hiddenBeforeToggle: () => hiddenBeforeToggle,
    recordCloseIntent: vi.fn(() => calls.push("recordCloseIntent")),
    requestClose: vi.fn(() => calls.push("requestClose")),
    requestOpen: vi.fn(() => calls.push("requestOpen")),
  };
  return { ctx: ctx as unknown as PopoverRootValue & typeof ctx, calls };
}

describe("toggleFromTrigger", () => {
  it("intended closed: beforeOpen, then requestOpen as activate", () => {
    const { ctx, calls } = fakeRoot(false);
    const event = new MouseEvent("click");
    toggleFromTrigger(ctx, event, () => calls.push("beforeOpen"));
    expect(calls).toEqual(["beforeOpen", "requestOpen"]);
    expect(ctx.requestOpen).toHaveBeenCalledExactlyOnceWith(event, "activate");
  });

  it("intended closed without beforeOpen: requestOpen only", () => {
    const { ctx, calls } = fakeRoot(false);
    toggleFromTrigger(ctx, new MouseEvent("click"));
    expect(calls).toEqual(["requestOpen"]);
  });

  it("intended open: requestClose as activate, beforeOpen not called", () => {
    const { ctx, calls } = fakeRoot(true);
    const event = new MouseEvent("click");
    const beforeOpen = vi.fn();
    toggleFromTrigger(ctx, event, beforeOpen);
    expect(calls).toEqual(["requestClose"]);
    expect(ctx.requestClose).toHaveBeenCalledExactlyOnceWith(event, "activate");
    expect(beforeOpen).not.toHaveBeenCalled();
  });

  it("intended open but hidden before its toggle (#115): records an activate close intent only", () => {
    const { ctx, calls } = fakeRoot(true, true);
    const event = new MouseEvent("click");
    toggleFromTrigger(ctx, event);
    expect(calls).toEqual(["recordCloseIntent"]);
    expect(ctx.recordCloseIntent).toHaveBeenCalledExactlyOnceWith({ reason: "activate", event });
  });
});

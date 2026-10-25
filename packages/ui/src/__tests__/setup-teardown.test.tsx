// The jsdom side of vitest.setup.ts's per-test teardown (the browser side is in
// environment.browser.test.tsx): the first row leaves elements a test appended itself, one of
// them an open popover; the second asserts that the next row starts with an empty body and no
// popover the shim counts as shown. The rows depend on their order, so the block is never shuffled.
import { describe, expect, it } from "vitest";

describe("per-test teardown (setup file, jsdom)", { shuffle: false }, () => {
  let popover: HTMLElement;

  it("leaves an open raw popover and server HTML in the body", () => {
    popover = document.createElement("div");
    popover.setAttribute("popover", "auto");
    document.body.append(popover);
    popover.showPopover();
    document.body.insertAdjacentHTML("beforeend", '<div id="server-html"></div>');
    expect(popover.matches(":popover-open")).toBe(true);
  });

  it("starts with an empty body and the popover no longer shown", () => {
    expect(document.body.innerHTML).toBe("");
    expect(popover.isConnected).toBe(false);
    expect(popover.matches(":popover-open")).toBe(false);
  });
});

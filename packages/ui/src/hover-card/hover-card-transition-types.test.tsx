// View Transition types of a HoverCard dispatch (design/components/hover-card.md 9, conventions
// 5.3): `fsui-hover-card` plus `-open` for the interest open and `-close` for the cancel of a
// pending open. A user close of a shown card is a fact and carries none. See
// __tests__/transition-type-spy.ts.
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deferred } from "../__tests__/helpers.js";
import { addTransitionTypeSpy, recordedTransitionTypes } from "../__tests__/transition-type-spy.js";
import { HoverCard } from "./index.js";

vi.mock("react", async (importOriginal) => {
  const { withTransitionTypeSpy } = await import("../__tests__/transition-type-spy.js");
  return withTransitionTypeSpy(await importOriginal<typeof import("react")>());
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  addTransitionTypeSpy.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

async function advance(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

function pointer(type: "pointerenter" | "pointerleave", el: Element): void {
  act(() => {
    el.dispatchEvent(new PointerEvent(type, { pointerType: "mouse" }));
  });
}

describe("HoverCard transition types", () => {
  it("open adds fsui-hover-card and fsui-hover-card-open; the cancel of a pending open adds -close", async () => {
    const d = deferred();
    render(
      <HoverCard.Root openChangeAction={(next) => (next ? d.promise : undefined)}>
        <HoverCard.Trigger href="/u/ada">@ada</HoverCard.Trigger>
        <HoverCard.Popup>card</HoverCard.Popup>
      </HoverCard.Root>,
    );
    const link = screen.getByRole("link", { name: "@ada" });
    pointer("pointerenter", link);
    await advance(600);
    expect(recordedTransitionTypes()).toEqual(["fsui-hover-card", "fsui-hover-card-open"]);
    addTransitionTypeSpy.mockClear();
    pointer("pointerleave", link);
    await advance(300);
    expect(recordedTransitionTypes()).toEqual(["fsui-hover-card", "fsui-hover-card-close"]);
    await act(async () => d.resolve());
  });

  it("the close of a shown card is a fact and adds no type", async () => {
    render(
      <HoverCard.Root>
        <HoverCard.Trigger href="/u/ada">@ada</HoverCard.Trigger>
        <HoverCard.Popup>card</HoverCard.Popup>
      </HoverCard.Root>,
    );
    const link = screen.getByRole("link", { name: "@ada" });
    pointer("pointerenter", link);
    await advance(600);
    await advance(1);
    addTransitionTypeSpy.mockClear();
    pointer("pointerleave", link);
    await advance(300);
    await advance(1);
    expect(recordedTransitionTypes()).toEqual([]);
  });
});

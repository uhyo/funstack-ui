// View Transition types of a Drawer dispatch (design/components/drawer.md decision 14,
// conventions 5.3): its own `fsui-drawer` plus `-open` / `-close`, not Dialog's. A swipe and
// Escape are facts and carry none. See __tests__/transition-type-spy.ts.
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPopupRect, releaseAt, dragBy } from "../__tests__/drawer-harness.js";
import { flushTasks, setupUser } from "../__tests__/helpers.js";
import { addTransitionTypeSpy, recordedTransitionTypes } from "../__tests__/transition-type-spy.js";
import { Drawer } from "./index.js";

vi.mock("react", async (importOriginal) => {
  const { withTransitionTypeSpy } = await import("../__tests__/transition-type-spy.js");
  return withTransitionTypeSpy(await importOriginal<typeof import("react")>());
});

beforeEach(() => {
  addTransitionTypeSpy.mockClear();
});

function Sheet() {
  return (
    <Drawer.Root defaultOpen={false}>
      <Drawer.Trigger>Filters</Drawer.Trigger>
      <Drawer.Popup data-testid="popup">
        <Drawer.Title>Filters</Drawer.Title>
        <div data-testid="handle" />
        <Drawer.Close>Done</Drawer.Close>
      </Drawer.Popup>
    </Drawer.Root>
  );
}

const popup = () => screen.getByTestId("popup") as HTMLDialogElement;

async function open(user: ReturnType<typeof setupUser>): Promise<void> {
  await user.click(screen.getByRole("button", { name: "Filters" }));
  await flushTasks(2);
  expect(popup().open).toBe(true);
}

describe("Drawer transition types", () => {
  it("open adds fsui-drawer and fsui-drawer-open; the Close's close adds fsui-drawer-close", async () => {
    const user = setupUser();
    render(<Sheet />);
    await open(user);
    expect(recordedTransitionTypes()).toEqual(["fsui-drawer", "fsui-drawer-open"]);
    addTransitionTypeSpy.mockClear();
    await user.click(screen.getByRole("button", { name: "Done" }));
    await flushTasks(2);
    expect(popup().open).toBe(false);
    expect(recordedTransitionTypes()).toEqual(["fsui-drawer", "fsui-drawer-close"]);
  });

  it("Escape and a swipe are facts and add no type", async () => {
    const user = setupUser();
    render(<Sheet />);
    await open(user);
    addTransitionTypeSpy.mockClear();
    await act(async () => popup().requestClose());
    await flushTasks(2);
    expect(popup().open).toBe(false);

    await open(user);
    addTransitionTypeSpy.mockClear();
    mockPopupRect();
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      dragBy(screen.getByTestId("handle"), [20, 80]);
      releaseAt(screen.getByTestId("handle"), 80);
    } finally {
      vi.useRealTimers();
    }
    await flushTasks(2);
    expect(popup().open).toBe(false);
    expect(recordedTransitionTypes()).toEqual([]);
  });
});

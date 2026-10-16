// Tabs rows that need a real engine (design section 12): the Indicator is placed by CSS Anchor
// Positioning against the optimistic Tab, with no measurement code in the library; a committed
// switch reaches `document.startViewTransition` with the Tabs transition types; a real pointer
// click (mousedown focus, then click) dispatches once.
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { deferred } from "../__tests__/helpers.js";
import { Tabs } from "./index.js";
import type { TabsValueChangeDetails } from "./index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Tabs.Indicator anchor positioning", () => {
  it("is placed under the optimistic tab and moves before the action resolves", async () => {
    const d = deferred();
    render(
      <Tabs.Root defaultValue="a" valueChangeAction={() => d.promise}>
        <Tabs.List aria-label="x" style={{ position: "relative", display: "flex", gap: 40 }}>
          <Tabs.Tab value="a" style={{ width: 60 }}>
            A
          </Tabs.Tab>
          <Tabs.Tab value="b" style={{ width: 120 }}>
            B
          </Tabs.Tab>
          <Tabs.Indicator
            data-testid="indicator"
            style={{
              position: "absolute",
              bottom: 0,
              left: "anchor(left)",
              width: "anchor-size(width)",
              height: 2,
            }}
          />
        </Tabs.List>
      </Tabs.Root>,
    );
    const indicator = screen.getByTestId("indicator");
    const tabA = screen.getByRole("tab", { name: "A" });
    const tabB = screen.getByRole("tab", { name: "B" });

    const expectUnder = (el: HTMLElement) => {
      const a = el.getBoundingClientRect();
      const i = indicator.getBoundingClientRect();
      expect(Math.round(i.left)).toBe(Math.round(a.left));
      expect(Math.round(i.width)).toBe(Math.round(a.width));
    };

    expectUnder(tabA);
    await act(async () => {
      tabB.click();
    });
    // Optimistic: the action is still pending.
    expect(indicator).toHaveAttribute("data-pending", "");
    expectUnder(tabB);
    await act(async () => {
      d.resolve();
    });
    expectUnder(tabB);
  });
});

describe("Tabs view transitions", () => {
  it("a committed switch passes fsui-tabs and the direction type to startViewTransition", async () => {
    const types: string[][] = [];
    const original = document.startViewTransition.bind(document);
    // Record what React passes, then let the real transition run.
    vi.spyOn(document, "startViewTransition").mockImplementation(((
      arg?: StartViewTransitionOptions | ViewTransitionUpdateCallback,
    ) => {
      if (typeof arg === "object" && arg.types != null) types.push([...arg.types]);
      return original(arg);
    }) as typeof document.startViewTransition);

    render(
      <Tabs.Root defaultValue="b" activationMode="manual">
        <Tabs.List aria-label="x">
          <Tabs.Tab value="a">A</Tabs.Tab>
          <Tabs.Tab value="b">B</Tabs.Tab>
          <Tabs.Tab value="c">C</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="a" transition="auto">
          Alpha
        </Tabs.Panel>
        <Tabs.Panel value="b" transition="auto">
          Beta
        </Tabs.Panel>
        <Tabs.Panel value="c" transition="auto">
          Gamma
        </Tabs.Panel>
      </Tabs.Root>,
    );

    await userEvent.click(screen.getByRole("tab", { name: "C" }));
    await expect.poll(() => screen.queryByText("Gamma")).not.toBeNull();
    await expect.poll(() => types.length).toBeGreaterThan(0);
    expect(types.at(-1)).toEqual(expect.arrayContaining(["fsui-tabs", "fsui-tabs-next"]));
    expect(types.at(-1)).not.toContain("fsui-tabs-prev");

    types.length = 0;
    await userEvent.click(screen.getByRole("tab", { name: "A" }));
    await expect.poll(() => screen.queryByText("Alpha")).not.toBeNull();
    await expect.poll(() => types.length).toBeGreaterThan(0);
    expect(types.at(-1)).toEqual(expect.arrayContaining(["fsui-tabs", "fsui-tabs-prev"]));
    expect(types.at(-1)).not.toContain("fsui-tabs-next");
  });
});

describe("Tabs pointer activation", () => {
  it.each(["automatic", "manual"] as const)(
    "%s: a real click dispatches exactly once",
    async (activationMode) => {
      const action = vi.fn<(next: string, details: TabsValueChangeDetails) => void>();
      render(
        <Tabs.Root defaultValue="a" activationMode={activationMode} valueChangeAction={action}>
          <Tabs.List aria-label="x">
            <Tabs.Tab value="a">A</Tabs.Tab>
            <Tabs.Tab value="b">B</Tabs.Tab>
            <Tabs.Tab value="c">C</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );
      const tab = (name: string) => screen.getByRole("tab", { name });

      // Focus comes from outside the list (the body): only the click handler dispatches.
      await userEvent.click(tab("B"));
      await expect.poll(() => tab("B").getAttribute("aria-selected")).toBe("true");
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]?.[0]).toBe("b");

      // Focus moves from B to C on mousedown: in automatic mode the focus handler dispatches and
      // the click is a no-op; in manual mode the click dispatches. Either way exactly once.
      await userEvent.click(tab("C"));
      await expect.poll(() => tab("C").getAttribute("aria-selected")).toBe("true");
      expect(action).toHaveBeenCalledTimes(2);
      expect(action.mock.calls[1]?.[0]).toBe("c");
      expect(action.mock.calls[1]?.[1].event?.type).toBe(
        activationMode === "automatic" ? "focusin" : "click",
      );
    },
  );
});

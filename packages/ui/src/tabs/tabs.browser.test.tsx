// Tabs rows that need a real engine (design section 12): the Indicator is placed by CSS Anchor
// Positioning against the optimistic Tab, with no measurement code in the library; a committed
// switch reaches `document.startViewTransition` with the Tabs transition types; a real pointer
// click (mousedown focus, then click) dispatches once.
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { user } from "../__tests__/browser-user.js";
import { supportsFocusgroup } from "../__tests__/engine.js";
import { deferred } from "../__tests__/helpers.js";
import { Tabs } from "./index.js";
import type { TabsValueChangeDetails } from "./index.js";
import { spyViewTransitions } from "../__tests__/browser-helpers.js";

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
    // Record what React passes, then let the real transition run.
    spyViewTransitions((arg) => {
      if (typeof arg === "object" && arg.types != null) types.push([...arg.types]);
    });

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

    await user.click(screen.getByRole("tab", { name: "C" }));
    await expect.poll(() => screen.queryByText("Gamma")).not.toBeNull();
    await expect.poll(() => types.length).toBeGreaterThan(0);
    expect(types.at(-1)).toEqual(expect.arrayContaining(["fsui-tabs", "fsui-tabs-next"]));
    expect(types.at(-1)).not.toContain("fsui-tabs-prev");

    types.length = 0;
    await user.click(screen.getByRole("tab", { name: "A" }));
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
      await user.click(tab("B"));
      await expect.poll(() => tab("B").getAttribute("aria-selected")).toBe("true");
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]?.[0]).toBe("b");

      // Where mousedown focuses a button, focus moves from B to C before the click: in automatic
      // mode the focus handler dispatches and the click is a no-op; in manual mode the click
      // dispatches. Where it does not (WebKit on macOS follows the platform and leaves buttons
      // unfocused), the click dispatches in both modes. Either way exactly once.
      let focusedBeforeClick = false;
      let clicked = false;
      tab("C").addEventListener("focus", () => (focusedBeforeClick ||= !clicked));
      tab("C").addEventListener("click", () => (clicked = true), { capture: true });
      await user.click(tab("C"));
      await expect.poll(() => tab("C").getAttribute("aria-selected")).toBe("true");
      expect(action).toHaveBeenCalledTimes(2);
      expect(action.mock.calls[1]?.[0]).toBe("c");
      expect(action.mock.calls[1]?.[1].event?.type).toBe(
        activationMode === "automatic" && focusedBeforeClick ? "focusin" : "click",
      );
    },
  );
});

describe("Tabs.List experimental_focusgroup", () => {
  // The feature check itself is pinned per engine in __tests__/environment.browser.test.tsx.
  it.each([
    ["horizontal", "ArrowRight", "ArrowLeft"],
    ["vertical", "ArrowDown", "ArrowUp"],
  ] as const)(
    "%s: arrows, Home and End move focus natively where supported, by JS elsewhere",
    async (orientation, nextKey, prevKey) => {
      const action = vi.fn<(next: string) => void>();
      render(
        <Tabs.Root defaultValue="a" orientation={orientation} valueChangeAction={action}>
          <Tabs.List aria-label="x" experimental_focusgroup>
            <Tabs.Tab value="a">A</Tabs.Tab>
            <Tabs.Tab value="b">B</Tabs.Tab>
            <Tabs.Tab value="c">C</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );
      const tab = (name: string) => screen.getByRole("tab", { name });
      expect(screen.getByRole("tablist")).toHaveAttribute(
        "focusgroup",
        `tablist ${orientation === "vertical" ? "block" : "inline"} wrap nomemory`,
      );
      // Chromium leaves a tabindex=-1 element out of the focusgroup, so on the native path the
      // unselected tabs drop it; elsewhere roving tabindex stays.
      await expect
        .poll(() => tab("B").getAttribute("tabindex"))
        .toBe(supportsFocusgroup ? null : "-1");

      // The JS handler calls preventDefault; the native path leaves the key to the browser's
      // default action, so a bubble listener on the document sees it not prevented.
      const prevented: boolean[] = [];
      const record = (event: KeyboardEvent) => prevented.push(event.defaultPrevented);
      document.addEventListener("keydown", record);
      try {
        await user.click(tab("A"));
        await expect.poll(() => document.activeElement).toBe(tab("A"));

        await user.keyboard(`{${nextKey}}`);
        await expect.poll(() => document.activeElement).toBe(tab("B"));
        await expect.poll(() => tab("B").getAttribute("aria-selected")).toBe("true");
        await user.keyboard("{End}");
        await expect.poll(() => document.activeElement).toBe(tab("C"));
        await user.keyboard(`{${nextKey}}`); // loop defaults to true: wraps
        await expect.poll(() => document.activeElement).toBe(tab("A"));
        await user.keyboard(`{${prevKey}}`);
        await expect.poll(() => document.activeElement).toBe(tab("C"));
        await user.keyboard("{Home}");
        await expect.poll(() => document.activeElement).toBe(tab("A"));
        await expect.poll(() => tab("A").getAttribute("aria-selected")).toBe("true");
      } finally {
        document.removeEventListener("keydown", record);
      }
      expect(prevented).toEqual(Array(5).fill(!supportsFocusgroup));
      expect(action.mock.calls.map(([next]) => next)).toEqual(["b", "c", "a", "c", "a"]);
    },
  );

  it("manual activation: Tab always enters and leaves on the selected tab, one tab stop", async () => {
    render(
      <>
        <button type="button">before</button>
        <Tabs.Root defaultValue="b" activationMode="manual">
          <Tabs.List aria-label="x" experimental_focusgroup>
            <Tabs.Tab value="a">A</Tabs.Tab>
            <Tabs.Tab value="b">B</Tabs.Tab>
            <Tabs.Tab value="c">C</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
        <button type="button">after</button>
      </>,
    );
    const tab = (name: string) => screen.getByRole("tab", { name });
    const button = (name: string) => screen.getByRole("button", { name });
    await expect
      .poll(() => tab("A").getAttribute("tabindex"))
      .toBe(supportsFocusgroup ? null : "-1");

    button("before").focus();
    await user.keyboard("{Tab}");
    await expect.poll(() => document.activeElement).toBe(tab("B"));
    await user.keyboard("{ArrowRight}");
    await expect.poll(() => document.activeElement).toBe(tab("C"));
    expect(tab("B")).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Tab}");
    await expect.poll(() => document.activeElement).toBe(button("after"));
    // Back in: the selected tab, not the last focused one (`nomemory` + `focusgroupstart`).
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    await expect.poll(() => document.activeElement).toBe(tab("B"));
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    await expect.poll(() => document.activeElement).toBe(button("before"));
  });
});

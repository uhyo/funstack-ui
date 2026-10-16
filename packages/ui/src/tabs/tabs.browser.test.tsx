// Tabs rows that need a real layout engine (design section 12): the Indicator is placed by CSS
// Anchor Positioning against the optimistic Tab, with no measurement code in the library.
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { deferred } from "../__tests__/helpers.js";
import { Tabs } from "./index.js";

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

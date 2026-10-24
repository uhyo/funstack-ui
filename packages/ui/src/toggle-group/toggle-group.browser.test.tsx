// Standalone ToggleGroup rows that need a real engine (design/components/toggle-group.md 14,
// rows 20, 21 and 23): Tab enters on the pressed Item on the native `focusgroup` path (Chromium,
// `nomemory` + `focusgroupstart`) and on the JS path, and the ViewTransition mount cost.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { user } from "../__tests__/browser-user.js";
import { supportsFocusgroup } from "../__tests__/engine.js";
import { ToggleGroup } from "./index.js";
import { itStartsNoViewTransitionOnMount } from "../__tests__/view-transition-mount.js";

const button = (name: string) => screen.getByRole("button", { name });
const focused = () => document.activeElement;

describe.each([
  ["with experimental_focusgroup", true],
  ["without the flag", false],
] as const)("standalone ToggleGroup %s (rows 20, 21)", (_label, flag) => {
  const native = flag && supportsFocusgroup;

  it("Tab enters on the pressed Item, arrows move without pressing, Tab leaves", async () => {
    const action = vi.fn();
    render(
      <>
        <button type="button">before</button>
        <ToggleGroup.Root
          exclusive
          aria-label="Alignment"
          defaultValue="center"
          experimental_focusgroup={flag}
          valueChangeAction={action}
        >
          <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
          <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
          <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
        </ToggleGroup.Root>
        <button type="button">after</button>
      </>,
    );
    await expect.poll(() => button("Left").getAttribute("tabindex")).toBe(native ? null : "-1");
    if (flag) expect(button("Center")).toHaveAttribute("focusgroupstart", "");

    button("before").focus();
    await user.keyboard("{Tab}");
    await expect.poll(focused).toBe(button("Center"));
    await user.keyboard("{ArrowRight}");
    await expect.poll(focused).toBe(button("Right"));
    await user.keyboard("{ArrowRight}"); // wraps
    await expect.poll(focused).toBe(button("Left"));
    await user.keyboard("{End}");
    await expect.poll(focused).toBe(button("Right"));
    expect(action).not.toHaveBeenCalled();
    await user.keyboard("{Tab}");
    await expect.poll(focused).toBe(button("after"));
    // Back in: the pressed Item, not the last focused one.
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    await expect.poll(focused).toBe(button("Center"));
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    await expect.poll(focused).toBe(button("before"));
  });
});

describe("ToggleGroup.Item view transitions (row 23)", () => {
  itStartsNoViewTransitionOnMount({
    late: (props) => (
      <ToggleGroup.Item value="b" {...props}>
        B
      </ToggleGroup.Item>
    ),
    wrap: (late) => (
      <ToggleGroup.Root aria-label="T">
        <ToggleGroup.Item value="a">A</ToggleGroup.Item>
        {late}
      </ToggleGroup.Root>
    ),
    mounted: () => screen.queryByRole("button", { name: "B" }),
  });
});

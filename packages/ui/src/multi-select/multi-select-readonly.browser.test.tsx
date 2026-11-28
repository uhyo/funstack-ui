// Read-only MultiSelect rows that need a real engine (conventions 3.6.1 rule 8, 15): Escape on a
// listbox a controlled parent keeps shown is the platform's close watcher, a fact reported to
// `onOpenChange`. Runs in Chromium, Firefox and WebKit.
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { user } from "../__tests__/browser-user.js";
import { flushMicrotasks } from "../__tests__/helpers.js";
import { MultiSelect } from "./index.js";

const trigger = () => screen.getByTestId("trigger");
const popup = () => screen.getByTestId("popup");

describe("MultiSelect readOnly (browser)", () => {
  it("Escape closes a listbox a controlled parent keeps open, as a dismissal fact", async () => {
    const openAction = vi.fn();
    const onOpenChange = vi.fn();
    await act(async () => {
      render(
        <MultiSelect.Root
          readOnly
          open
          openChangeAction={openAction}
          onOpenChange={onOpenChange}
          defaultValue={["ham"]}
        >
          <MultiSelect.Label>Toppings</MultiSelect.Label>
          <MultiSelect.Trigger data-testid="trigger">
            <MultiSelect.Value />
          </MultiSelect.Trigger>
          <MultiSelect.Popup data-testid="popup">
            <MultiSelect.List>
              <MultiSelect.Option value="ham">Ham</MultiSelect.Option>
              <MultiSelect.Option value="olive">Olive</MultiSelect.Option>
            </MultiSelect.List>
          </MultiSelect.Popup>
        </MultiSelect.Root>,
      );
    });
    await expect.poll(() => popup().matches(":popover-open")).toBe(true);
    expect(openAction.mock.calls.map(([n]) => n)).toEqual([false]);
    trigger().focus();
    await user.keyboard("{Escape}");
    await flushMicrotasks();
    await expect.poll(() => onOpenChange.mock.calls.map(([n]) => n)).toEqual([false]);
  });
});

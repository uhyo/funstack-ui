// Read-only Combobox rows that need a real engine (conventions 3.6.1 rule 8, 15): Escape on a
// listbox a controlled parent keeps shown is the platform's close watcher, a fact reported to
// `onOpenChange`; the read-only key filter lets it through. Runs in Chromium, Firefox and WebKit.
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { user } from "../__tests__/browser-user.js";
import { flushMicrotasks } from "../__tests__/helpers.js";
import { Combobox } from "./index.js";

const input = () => screen.getByTestId("input") as HTMLInputElement;
const popup = () => screen.getByTestId("popup");

describe("Combobox readOnly (browser)", () => {
  it("Escape closes a listbox a controlled parent keeps open, as a dismissal fact", async () => {
    const openAction = vi.fn();
    const onOpenChange = vi.fn();
    await act(async () => {
      render(
        <Combobox.Root
          readOnly
          open
          openChangeAction={openAction}
          onOpenChange={onOpenChange}
          defaultValue="jp"
          defaultInputValue="Japan"
        >
          <Combobox.Label>Country</Combobox.Label>
          <Combobox.Input data-testid="input" />
          <Combobox.Popup data-testid="popup">
            <Combobox.List>
              <Combobox.Option value="jp">Japan</Combobox.Option>
              <Combobox.Option value="fr">France</Combobox.Option>
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Root>,
      );
    });
    await expect.poll(() => popup().matches(":popover-open")).toBe(true);
    // The close request of rule 8 was refused by the parent.
    expect(openAction.mock.calls.map(([n]) => n)).toEqual([false]);
    input().focus();
    await user.keyboard("{Escape}");
    await flushMicrotasks();
    await expect.poll(() => onOpenChange.mock.calls.map(([n]) => n)).toEqual([false]);
    expect(input().value).toBe("Japan");
  });
});

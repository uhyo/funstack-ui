// View Transition types of MultiSelect (design/components/multi-select.md B.12, conventions 5.3):
// fsui-multi-select plus -select when something is added, -deselect when something is removed,
// and -open / -close for the Root's open state. The pick rows come from the value-action suite
// (driver __tests__/drivers/multi-select.tsx); see __tests__/transition-type-spy.ts.
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { flushTasks, setupUser } from "../__tests__/helpers.js";
import { multiSelectDriver } from "../__tests__/drivers/multi-select.js";
import { addTransitionTypeSpy, recordedTransitionTypes } from "../__tests__/transition-type-spy.js";
import { describeValueTransitionTypes } from "../__tests__/value-action-suite.js";
import { MultiSelect } from "./index.js";

vi.mock("react", async (importOriginal) => {
  const { withTransitionTypeSpy } = await import("../__tests__/transition-type-spy.js");
  return withTransitionTypeSpy(await importOriginal<typeof import("react")>());
});

describeValueTransitionTypes(multiSelectDriver);

describe("MultiSelect transition types", () => {
  it("a form reset that adds and removes adds both; opening and closing add -open / -close", async () => {
    render(
      <form data-testid="form">
        <MultiSelect.Root name="t" defaultValue={["ham"]}>
          <MultiSelect.Trigger aria-label="Toppings" data-testid="trigger" />
          <MultiSelect.Popup>
            <MultiSelect.List aria-label="Toppings">
              <MultiSelect.Option value="ham">Ham</MultiSelect.Option>
              <MultiSelect.Option value="olive" data-testid="olive">
                Olive
              </MultiSelect.Option>
            </MultiSelect.List>
          </MultiSelect.Popup>
        </MultiSelect.Root>
      </form>,
    );
    const user = setupUser();
    addTransitionTypeSpy.mockClear();
    await user.click(screen.getByTestId("trigger"));
    await flushTasks(2);
    expect(recordedTransitionTypes()).toEqual(["fsui-multi-select", "fsui-multi-select-open"]);
    await user.click(screen.getByText("Ham"));
    await user.click(screen.getByTestId("olive"));
    addTransitionTypeSpy.mockClear();
    await act(async () => {
      (screen.getByTestId("form") as HTMLFormElement).reset();
    });
    expect(recordedTransitionTypes()).toEqual([
      "fsui-multi-select",
      "fsui-multi-select-select",
      "fsui-multi-select-deselect",
    ]);
    addTransitionTypeSpy.mockClear();
    await user.click(screen.getByTestId("trigger"));
    await flushTasks(2);
    expect(recordedTransitionTypes()).toEqual(["fsui-multi-select", "fsui-multi-select-close"]);
  });
});

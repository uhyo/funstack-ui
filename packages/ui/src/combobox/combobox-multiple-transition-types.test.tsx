// View Transition types of a `Combobox.Root multiple` value dispatch (design 15.4, conventions
// 5.3): fsui-combobox plus -select when something is added, -deselect when something is removed.
// The pick rows come from the value-action suite (driver __tests__/drivers/combobox-multiple.tsx);
// see __tests__/transition-type-spy.ts.
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { setupUser } from "../__tests__/helpers.js";
import { comboboxMultipleDriver } from "../__tests__/drivers/combobox-multiple.js";
import { addTransitionTypeSpy, recordedTransitionTypes } from "../__tests__/transition-type-spy.js";
import { describeValueTransitionTypes } from "../__tests__/value-action-suite.js";
import { Combobox } from "./index.js";

vi.mock("react", async (importOriginal) => {
  const { withTransitionTypeSpy } = await import("../__tests__/transition-type-spy.js");
  return withTransitionTypeSpy(await importOriginal<typeof import("react")>());
});

describeValueTransitionTypes(comboboxMultipleDriver);

describe("Combobox multiple transition types", () => {
  it("a form reset that adds and removes adds both; Clear adds -deselect only", async () => {
    render(
      <form data-testid="form">
        <Combobox.Root multiple name="c" defaultValue={["jp"]} open onOpenChange={() => {}}>
          <Combobox.Label>Countries</Combobox.Label>
          <Combobox.Input />
          <Combobox.Clear aria-label="Clear" data-testid="clear" />
          <Combobox.Popup>
            <Combobox.List>
              <Combobox.Option value="jp">Japan</Combobox.Option>
              <Combobox.Option value="fr" data-testid="fr">
                France
              </Combobox.Option>
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Root>
      </form>,
    );
    const user = setupUser();
    await user.click(screen.getByText("Japan"));
    await user.click(screen.getByTestId("fr"));
    addTransitionTypeSpy.mockClear();
    await act(async () => {
      (screen.getByTestId("form") as HTMLFormElement).reset();
    });
    expect(recordedTransitionTypes()).toEqual([
      "fsui-combobox",
      "fsui-combobox-select",
      "fsui-combobox-deselect",
    ]);
    addTransitionTypeSpy.mockClear();
    await user.click(screen.getByTestId("clear"));
    expect(recordedTransitionTypes()).toEqual(["fsui-combobox", "fsui-combobox-deselect"]);
  });
});

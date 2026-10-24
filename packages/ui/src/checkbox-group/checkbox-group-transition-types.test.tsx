// View Transition types added per CheckboxGroup dispatch (design 5.2 and decision 12,
// conventions 5.3): fsui-checkbox-group plus -check / -uncheck. The Item check, the Parent's
// check-all and the Item uncheck rows come from the value-action suite (driver
// __tests__/drivers/checkbox-group.tsx); see __tests__/transition-type-spy.ts.
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { setupUser } from "../__tests__/helpers.js";
import { checkboxGroupDriver } from "../__tests__/drivers/checkbox-group.js";
import { addTransitionTypeSpy, recordedTransitionTypes } from "../__tests__/transition-type-spy.js";
import { describeValueTransitionTypes } from "../__tests__/value-action-suite.js";
import { CheckboxGroup } from "./index.js";

vi.mock("react", async (importOriginal) => {
  const { withTransitionTypeSpy } = await import("../__tests__/transition-type-spy.js");
  return withTransitionTypeSpy(await importOriginal<typeof import("react")>());
});

describeValueTransitionTypes(checkboxGroupDriver);

const box = (name: string) => screen.getByRole("checkbox", { name });

describe("CheckboxGroup transition types", () => {
  it("a reset that checks and unchecks adds both", async () => {
    render(
      <form data-testid="form">
        <CheckboxGroup.Root aria-label="x" defaultValue={["a"]}>
          <CheckboxGroup.Parent values={["a", "b", "c"]} aria-label="all" />
          <CheckboxGroup.Item value="a" aria-label="a" />
          <CheckboxGroup.Item value="b" aria-label="b" />
          <CheckboxGroup.Item value="c" aria-label="c" />
        </CheckboxGroup.Root>
      </form>,
    );
    const user = setupUser();
    await user.click(box("a"));
    await user.click(box("b"));
    addTransitionTypeSpy.mockClear();
    await act(async () => {
      (screen.getByTestId("form") as HTMLFormElement).reset();
    });
    expect(recordedTransitionTypes()).toEqual([
      "fsui-checkbox-group",
      "fsui-checkbox-group-check",
      "fsui-checkbox-group-uncheck",
    ]);
  });
});

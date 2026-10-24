// View Transition types added per ToggleGroup dispatch (design 5.2 and 10, conventions 5.3):
// fsui-toggle-group plus -press / -release. The press and release rows come from the value-action
// suite (driver __tests__/drivers/toggle-group.tsx); see __tests__/transition-type-spy.ts.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { setupUser } from "../__tests__/helpers.js";
import { toggleGroupDriver } from "../__tests__/drivers/toggle-group.js";
import { addTransitionTypeSpy, recordedTransitionTypes } from "../__tests__/transition-type-spy.js";
import { describeValueTransitionTypes } from "../__tests__/value-action-suite.js";
import { ToggleGroup } from "./index.js";

vi.mock("react", async (importOriginal) => {
  const { withTransitionTypeSpy } = await import("../__tests__/transition-type-spy.js");
  return withTransitionTypeSpy(await importOriginal<typeof import("react")>());
});

describeValueTransitionTypes(toggleGroupDriver);

describe("ToggleGroup transition types", () => {
  it("an exclusive switch carries both", async () => {
    render(
      <ToggleGroup.Root exclusive aria-label="x" defaultValue="a">
        <ToggleGroup.Item value="a">A</ToggleGroup.Item>
        <ToggleGroup.Item value="b">B</ToggleGroup.Item>
      </ToggleGroup.Root>,
    );
    addTransitionTypeSpy.mockClear();
    await setupUser().click(screen.getByRole("button", { name: "B" }));
    expect(recordedTransitionTypes()).toEqual([
      "fsui-toggle-group",
      "fsui-toggle-group-press",
      "fsui-toggle-group-release",
    ]);
  });
});

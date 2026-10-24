// View Transition types added per Tabs dispatch (design 10.2, conventions 5.3): fsui-tabs plus
// -next / -prev by the DOM order of the committed and the next tab. The per-gesture rows come from
// the value-action suite (driver __tests__/drivers/tabs.tsx); see __tests__/transition-type-spy.ts.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { setupUser } from "../__tests__/helpers.js";
import { tabsDriver } from "../__tests__/drivers/tabs.js";
import { addTransitionTypeSpy, recordedTransitionTypes } from "../__tests__/transition-type-spy.js";
import { describeValueTransitionTypes } from "../__tests__/value-action-suite.js";
import { Tabs } from "./index.js";

vi.mock("react", async (importOriginal) => {
  const { withTransitionTypeSpy } = await import("../__tests__/transition-type-spy.js");
  return withTransitionTypeSpy(await importOriginal<typeof import("react")>());
});

describeValueTransitionTypes(tabsDriver);

describe("Tabs transition types", () => {
  it("adds only fsui-tabs when there is no committed tab", async () => {
    render(
      <Tabs.Root defaultValue={null} activationMode="manual">
        <Tabs.List aria-label="x">
          <Tabs.Tab value="a">A</Tabs.Tab>
          <Tabs.Tab value="b">B</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="a">Panel a</Tabs.Panel>
        <Tabs.Panel value="b">Panel b</Tabs.Panel>
      </Tabs.Root>,
    );
    addTransitionTypeSpy.mockClear();
    await setupUser().click(screen.getByRole("tab", { name: "A" }));
    expect(recordedTransitionTypes()).toEqual(["fsui-tabs"]);
  });
});

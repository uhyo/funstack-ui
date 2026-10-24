// View Transition types added per Toggle dispatch (design/components/toggle.md, conventions 5.3):
// fsui-toggle plus -press / -release. See __tests__/transition-type-spy.ts.
import { vi } from "vitest";
import { toggleDriver } from "../__tests__/drivers/toggle.js";
import { describeValueTransitionTypes } from "../__tests__/value-action-suite.js";

vi.mock("react", async (importOriginal) => {
  const { withTransitionTypeSpy } = await import("../__tests__/transition-type-spy.js");
  return withTransitionTypeSpy(await importOriginal<typeof import("react")>());
});

describeValueTransitionTypes(toggleDriver);

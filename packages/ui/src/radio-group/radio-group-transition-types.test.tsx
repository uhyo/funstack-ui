// View Transition types added per RadioGroup dispatch (design/components/radio-group.md,
// conventions 5.3): `fsui-radio-group` only. Rows from the value-action suite (driver
// __tests__/drivers/radio-group.tsx); see __tests__/transition-type-spy.ts.
import { vi } from "vitest";
import { radioGroupDriver } from "../__tests__/drivers/radio-group.js";
import { describeValueTransitionTypes } from "../__tests__/value-action-suite.js";

vi.mock("react", async (importOriginal) => {
  const { withTransitionTypeSpy } = await import("../__tests__/transition-type-spy.js");
  return withTransitionTypeSpy(await importOriginal<typeof import("react")>());
});

describeValueTransitionTypes(radioGroupDriver);

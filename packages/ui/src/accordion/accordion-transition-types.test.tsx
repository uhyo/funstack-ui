// View Transition types added per Accordion dispatch (design/components/accordion.md,
// conventions 5.3): fsui-accordion plus -expand / -collapse by `details.open`. Rows from the
// value-action suite (drivers __tests__/drivers/accordion.tsx); see
// __tests__/transition-type-spy.ts.
import { vi } from "vitest";
import { accordionDriver, accordionExclusiveDriver } from "../__tests__/drivers/accordion.js";
import { describeValueTransitionTypes } from "../__tests__/value-action-suite.js";

vi.mock("react", async (importOriginal) => {
  const { withTransitionTypeSpy } = await import("../__tests__/transition-type-spy.js");
  return withTransitionTypeSpy(await importOriginal<typeof import("react")>());
});

describeValueTransitionTypes(accordionDriver);
describeValueTransitionTypes(accordionExclusiveDriver);

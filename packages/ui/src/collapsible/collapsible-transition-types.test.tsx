// View Transition types added per Collapsible dispatch (design/components/collapsible.md 8.3,
// conventions 5.3): fsui-collapsible plus -expand / -collapse by `next`. Rows from the
// value-action suite (driver __tests__/drivers/collapsible.tsx); see
// __tests__/transition-type-spy.ts.
import { vi } from "vitest";
import { collapsibleDriver } from "../__tests__/drivers/collapsible.js";
import { describeValueTransitionTypes } from "../__tests__/value-action-suite.js";

vi.mock("react", async (importOriginal) => {
  const { withTransitionTypeSpy } = await import("../__tests__/transition-type-spy.js");
  return withTransitionTypeSpy(await importOriginal<typeof import("react")>());
});

describeValueTransitionTypes(collapsibleDriver);

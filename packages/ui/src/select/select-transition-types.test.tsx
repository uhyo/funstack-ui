// View Transition types added per Select dispatch (design/components/select.md, conventions 5.3):
// `fsui-select` only. Rows from the value-action suite (driver __tests__/drivers/select.tsx); see
// __tests__/transition-type-spy.ts.
import { beforeAll, vi } from "vitest";
import { selectDriver, takeSelectedContentWarning } from "../__tests__/drivers/select.js";
import { describeValueTransitionTypes } from "../__tests__/value-action-suite.js";

vi.mock("react", async (importOriginal) => {
  const { withTransitionTypeSpy } = await import("../__tests__/transition-type-spy.js");
  return withTransitionTypeSpy(await importOriginal<typeof import("react")>());
});

beforeAll(takeSelectedContentWarning);

describeValueTransitionTypes(selectDriver);

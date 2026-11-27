// View Transition types added per TextField commit (design 11, conventions 5.3): fsui-text-field
// and fsui-text-field-commit, for a user commit and a platform one. The per-gesture rows come from
// the value-action suite (driver __tests__/drivers/text-field.tsx); see
// __tests__/transition-type-spy.ts.
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { textFieldDriver } from "../__tests__/drivers/text-field.js";
import { flushMicrotasks } from "../__tests__/helpers.js";
import { addTransitionTypeSpy, recordedTransitionTypes } from "../__tests__/transition-type-spy.js";
import { describeValueTransitionTypes } from "../__tests__/value-action-suite.js";
import { TextField } from "./index.js";

vi.mock("react", async (importOriginal) => {
  const { withTransitionTypeSpy } = await import("../__tests__/transition-type-spy.js");
  return withTransitionTypeSpy(await importOriginal<typeof import("react")>());
});

describeValueTransitionTypes(textFieldDriver);

describe("TextField transition types", () => {
  it("a form reset's platform commit carries the commit types", async () => {
    const ui = (defaultValue: string) => (
      <form data-testid="form">
        <TextField aria-label="Title" defaultValue={defaultValue} />
      </form>
    );
    const { rerender } = render(ui("Draft"));
    rerender(ui("New"));
    addTransitionTypeSpy.mockClear();
    await act(async () => (screen.getByTestId("form") as HTMLFormElement).reset());
    await flushMicrotasks();
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("New");
    expect(recordedTransitionTypes()).toEqual(["fsui-text-field", "fsui-text-field-commit"]);
  });
});

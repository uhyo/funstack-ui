// View Transition types of an OTPField completion (design/components/otp-field.md 11,
// conventions 5.3): `fsui-otp-field` and `fsui-otp-field-complete`, on the completion's transition
// only. Typing is urgent and carries none. See __tests__/transition-type-spy.ts.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupUser } from "../__tests__/helpers.js";
import { addTransitionTypeSpy, recordedTransitionTypes } from "../__tests__/transition-type-spy.js";
import { OTPField } from "./index.js";

vi.mock("react", async (importOriginal) => {
  const { withTransitionTypeSpy } = await import("../__tests__/transition-type-spy.js");
  return withTransitionTypeSpy(await importOriginal<typeof import("react")>());
});

beforeEach(() => {
  addTransitionTypeSpy.mockClear();
});

describe("OTPField transition types", () => {
  it("a completion adds fsui-otp-field and fsui-otp-field-complete; typing adds none", async () => {
    const user = setupUser();
    render(
      <OTPField.Root length={2} completeAction={async () => {}}>
        <OTPField.Input aria-label="Code" data-testid="input" />
        <OTPField.Slot index={0} />
        <OTPField.Slot index={1} />
      </OTPField.Root>,
    );
    await user.click(screen.getByTestId("input"));
    await user.keyboard("1");
    expect(recordedTransitionTypes()).toEqual([]);
    await user.keyboard("2");
    expect(recordedTransitionTypes()).toEqual(["fsui-otp-field", "fsui-otp-field-complete"]);
  });

  it("no completeAction: no transition and no types", async () => {
    const user = setupUser();
    render(
      <OTPField.Root length={1}>
        <OTPField.Input aria-label="Code" data-testid="input" />
        <OTPField.Slot index={0} />
      </OTPField.Root>,
    );
    await user.click(screen.getByTestId("input"));
    await user.keyboard("1");
    expect(recordedTransitionTypes()).toEqual([]);
  });
});

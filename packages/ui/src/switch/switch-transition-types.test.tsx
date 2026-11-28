// View Transition types added per Switch dispatch (design/components/switch.md 8, conventions
// 5.3): `fsui-switch` plus `fsui-switch-check` / `fsui-switch-uncheck`, the kinds of every
// `checked` state. See __tests__/transition-type-spy.ts.
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupUser } from "../__tests__/helpers.js";
import { addTransitionTypeSpy, recordedTransitionTypes } from "../__tests__/transition-type-spy.js";
import { Switch } from "./index.js";

vi.mock("react", async (importOriginal) => {
  const { withTransitionTypeSpy } = await import("../__tests__/transition-type-spy.js");
  return withTransitionTypeSpy(await importOriginal<typeof import("react")>());
});

beforeEach(() => {
  addTransitionTypeSpy.mockClear();
});

describe("Switch transition types", () => {
  it("a check adds fsui-switch and fsui-switch-check; an uncheck fsui-switch-uncheck", async () => {
    render(<Switch aria-label="Wi-Fi" checkedChangeAction={() => {}} />);
    const user = setupUser();
    await user.click(screen.getByRole("switch"));
    expect(recordedTransitionTypes()).toEqual(["fsui-switch", "fsui-switch-check"]);
    addTransitionTypeSpy.mockClear();
    await user.click(screen.getByRole("switch"));
    expect(recordedTransitionTypes()).toEqual(["fsui-switch", "fsui-switch-uncheck"]);
  });

  it("a form reset carries the kind of the value it lands on", async () => {
    render(
      <form data-testid="form">
        <Switch aria-label="Wi-Fi" defaultChecked checkedChangeAction={() => {}} />
      </form>,
    );
    const user = setupUser();
    await user.click(screen.getByRole("switch"));
    addTransitionTypeSpy.mockClear();
    await act(async () => {
      (screen.getByTestId("form") as HTMLFormElement).reset();
    });
    expect(recordedTransitionTypes()).toEqual(["fsui-switch", "fsui-switch-check"]);
  });
});

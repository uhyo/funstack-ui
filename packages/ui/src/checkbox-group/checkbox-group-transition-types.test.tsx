// View Transition types added per CheckboxGroup dispatch (design 5.2 and decision 12,
// conventions 5.3). jsdom has no `startViewTransition`, so the types are observed by wrapping
// React's `addTransitionType`.
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupUser } from "../__tests__/helpers.js";
import { CheckboxGroup } from "./index.js";

const addTransitionType = vi.hoisted(() => vi.fn<(type: string) => void>());

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    addTransitionType: (type: string) => {
      addTransitionType(type);
      actual.addTransitionType(type);
    },
  };
});

function Example() {
  return (
    <form data-testid="form">
      <CheckboxGroup.Root aria-label="x" defaultValue={["a"]}>
        <CheckboxGroup.Parent values={["a", "b", "c"]} aria-label="all" />
        <CheckboxGroup.Item value="a" aria-label="a" />
        <CheckboxGroup.Item value="b" aria-label="b" />
        <CheckboxGroup.Item value="c" aria-label="c" />
      </CheckboxGroup.Root>
    </form>
  );
}

const box = (name: string) => screen.getByRole("checkbox", { name });
const types = () => addTransitionType.mock.calls.map(([t]) => t);

beforeEach(() => {
  addTransitionType.mockClear();
});

describe("CheckboxGroup transition types", () => {
  it("check adds fsui-checkbox-group and fsui-checkbox-group-check", async () => {
    render(<Example />);
    await setupUser().click(box("b"));
    expect(types()).toEqual(["fsui-checkbox-group", "fsui-checkbox-group-check"]);
  });

  it("uncheck adds fsui-checkbox-group and fsui-checkbox-group-uncheck", async () => {
    render(<Example />);
    await setupUser().click(box("a"));
    expect(types()).toEqual(["fsui-checkbox-group", "fsui-checkbox-group-uncheck"]);
  });

  it("a Parent click that checks all adds -check", async () => {
    render(<Example />);
    await setupUser().click(box("all"));
    expect(types()).toEqual(["fsui-checkbox-group", "fsui-checkbox-group-check"]);
  });

  it("a reset that checks and unchecks adds both", async () => {
    render(<Example />);
    const user = setupUser();
    await user.click(box("a"));
    await user.click(box("b"));
    addTransitionType.mockClear();
    await act(async () => {
      (screen.getByTestId("form") as HTMLFormElement).reset();
    });
    expect(types()).toEqual([
      "fsui-checkbox-group",
      "fsui-checkbox-group-check",
      "fsui-checkbox-group-uncheck",
    ]);
  });
});

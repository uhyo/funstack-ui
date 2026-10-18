// View Transition types added per ToggleGroup dispatch (design 5.2 and 10, conventions 5.3).
// jsdom has no `startViewTransition`, so the types are observed by wrapping `addTransitionType`.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupUser } from "../__tests__/helpers.js";
import { ToggleGroup } from "./index.js";

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

const item = (name: string) => screen.getByRole("button", { name });
const types = () => addTransitionType.mock.calls.map(([t]) => t);

beforeEach(() => {
  addTransitionType.mockClear();
});

describe("ToggleGroup transition types", () => {
  it("press adds fsui-toggle-group and -press; release adds -release", async () => {
    render(
      <ToggleGroup.Root aria-label="x">
        <ToggleGroup.Item value="a">A</ToggleGroup.Item>
      </ToggleGroup.Root>,
    );
    const user = setupUser();
    await user.click(item("A"));
    expect(types()).toEqual(["fsui-toggle-group", "fsui-toggle-group-press"]);
    addTransitionType.mockClear();
    await user.click(item("A"));
    expect(types()).toEqual(["fsui-toggle-group", "fsui-toggle-group-release"]);
  });

  it("an exclusive switch carries both", async () => {
    render(
      <ToggleGroup.Root exclusive aria-label="x" defaultValue="a">
        <ToggleGroup.Item value="a">A</ToggleGroup.Item>
        <ToggleGroup.Item value="b">B</ToggleGroup.Item>
      </ToggleGroup.Root>,
    );
    await setupUser().click(item("B"));
    expect(types()).toEqual([
      "fsui-toggle-group",
      "fsui-toggle-group-press",
      "fsui-toggle-group-release",
    ]);
  });
});

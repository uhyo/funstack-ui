// View Transition types added per Tabs dispatch (design 10.2, conventions 5.3). jsdom has no
// `startViewTransition`, so the types are observed by wrapping React's `addTransitionType`.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupUser } from "../__tests__/helpers.js";
import { Tabs } from "./index.js";

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

function Example({ initial = "b" }: { initial?: string | null }) {
  return (
    <Tabs.Root defaultValue={initial} activationMode="manual">
      <Tabs.List aria-label="x">
        <Tabs.Tab value="a">A</Tabs.Tab>
        <Tabs.Tab value="b">B</Tabs.Tab>
        <Tabs.Tab value="c">C</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="a">Panel a</Tabs.Panel>
      <Tabs.Panel value="b">Panel b</Tabs.Panel>
      <Tabs.Panel value="c">Panel c</Tabs.Panel>
    </Tabs.Root>
  );
}

const tab = (name: string) => screen.getByRole("tab", { name });

beforeEach(() => {
  addTransitionType.mockClear();
});

describe("Tabs transition types", () => {
  it("adds fsui-tabs and fsui-tabs-next for a later tab", async () => {
    render(<Example />);
    await setupUser().click(tab("C"));
    expect(addTransitionType.mock.calls.map(([t]) => t)).toEqual(["fsui-tabs", "fsui-tabs-next"]);
  });

  it("adds fsui-tabs and fsui-tabs-prev for an earlier tab", async () => {
    render(<Example />);
    await setupUser().click(tab("A"));
    expect(addTransitionType.mock.calls.map(([t]) => t)).toEqual(["fsui-tabs", "fsui-tabs-prev"]);
  });

  it("adds only fsui-tabs when there is no committed tab", async () => {
    render(<Example initial={null} />);
    await setupUser().click(tab("A"));
    expect(addTransitionType.mock.calls.map(([t]) => t)).toEqual(["fsui-tabs"]);
  });
});

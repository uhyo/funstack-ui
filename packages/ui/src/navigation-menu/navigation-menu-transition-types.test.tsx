// View Transition types of a NavigationMenu Item's dispatch (design/components/navigation-menu.md
// 9, conventions 5.3): `fsui-navigation-menu` plus `-open` / `-close`, for the Trigger and a
// followed Link. A dismissal (focus leaving a shown panel) is a fact and carries none. See
// __tests__/transition-type-spy.ts.
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushTasks, setupUser } from "../__tests__/helpers.js";
import { addTransitionTypeSpy, recordedTransitionTypes } from "../__tests__/transition-type-spy.js";
import { NavigationMenu } from "./index.js";

vi.mock("react", async (importOriginal) => {
  const { withTransitionTypeSpy } = await import("../__tests__/transition-type-spy.js");
  return withTransitionTypeSpy(await importOriginal<typeof import("react")>());
});

beforeEach(() => {
  addTransitionTypeSpy.mockClear();
});

function Nav() {
  return (
    <NavigationMenu.Root>
      <NavigationMenu.List>
        <NavigationMenu.Item defaultOpen={false}>
          <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
          <NavigationMenu.Popup>
            <NavigationMenu.Link href="#a">Analytics</NavigationMenu.Link>
          </NavigationMenu.Popup>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenu.Link href="#p">Pricing</NavigationMenu.Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>
    </NavigationMenu.Root>
  );
}

describe("NavigationMenu transition types", () => {
  it("the Trigger's open and close add fsui-navigation-menu and -open / -close", async () => {
    const user = setupUser();
    render(<Nav />);
    await user.click(screen.getByRole("button", { name: "Products" }));
    await flushTasks(2);
    expect(recordedTransitionTypes()).toEqual([
      "fsui-navigation-menu",
      "fsui-navigation-menu-open",
    ]);
    addTransitionTypeSpy.mockClear();
    await user.click(screen.getByRole("button", { name: "Products" }));
    await flushTasks(2);
    expect(recordedTransitionTypes()).toEqual([
      "fsui-navigation-menu",
      "fsui-navigation-menu-close",
    ]);
  });

  it("a followed Link's close adds -close", async () => {
    const user = setupUser();
    render(<Nav />);
    await user.click(screen.getByRole("button", { name: "Products" }));
    await flushTasks(2);
    addTransitionTypeSpy.mockClear();
    await user.click(screen.getByRole("link", { name: "Analytics" }));
    await flushTasks(2);
    expect(recordedTransitionTypes()).toEqual([
      "fsui-navigation-menu",
      "fsui-navigation-menu-close",
    ]);
  });

  it("focus leaving a shown panel is a fact and adds no type", async () => {
    const user = setupUser();
    render(<Nav />);
    await user.click(screen.getByRole("button", { name: "Products" }));
    await flushTasks(2);
    addTransitionTypeSpy.mockClear();
    const link = screen.getByRole("link", { name: "Analytics" });
    act(() => link.focus());
    act(() => screen.getByRole("link", { name: "Pricing" }).focus());
    await act(async () => flushTasks(2));
    // Hidden, and the content went with the fact's commit.
    expect(screen.queryByRole("link", { name: "Analytics", hidden: true })).toBeNull();
    expect(recordedTransitionTypes()).toEqual([]);
  });
});

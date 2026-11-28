// Collapsible rows that need a real engine (see the note at the top of collapsible.test.tsx):
// Enter/Space on a focused <summary> synthesize the click the library intercepts, a script-driven
// `open` flip standing in for find-in-page (a real `ToggleEvent`), `experimental_interpolateSize`
// as computed style, the `::details-content` CSS transition, and one `transition` run with the
// `fsui-collapsible` types reaching `startViewTransition`. Find-in-page itself is not scriptable.
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { user } from "../__tests__/browser-user.js";
import { addStyle, settle, spyViewTransitions } from "../__tests__/browser-helpers.js";
import { deferred } from "../__tests__/helpers.js";
import { Collapsible } from "./index.js";
import type { CollapsibleOpenChangeDetails } from "./index.js";

type ActionFn = (next: boolean, details: CollapsibleOpenChangeDetails) => void | Promise<void>;

const root = () => screen.getByTestId("root") as HTMLDetailsElement;
const trigger = () => screen.getByTestId("trigger");

/** `toggle` is dispatched from a queued task; let it run inside `act`. */
const flushToggle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

describe("Collapsible (browser)", () => {
  it("Enter and Space on a focused summary are intercepted in library mode", async () => {
    const d = deferred();
    const action = vi.fn<ActionFn>(() => d.promise);
    render(
      <Collapsible.Root openChangeAction={action} data-testid="root">
        <Collapsible.Trigger data-testid="trigger">Details</Collapsible.Trigger>
        <Collapsible.Panel>Alpha</Collapsible.Panel>
      </Collapsible.Root>,
    );

    trigger().focus();
    expect(trigger()).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0]?.[0]).toBe(true);
    expect(action.mock.calls[0]?.[1].event?.type).toBe("click");
    // Intercepted: the browser did not touch `open`; the trigger shows the optimistic state.
    expect(root().open).toBe(false);
    expect(trigger()).toHaveAttribute("data-open", "");
    expect(trigger()).toHaveAttribute("data-pending", "");

    await act(async () => {
      d.resolve();
    });
    expect(root().open).toBe(true);
    expect(trigger()).not.toHaveAttribute("data-pending");

    await user.keyboard(" ");
    expect(action).toHaveBeenCalledTimes(2);
    expect(action.mock.calls[1]?.[0]).toBe(false);
    expect(action.mock.calls[1]?.[1].event?.type).toBe("click");
    await act(async () => {});
    expect(root().open).toBe(false);
  });

  it("JS-free: Enter and Space toggle natively", async () => {
    render(
      <Collapsible.Root data-testid="root">
        <Collapsible.Trigger data-testid="trigger">Details</Collapsible.Trigger>
        <Collapsible.Panel>Alpha</Collapsible.Panel>
      </Collapsible.Root>,
    );
    trigger().focus();
    await user.keyboard("{Enter}");
    expect(root().open).toBe(true);
    expect(root()).not.toHaveAttribute("data-open");
    await user.keyboard(" ");
    expect(root().open).toBe(false);
  });

  it("platform path: a script-opened <details> dispatches with the ToggleEvent and is re-closed when refused", async () => {
    const d = deferred();
    const action = vi.fn<ActionFn>(() => d.promise);
    render(
      <Collapsible.Root open={false} openChangeAction={action} data-testid="root">
        <Collapsible.Trigger data-testid="trigger">Details</Collapsible.Trigger>
        <Collapsible.Panel>Alpha</Collapsible.Panel>
      </Collapsible.Root>,
    );

    act(() => {
      root().open = true; // what find-in-page does
    });
    await flushToggle();
    expect(action).toHaveBeenCalledTimes(1);
    const details = action.mock.calls[0]![1];
    expect(details.reason).toBe("platform");
    expect(details.event).toBeInstanceOf(ToggleEvent);
    expect(root().open).toBe(true); // stays visible while the action runs
    expect(trigger()).toHaveAttribute("data-pending", "");

    await act(async () => {
      d.resolve();
    });
    expect(root().open).toBe(false); // the parent kept `false`
    expect(trigger()).not.toHaveAttribute("data-open");
    await flushToggle();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("a re-open while a close is pending is dispatched (#175): script close, then a reveal in a later task", async () => {
    const d = deferred();
    const action = vi.fn<ActionFn>(() => d.promise);
    render(
      <Collapsible.Root defaultOpen openChangeAction={action} data-testid="root">
        <Collapsible.Trigger data-testid="trigger">Details</Collapsible.Trigger>
        <Collapsible.Panel>Alpha</Collapsible.Panel>
      </Collapsible.Root>,
    );
    await user.click(trigger());
    expect(root().open).toBe(true); // the close is pending
    act(() => {
      root().open = false; // a script
    });
    await flushToggle();
    expect(action).toHaveBeenCalledTimes(1); // equal to the intended value
    act(() => {
      root().open = true; // what find-in-page does
    });
    await flushToggle();
    expect(action.mock.calls.map(([next, details]) => [next, details.reason])).toEqual([
      [false, "activate"],
      [true, "platform"],
    ]);
    await act(async () => {
      d.resolve();
    });
    await flushToggle();
    expect(root().open).toBe(true); // the revealed content stays
    expect(trigger()).toHaveAttribute("data-open", "");
  });

  it("`experimental_interpolateSize` sets interpolate-size on the <details> where supported", () => {
    render(
      <Collapsible.Root experimental_interpolateSize data-testid="root">
        <Collapsible.Trigger>Details</Collapsible.Trigger>
        <Collapsible.Panel>Alpha</Collapsible.Panel>
      </Collapsible.Root>,
    );
    const computed = getComputedStyle(root()).getPropertyValue("interpolate-size");
    if (CSS.supports("interpolate-size", "allow-keywords")) {
      expect(computed).toBe("allow-keywords");
    } else {
      // Documented degradation: the declaration is dropped and the height jumps.
      expect(computed).toBe("");
    }
  });

  it("the ::details-content grid-rows transition runs when library mode commits `open`", async () => {
    // A long linear transition, observed through the box height: `getAnimations()` does not list
    // `::details-content` transitions in Chromium (memo/developer/issue-163.md), and the computed
    // `grid-template-rows` jumps to its end value in Firefox while the layout animates.
    addStyle(`
      .c::details-content {
        display: grid;
        grid-template-rows: 0fr;
        transition: grid-template-rows 4s linear, content-visibility 4s allow-discrete;
      }
      .c:open::details-content { grid-template-rows: 1fr; }
      .c > .panel { min-height: 0; overflow: hidden; }
    `);
    render(
      <Collapsible.Root defaultOpen={false} className="c" data-testid="root">
        <Collapsible.Trigger data-testid="trigger">Details</Collapsible.Trigger>
        <Collapsible.Panel className="panel">
          <p style={{ height: 200, margin: 0 }}>Alpha</p>
        </Collapsible.Panel>
      </Collapsible.Root>,
    );
    const closed = root().getBoundingClientRect().height;
    await user.click(trigger());
    expect(root().open).toBe(true);
    await settle(() => {
      const height = root().getBoundingClientRect().height;
      expect(height).toBeGreaterThan(closed);
      expect(height).toBeLessThan(closed + 190);
    });
  });

  it("`transition` passes the fsui-collapsible types to startViewTransition", async () => {
    const types: string[][] = [];
    spyViewTransitions((arg) => {
      if (typeof arg === "object" && arg.types != null) types.push([...arg.types]);
    });
    render(
      <Collapsible.Root defaultOpen={false} transition="auto" data-testid="root">
        <Collapsible.Trigger data-testid="trigger">Details</Collapsible.Trigger>
        <Collapsible.Panel>{({ open }) => open && <span>Alpha</span>}</Collapsible.Panel>
      </Collapsible.Root>,
    );

    await user.click(trigger());
    await expect.poll(() => screen.queryByText("Alpha")).not.toBeNull();
    await expect.poll(() => types.length).toBeGreaterThan(0);
    expect(types.at(-1)).toEqual(
      expect.arrayContaining(["fsui-collapsible", "fsui-collapsible-open"]),
    );

    types.length = 0;
    await user.click(trigger());
    await expect.poll(() => screen.queryByText("Alpha")).toBeNull();
    await expect.poll(() => types.length).toBeGreaterThan(0);
    expect(types.at(-1)).toEqual(
      expect.arrayContaining(["fsui-collapsible", "fsui-collapsible-close"]),
    );
  });
});

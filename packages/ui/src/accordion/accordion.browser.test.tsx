// Accordion rows that need a real engine (issue #22; see the note at the top of
// accordion.test.tsx): Enter/Space on a focused <summary> synthesize the click the library
// intercepts, `<details name>` exclusivity, a script-driven `open` flip standing in for
// find-in-page, and clicks on form controls nested inside the summary. Runs in headless
// Chromium through vitest browser mode.
import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import { userEvent } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";
import { deferred } from "../__tests__/helpers.js";
import { Accordion } from "./index.js";
import type { AccordionValueChangeDetails } from "./index.js";

type ActionFn = (next: string[], details: AccordionValueChangeDetails) => void | Promise<void>;

const item = (v: string) => screen.getByTestId(`item-${v}`) as HTMLDetailsElement;
const trigger = (v: string) => screen.getByTestId(`trigger-${v}`);

/** `toggle` is dispatched from a queued task; let it run inside `act`. */
const flushToggle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

function LibraryList({ action, children }: { action: ActionFn; children?: React.ReactNode }) {
  return (
    <Accordion.Root defaultValue={[]} valueChangeAction={action} data-testid="root">
      <Accordion.Item value="a" data-testid="item-a">
        <Accordion.Trigger data-testid="trigger-a">A {children}</Accordion.Trigger>
        <Accordion.Panel>Alpha</Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value="b" data-testid="item-b">
        <Accordion.Trigger data-testid="trigger-b">B</Accordion.Trigger>
        <Accordion.Panel>Beta</Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  );
}

describe("Accordion (browser)", () => {
  it("Enter and Space on a focused summary are intercepted in library mode", async () => {
    const d = deferred();
    const action = vi.fn<ActionFn>(() => d.promise);
    render(<LibraryList action={action} />);

    trigger("a").focus();
    expect(trigger("a")).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0]?.[0]).toEqual(["a"]);
    expect(action.mock.calls[0]?.[1].event?.type).toBe("click");
    // Intercepted: the browser did not touch `open`; the trigger shows the optimistic state.
    expect(item("a").open).toBe(false);
    expect(trigger("a")).toHaveAttribute("data-open", "");
    expect(trigger("a")).toHaveAttribute("data-pending", "");

    await act(async () => {
      d.resolve();
    });
    expect(item("a").open).toBe(true);
    expect(trigger("a")).not.toHaveAttribute("data-pending");

    await userEvent.keyboard(" ");
    expect(action).toHaveBeenCalledTimes(2);
    expect(action.mock.calls[1]?.[0]).toEqual([]);
    expect(action.mock.calls[1]?.[1].event?.type).toBe("click");
    await act(async () => {});
    expect(item("a").open).toBe(false);
  });

  it("JS-free: Enter/Space toggle natively and `exclusive` closes the other item through `name`", async () => {
    render(
      <Accordion.Root exclusive>
        <Accordion.Item value="a" defaultOpen data-testid="item-a">
          <Accordion.Trigger data-testid="trigger-a">A</Accordion.Trigger>
          <Accordion.Panel>Alpha</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="b" data-testid="item-b">
          <Accordion.Trigger data-testid="trigger-b">B</Accordion.Trigger>
          <Accordion.Panel>Beta</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>,
    );
    expect(item("a").open).toBe(true);
    expect(item("a").getAttribute("name")).toBe(item("b").getAttribute("name"));

    await userEvent.click(trigger("b"));
    expect(item("b").open).toBe(true);
    expect(item("a").open).toBe(false); // the platform's exclusive group
    expect(item("b")).not.toHaveAttribute("data-open");

    trigger("a").focus();
    await userEvent.keyboard("{Enter}");
    expect(item("a").open).toBe(true);
    expect(item("b").open).toBe(false);
    await userEvent.keyboard(" ");
    expect(item("a").open).toBe(false);
  });

  it("platform path: a script-opened item dispatches with reason 'platform' and is re-closed when refused", async () => {
    const d = deferred();
    const action = vi.fn<ActionFn>(() => d.promise);
    function Parent() {
      const [value] = useState<string[]>([]);
      return (
        <Accordion.Root value={value} valueChangeAction={action} data-testid="root">
          <Accordion.Item value="a" data-testid="item-a">
            <Accordion.Trigger data-testid="trigger-a">A</Accordion.Trigger>
            <Accordion.Panel>Alpha</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      );
    }
    render(<Parent />);

    act(() => {
      item("a").open = true; // what find-in-page does
    });
    await flushToggle();
    expect(action).toHaveBeenCalledTimes(1);
    const details = action.mock.calls[0]![1];
    expect(details.reason).toBe("platform");
    expect(details.item).toBe("a");
    expect(details.open).toBe(true);
    expect(details.event).toBeInstanceOf(ToggleEvent);
    expect(item("a").open).toBe(true); // stays visible while the action runs
    expect(trigger("a")).toHaveAttribute("data-pending", "");

    await act(async () => {
      d.resolve();
    });
    expect(item("a").open).toBe(false); // the parent kept `[]`
    expect(trigger("a")).not.toHaveAttribute("data-open");
    await flushToggle();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("clicks on form controls nested in the summary neither toggle nor dispatch (library mode)", async () => {
    const action = vi.fn<ActionFn>();
    render(
      <LibraryList action={action}>
        <select data-testid="select" aria-label="pick">
          <option>one</option>
        </select>
        <textarea data-testid="textarea" aria-label="notes" />
        <span contentEditable data-testid="editable" suppressContentEditableWarning>
          edit me
        </span>
        <input data-testid="text" aria-label="text" />
        <label data-testid="label">
          <input type="checkbox" data-testid="checkbox" /> check
        </label>
      </LibraryList>,
    );

    for (const id of ["select", "textarea", "editable", "text", "checkbox"]) {
      await userEvent.click(screen.getByTestId(id));
      await flushToggle();
      expect(item("a").open, id).toBe(false);
      expect(action, id).not.toHaveBeenCalled();
      // The control itself still works: the click reached it.
      if (id === "checkbox") expect(screen.getByTestId(id)).toBeChecked();
      else expect(screen.getByTestId(id), id).toHaveFocus();
    }
  });
});

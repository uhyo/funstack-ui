// `readOnly` on CheckboxGroup.Root (conventions 3.6.1, design/components/checkbox-group.md 11):
// the fieldset is a `group` (no read-only state), so every Item and Parent carries
// `aria-readonly`; their `onChange` cancels the click and nothing dispatches; the computed "at
// least one" `required` is withheld. The DOM `checked` after a cancelled click is asserted in
// real engines (checkbox-group.browser.test.tsx): jsdom toggles it again in its canceled-activation
// steps.
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { deferred, hydrateFromServer, setupUser } from "../__tests__/helpers.js";
import { Field } from "../field/index.js";
import { CheckboxGroup } from "./index.js";
import type { CheckboxGroupRootProps } from "./index.js";

type Fn = (next: string[], details: { reason: string }) => unknown;

function Group(props: CheckboxGroupRootProps) {
  return (
    <CheckboxGroup.Root aria-label="Toppings" {...props}>
      <CheckboxGroup.Label>Toppings</CheckboxGroup.Label>
      <CheckboxGroup.Parent values={["a", "b"]} aria-label="All" />
      <CheckboxGroup.Item value="a" aria-label="a" />
      <CheckboxGroup.Item value="b" aria-label="b" />
    </CheckboxGroup.Root>
  );
}

const box = (name: string) => screen.getByRole("checkbox", { name }) as HTMLInputElement;
const group = () => screen.getByRole("group");

describe("CheckboxGroup readOnly (conventions 3.6.1)", () => {
  it("aria-readonly on every Item and Parent, not on the group; data-readonly and state everywhere", () => {
    const rootClass = vi.fn(() => "r");
    const itemClass = vi.fn(() => "i");
    const parentClass = vi.fn(() => "p");
    render(
      <CheckboxGroup.Root aria-label="T" readOnly defaultValue={["a"]} className={rootClass}>
        <CheckboxGroup.Parent values={["a", "b"]} aria-label="All" className={parentClass} />
        <CheckboxGroup.Item value="a" aria-label="a" className={itemClass} />
        <CheckboxGroup.Item value="b" aria-label="b" />
      </CheckboxGroup.Root>,
    );
    expect(group()).not.toHaveAttribute("aria-readonly");
    expect(group()).toHaveAttribute("data-readonly", "");
    for (const name of ["All", "a", "b"]) {
      expect(box(name)).toHaveAttribute("aria-readonly", "true");
      expect(box(name)).toHaveAttribute("data-readonly", "");
      expect(box(name)).not.toHaveAttribute("readonly");
      expect(box(name)).not.toBeDisabled();
    }
    for (const fn of [rootClass, itemClass, parentClass]) {
      expect(fn).toHaveBeenLastCalledWith(expect.objectContaining({ readOnly: true }));
    }
  });

  it("not read-only: no aria-readonly, no data-readonly", () => {
    render(<Group />);
    expect(box("a")).not.toHaveAttribute("aria-readonly");
    expect(box("All")).not.toHaveAttribute("aria-readonly");
    expect(group()).not.toHaveAttribute("data-readonly");
  });

  it.each([
    ["an Item", "a"],
    ["the Parent", "All"],
  ])("a click on %s dispatches nothing and fires no input / change", async (_part, name) => {
    const action = vi.fn<Fn>();
    const { container } = render(
      <Group readOnly defaultValue={["a"]} valueChangeAction={action} />,
    );
    const seen: string[] = [];
    container.addEventListener("input", () => seen.push("input"), true);
    container.addEventListener("change", () => seen.push("change"), true);
    await setupUser().click(box(name));
    await act(async () => {});
    expect(action).not.toHaveBeenCalled();
    expect(seen).toEqual([]);
    expect(group()).not.toHaveAttribute("data-pending");
    expect(box("a")).toHaveAttribute("data-checked", "");
    expect(box("b")).not.toHaveAttribute("data-checked");
  });

  it("submitted; the computed required is withheld (never valueMissing)", () => {
    render(
      <form data-testid="form">
        <Group name="t" readOnly required />
      </form>,
    );
    expect(box("a")).not.toBeRequired();
    expect(box("b")).not.toBeRequired();
    expect((screen.getByTestId("form") as HTMLFormElement).checkValidity()).toBe(true);
  });

  it("a checked read-only group posts its values", () => {
    render(
      <form data-testid="form">
        <Group name="t" readOnly defaultValue={["a", "b"]} />
      </form>,
    );
    expect(new FormData(screen.getByTestId("form") as HTMLFormElement).getAll("t")).toEqual([
      "a",
      "b",
    ]);
  });

  it("a form reset still follows (reason platform)", async () => {
    const action = vi.fn<Fn>();
    const { rerender } = render(
      <form data-testid="form">
        <Group readOnly value={["a"]} valueChangeAction={action} />
      </form>,
    );
    rerender(
      <form data-testid="form">
        <Group readOnly value={["b"]} valueChangeAction={action} />
      </form>,
    );
    await act(async () => {
      (screen.getByTestId("form") as HTMLFormElement).reset();
      await Promise.resolve();
    });
    expect(action.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([[["a"], "platform"]]);
  });

  it("readOnly turned on while pending cancels nothing", async () => {
    const d = deferred();
    const action = vi.fn<Fn>(() => d.promise);
    const { rerender } = render(<Group valueChangeAction={action} />);
    await setupUser().click(box("a"));
    expect(group()).toHaveAttribute("data-pending", "");
    rerender(<Group readOnly valueChangeAction={action} />);
    expect(group()).toHaveAttribute("data-pending", "");
    await act(async () => d.resolve());
    expect(group()).not.toHaveAttribute("data-pending");
    expect(box("a")).toHaveAttribute("data-checked", "");
    await setupUser().click(box("b"));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("Field.Root readOnly reaches every box and the Field parts", () => {
    render(
      <Field.Root name="t" readOnly data-testid="field">
        <Field.Label>Toppings</Field.Label>
        <CheckboxGroup.Root>
          <CheckboxGroup.Item value="a" aria-label="a" />
        </CheckboxGroup.Root>
      </Field.Root>,
    );
    expect(box("a")).toHaveAttribute("aria-readonly", "true");
    expect(screen.getByTestId("field")).toHaveAttribute("data-readonly", "");
  });

  it("boxes clicked before hydration are put back at mount; nothing dispatched", async () => {
    const action = vi.fn<Fn>();
    await hydrateFromServer(<Group readOnly defaultValue={["a"]} valueChangeAction={action} />, {
      mutate: (container) => {
        const [parent, a, b] = container.querySelectorAll<HTMLInputElement>("input");
        a!.checked = false;
        b!.checked = true;
        parent!.checked = true;
      },
    });
    expect(box("a").checked).toBe(true);
    expect(box("b").checked).toBe(false);
    expect(box("All").checked).toBe(false);
    expect(box("All").indeterminate).toBe(true);
    expect(action).not.toHaveBeenCalled();
  });
});

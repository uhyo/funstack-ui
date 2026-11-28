// `readOnly` on MultiSelect.Root (conventions 3.6.1, design/components/multi-select.md B.10):
// the Trigger stays an enabled, focusable button with `aria-readonly`, the popup never opens,
// nothing dispatches, the hidden inputs post, and the validity element's `required` is withheld.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { deferred, flushTasks, setupUser } from "../__tests__/helpers.js";
import { Field } from "../field/index.js";
import { MultiSelect } from "./index.js";
import type { MultiSelectRootProps } from "./index.js";

type Fn = (next: unknown, details: { reason: string }) => unknown;

function Box(props: Partial<MultiSelectRootProps>) {
  return (
    <form data-testid="form">
      <button type="button">before</button>
      <MultiSelect.Root name="toppings" defaultValue={["ham"]} {...props}>
        <MultiSelect.Label data-testid="label">Toppings</MultiSelect.Label>
        <MultiSelect.Trigger data-testid="trigger">
          <MultiSelect.Value data-testid="value" />
        </MultiSelect.Trigger>
        <MultiSelect.Popup data-testid="popup">
          <MultiSelect.List>
            <MultiSelect.Option value="ham">Ham</MultiSelect.Option>
            <MultiSelect.Option value="olive">Olive</MultiSelect.Option>
          </MultiSelect.List>
        </MultiSelect.Popup>
      </MultiSelect.Root>
    </form>
  );
}

const trigger = () => screen.getByTestId("trigger");
const popup = () => screen.getByTestId("popup");
const isOpen = () => popup().matches(":popover-open");
const formValues = () =>
  new FormData(screen.getByTestId("form") as HTMLFormElement).getAll("toppings");

describe("MultiSelect readOnly (conventions 3.6.1)", () => {
  it("the Trigger is enabled with aria-readonly; data-readonly and state on every part", () => {
    const triggerState = vi.fn(() => "t");
    render(
      <MultiSelect.Root readOnly>
        <MultiSelect.Label data-testid="label">Toppings</MultiSelect.Label>
        <MultiSelect.Trigger data-testid="trigger" className={triggerState}>
          <MultiSelect.Value data-testid="value" />
        </MultiSelect.Trigger>
      </MultiSelect.Root>,
    );
    expect(trigger()).not.toBeDisabled();
    expect(trigger()).toHaveAttribute("aria-readonly", "true");
    for (const id of ["trigger", "label", "value"]) {
      expect(screen.getByTestId(id)).toHaveAttribute("data-readonly", "");
    }
    expect(triggerState).toHaveBeenLastCalledWith(expect.objectContaining({ readOnly: true }));
  });

  it("not read-only: no aria-readonly", () => {
    render(<Box />);
    expect(trigger()).not.toHaveAttribute("aria-readonly");
    expect(trigger()).not.toHaveAttribute("data-readonly");
  });

  it("a press, Enter, Space, the arrows and typeahead open nothing and dispatch nothing", async () => {
    const openAction = vi.fn<Fn>();
    const valueAction = vi.fn<Fn>();
    render(<Box readOnly openChangeAction={openAction} valueChangeAction={valueAction} />);
    const user = setupUser();
    await user.click(trigger());
    expect(trigger()).toHaveFocus();
    await user.keyboard("{Enter}{ }{ArrowDown}{ArrowUp}{Home}{End}o");
    fireEvent.keyDown(trigger(), { key: "ArrowDown", altKey: true });
    await flushTasks(2);
    expect(isOpen()).toBe(false);
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(openAction).not.toHaveBeenCalled();
    expect(valueAction).not.toHaveBeenCalled();
  });

  it("focusable and in the Tab order", async () => {
    render(<Box readOnly />);
    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "before" }));
    await user.tab();
    expect(trigger()).toHaveFocus();
  });

  it("the hidden inputs are not disabled: the selection is submitted", () => {
    render(<Box readOnly defaultValue={["ham", "olive"]} />);
    expect(formValues()).toEqual(["ham", "olive"]);
  });

  it("the validity element's required is withheld: never valueMissing", () => {
    render(<Box readOnly required defaultValue={[]} />);
    const validity = trigger().nextElementSibling as HTMLSelectElement;
    expect(validity.tagName).toBe("SELECT");
    expect(validity.required).toBe(false);
    expect((screen.getByTestId("form") as HTMLFormElement).checkValidity()).toBe(true);
    // `aria-required` and `data-required` stay the prop's (rule 5).
    expect(trigger()).toHaveAttribute("aria-required", "true");
  });

  it("a popup open when readOnly turns on closes", async () => {
    function App() {
      const [readOnly, setReadOnly] = useState(false);
      return (
        <>
          <button type="button" data-testid="lock" onClick={() => setReadOnly(true)}>
            Lock
          </button>
          <Box readOnly={readOnly} />
        </>
      );
    }
    render(<App />);
    const user = setupUser();
    await user.click(trigger());
    await flushTasks(2);
    expect(isOpen()).toBe(true);
    await act(async () => screen.getByTestId("lock").click());
    await flushTasks(2);
    expect(isOpen()).toBe(false);
  });

  it("Field.Root readOnly reaches the Trigger and the Field parts", () => {
    render(
      <Field.Root name="toppings" readOnly data-testid="field">
        <Field.Label>Toppings</Field.Label>
        <MultiSelect.Root>
          <MultiSelect.Trigger data-testid="trigger" />
        </MultiSelect.Root>
      </Field.Root>,
    );
    expect(trigger()).toHaveAttribute("aria-readonly", "true");
    expect(screen.getByTestId("field")).toHaveAttribute("data-readonly", "");
  });

  it("a popup a controlled parent keeps open: Alt+ArrowUp requests the close again; Escape is not consumed", async () => {
    const openAction = vi.fn<Fn>();
    await act(async () => {
      render(<Box readOnly open openChangeAction={openAction} onOpenChange={() => {}} />);
    });
    await flushTasks(2);
    // Mounted read-only and open: one close request already, which the parent refused.
    expect(openAction.mock.calls.map(([n]) => n)).toEqual([false]);
    expect(isOpen()).toBe(true);
    openAction.mockClear();
    trigger().focus();
    expect(fireEvent.keyDown(trigger(), { key: "ArrowUp", altKey: true })).toBe(false);
    await flushTasks(2);
    expect(openAction.mock.calls.map(([n]) => n)).toEqual([false]);
    // Escape is the platform's close watcher (multi-select.browser.test.tsx): not prevented.
    expect(fireEvent.keyDown(trigger(), { key: "Escape" })).toBe(true);
    // Moving and toggling keys stay inert.
    expect(fireEvent.keyDown(trigger(), { key: "ArrowDown" })).toBe(true);
    expect(fireEvent.keyDown(trigger(), { key: "Enter" })).toBe(true);
    await flushTasks(2);
    expect(openAction).toHaveBeenCalledTimes(1);
  });

  it("readOnly turned on while a toggle is pending cancels nothing (rule 12)", async () => {
    const d = deferred();
    const action = vi.fn<Fn>(() => d.promise);
    const { rerender } = render(<Box valueChangeAction={action} />);
    const user = setupUser();
    await user.click(trigger());
    await flushTasks(2);
    await user.click(screen.getByRole("option", { name: "Olive" }));
    await flushTasks(2);
    expect(trigger()).toHaveAttribute("data-pending", "");
    await act(async () => rerender(<Box readOnly valueChangeAction={action} />));
    await flushTasks(2);
    expect(trigger()).toHaveAttribute("data-pending", "");
    expect(formValues()).toEqual(["ham", "olive"]);
    await act(async () => d.resolve());
    await flushTasks(2);
    expect(trigger()).not.toHaveAttribute("data-pending");
    expect(formValues()).toEqual(["ham", "olive"]);
    expect(action).toHaveBeenCalledTimes(1);
    expect(isOpen()).toBe(false);
  });

  it("disabled wins: the Trigger is disabled; state.readOnly stays the prop", () => {
    render(<Box readOnly disabled />);
    expect(trigger()).toBeDisabled();
    expect(trigger()).toHaveAttribute("data-readonly", "");
  });
});

// `readOnly` on Select.Root (conventions 3.6.1, design/components/select.md 2): every option but
// the selected one renders native `disabled`, so the platform refuses a pick; the select itself
// stays enabled and focusable, posts its value, carries `aria-readonly` and `data-readonly`, and
// renders no native `required`. The picker, the arrows and typeahead in real engines are probe P4
// (select.browser.test.tsx).
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { deferred, hydrateFromServer, setupUser } from "../__tests__/helpers.js";
import { Field } from "../field/index.js";
import { Select } from "./index.js";
import type { SelectRootProps } from "./index.js";

type Fn = (next: string, details: { reason: string }) => unknown;

function Fruits(props: SelectRootProps) {
  return (
    <Select.Root aria-label="Fruit" {...props}>
      <Select.Option value="a">Apple</Select.Option>
      <Select.Option value="b">Banana</Select.Option>
      <Select.Option value="c" disabled>
        Cherry
      </Select.Option>
    </Select.Root>
  );
}

const sel = () => screen.getByRole("combobox") as HTMLSelectElement;
const opt = (v: string) => sel().querySelector<HTMLOptionElement>(`option[value="${v}"]`)!;

describe("Select readOnly (conventions 3.6.1)", () => {
  it("unselected options are natively disabled; the select is enabled, aria-readonly, data-readonly", () => {
    const rootClass = vi.fn(() => "r");
    const optionClass = vi.fn(() => "o");
    render(
      <Select.Root aria-label="Fruit" readOnly defaultValue="b" className={rootClass}>
        <Select.Option value="a" className={optionClass}>
          Apple
        </Select.Option>
        <Select.Option value="b">Banana</Select.Option>
      </Select.Root>,
    );
    expect(sel()).not.toBeDisabled();
    expect(sel()).toHaveAttribute("aria-readonly", "true");
    expect(sel()).toHaveAttribute("data-readonly", "");
    expect(opt("a").disabled).toBe(true);
    expect(opt("a")).toHaveAttribute("data-disabled", "");
    expect(opt("a")).toHaveAttribute("data-readonly", "");
    expect(opt("b").disabled).toBe(false);
    expect(opt("b")).not.toHaveAttribute("data-disabled");
    expect(rootClass).toHaveBeenLastCalledWith(expect.objectContaining({ readOnly: true }));
    expect(optionClass).toHaveBeenLastCalledWith(
      expect.objectContaining({ readOnly: true, disabled: true, selected: false }),
    );
  });

  it("not read-only: options keep their own disabled; no aria-readonly", () => {
    render(<Fruits defaultValue="b" />);
    expect(opt("a").disabled).toBe(false);
    expect(opt("c").disabled).toBe(true);
    expect(sel()).not.toHaveAttribute("aria-readonly");
    expect(sel()).not.toHaveAttribute("data-readonly");
  });

  it("the Trigger and Value carry data-readonly and readOnly in their state", () => {
    const triggerClass = vi.fn(() => "t");
    render(
      <Select.Root aria-label="Fruit" readOnly defaultValue="a">
        <Select.Trigger className={triggerClass} data-testid="trigger">
          <Select.Value data-testid="value" />
        </Select.Trigger>
        <Select.Option value="a">Apple</Select.Option>
      </Select.Root>,
    );
    expect(screen.getByTestId("trigger")).toHaveAttribute("data-readonly", "");
    expect(screen.getByTestId("value")).toHaveAttribute("data-readonly", "");
    expect(triggerClass).toHaveBeenLastCalledWith(expect.objectContaining({ readOnly: true }));
  });

  it("focusable; the keyboard on the closed select changes nothing and dispatches nothing", async () => {
    const action = vi.fn<Fn>();
    render(
      <>
        <button type="button">before</button>
        <Fruits readOnly defaultValue="a" valueChangeAction={action} />
      </>,
    );
    const user = setupUser();
    await user.click(screen.getByRole("button"));
    await user.tab();
    expect(sel()).toHaveFocus();
    await user.keyboard("{ArrowDown}{End}b");
    expect(sel().value).toBe("a");
    expect(action).not.toHaveBeenCalled();
  });

  it("a stray change event (no cancelable event before it) dispatches nothing", () => {
    const action = vi.fn<Fn>();
    render(<Fruits readOnly defaultValue="a" valueChangeAction={action} />);
    // What a disabled option cannot produce, simulated: the select's own handler refuses it.
    sel().value = "b";
    fireEvent.change(sel());
    expect(action).not.toHaveBeenCalled();
    expect(sel().value).toBe("a");
  });

  it("posts its value; required is withheld", () => {
    render(
      <form data-testid="form">
        <Select.Root aria-label="Fruit" name="fruit" readOnly required defaultValue="">
          <Select.Option value="">Choose</Select.Option>
          <Select.Option value="a">Apple</Select.Option>
        </Select.Root>
      </form>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(sel()).not.toBeRequired();
    expect(sel().validity.valueMissing).toBe(false);
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).get("fruit")).toBe("");
  });

  it("a form reset still follows; the newly selected option is the enabled one", async () => {
    const action = vi.fn<Fn>();
    render(
      <form data-testid="form">
        <Fruits name="fruit" readOnly value="b" valueChangeAction={action} />
      </form>,
    );
    expect(opt("b").disabled).toBe(false);
    // The reset target is the mount-time value: changing it is the parent's (a remount here).
    const form = screen.getByTestId("form") as HTMLFormElement;
    opt("a").defaultSelected = true;
    opt("b").defaultSelected = false;
    await act(async () => {
      form.reset();
      await Promise.resolve();
    });
    expect(action.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([["a", "platform"]]);
  });

  it("uncontrolled reset: back to defaultValue, and that option is enabled", async () => {
    function App({ value }: { value?: string }) {
      return (
        <form data-testid="form">
          <Fruits name="fruit" readOnly defaultValue="a" {...(value && { value })} />
        </form>
      );
    }
    render(<App />);
    const form = screen.getByTestId("form") as HTMLFormElement;
    await act(async () => {
      form.reset();
      await Promise.resolve();
    });
    expect(sel().value).toBe("a");
    expect(opt("a").disabled).toBe(false);
    expect(opt("b").disabled).toBe(true);
    expect(new FormData(form).get("fruit")).toBe("a");
  });

  it("readOnly turned on while pending cancels nothing; the optimistic option is the enabled one", async () => {
    const d = deferred();
    const action = vi.fn<Fn>(() => d.promise);
    const { rerender } = render(<Fruits defaultValue="a" valueChangeAction={action} />);
    await setupUser().selectOptions(sel(), "b");
    expect(sel()).toHaveAttribute("data-pending", "");
    rerender(<Fruits readOnly defaultValue="a" valueChangeAction={action} />);
    expect(sel()).toHaveAttribute("data-pending", "");
    expect(opt("b").disabled).toBe(false);
    expect(opt("a").disabled).toBe(true);
    await act(async () => d.resolve());
    expect(sel()).not.toHaveAttribute("data-pending");
    expect(sel().value).toBe("b");
  });

  it("Field.Root readOnly reaches the select and the Field parts", () => {
    render(
      <Field.Root name="fruit" readOnly data-testid="field">
        <Field.Label>Fruit</Field.Label>
        <Select.Root defaultValue="a">
          <Select.Option value="a">Apple</Select.Option>
          <Select.Option value="b">Banana</Select.Option>
        </Select.Root>
      </Field.Root>,
    );
    expect(sel()).toHaveAttribute("aria-readonly", "true");
    expect(opt("b").disabled).toBe(true);
    expect(screen.getByTestId("field")).toHaveAttribute("data-readonly", "");
  });

  it("disabled wins: the select is disabled; state.readOnly stays the prop", () => {
    const rootClass = vi.fn(() => "r");
    render(<Fruits readOnly disabled className={rootClass} />);
    expect(sel()).toBeDisabled();
    expect(rootClass).toHaveBeenLastCalledWith(
      expect.objectContaining({ readOnly: true, disabled: true }),
    );
  });

  it("the server HTML already disables the unselected options (before hydration)", async () => {
    const action = vi.fn<Fn>();
    await hydrateFromServer(<Fruits readOnly defaultValue="b" valueChangeAction={action} />, {
      mutate: (container) => {
        const select = container.querySelector("select")!;
        expect(select.querySelector<HTMLOptionElement>('option[value="a"]')!.disabled).toBe(true);
        expect(select.value).toBe("b");
      },
    });
    expect(sel().value).toBe("b");
    expect(action).not.toHaveBeenCalled();
  });
});

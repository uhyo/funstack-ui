// `readOnly` on RadioGroup.Root (conventions 3.6.1, design/components/radio-group.md): the
// radiogroup carries `aria-readonly`, every part `data-readonly`; each Item's `onChange` cancels
// its click, so nothing dispatches and no `input` / `change` fires. The DOM `checked` after a
// cancelled click and the arrow keys (probes P2, P3) are asserted in real engines
// (radio-group.browser.test.tsx): jsdom's canceled-activation steps differ from the browsers'.
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { deferred, hydrateFromServer, setupUser } from "../__tests__/helpers.js";
import { Field } from "../field/index.js";
import { RadioGroup } from "./index.js";
import type { RadioGroupRootProps } from "./index.js";

type Fn = (next: string | null, details: { reason: string }) => unknown;

function Group(props: RadioGroupRootProps) {
  return (
    <RadioGroup.Root aria-label="Plan" {...props}>
      <RadioGroup.Label data-testid="label">Plan</RadioGroup.Label>
      {["a", "b", "c"].map((v) => (
        <label key={v}>
          <RadioGroup.Item value={v} />
          Plan {v}
        </label>
      ))}
    </RadioGroup.Root>
  );
}

const group = () => screen.getByRole("radiogroup");
const radio = (v: string) => screen.getByRole("radio", { name: `Plan ${v}` }) as HTMLInputElement;

describe("RadioGroup readOnly (conventions 3.6.1)", () => {
  it("aria-readonly on the radiogroup, nothing on the radios; data-readonly and state everywhere", () => {
    const rootClass = vi.fn(() => "r");
    const itemClass = vi.fn(() => "i");
    render(
      <RadioGroup.Root aria-label="Plan" readOnly defaultValue="b" className={rootClass}>
        <RadioGroup.Item value="a" aria-label="Plan a" className={itemClass} />
        <RadioGroup.Item value="b" aria-label="Plan b" />
      </RadioGroup.Root>,
    );
    expect(group()).toHaveAttribute("aria-readonly", "true");
    expect(group()).toHaveAttribute("data-readonly", "");
    expect(group()).not.toBeDisabled();
    for (const v of ["a", "b"]) {
      expect(radio(v)).not.toHaveAttribute("aria-readonly");
      expect(radio(v)).not.toHaveAttribute("readonly");
      expect(radio(v)).toHaveAttribute("data-readonly", "");
      expect(radio(v)).not.toBeDisabled();
    }
    expect(rootClass).toHaveBeenLastCalledWith(expect.objectContaining({ readOnly: true }));
    expect(itemClass).toHaveBeenLastCalledWith(expect.objectContaining({ readOnly: true }));
  });

  it("not read-only: no aria-readonly, no data-readonly", () => {
    render(<Group />);
    expect(group()).not.toHaveAttribute("aria-readonly");
    expect(group()).not.toHaveAttribute("data-readonly");
  });

  it("the Label receives readOnly in its state", () => {
    const labelClass = vi.fn(() => "l");
    render(
      <RadioGroup.Root readOnly>
        <RadioGroup.Label className={labelClass}>Plan</RadioGroup.Label>
        <RadioGroup.Item value="a" aria-label="a" />
      </RadioGroup.Root>,
    );
    expect(labelClass).toHaveBeenLastCalledWith(expect.objectContaining({ readOnly: true }));
  });

  it.each([
    ["a click on a radio", () => radio("a")],
    ["a click on a label", () => screen.getByText("Plan c")],
  ])("%s dispatches nothing and fires no input / change", async (_path, target) => {
    const action = vi.fn<Fn>();
    const { container } = render(<Group readOnly defaultValue="b" valueChangeAction={action} />);
    const seen: string[] = [];
    container.addEventListener("input", () => seen.push("input"), true);
    container.addEventListener("change", () => seen.push("change"), true);
    await setupUser().click(target());
    await act(async () => {});
    expect(action).not.toHaveBeenCalled();
    expect(seen).toEqual([]);
    expect(group()).not.toHaveAttribute("data-pending");
    expect(radio("b")).toHaveAttribute("data-checked", "");
  });

  it("submitted; required is withheld so the group never blocks the form", () => {
    render(
      <form data-testid="form">
        <Group name="plan" readOnly required defaultValue="b" />
      </form>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(new FormData(form).get("plan")).toBe("b");
    for (const v of ["a", "b", "c"]) expect(radio(v)).not.toBeRequired();
    // `aria-required` stays the prop's (rule 5).
    expect(group()).toHaveAttribute("aria-required", "true");
  });

  it("an unchecked read-only required group is not valueMissing", () => {
    render(
      <form data-testid="form">
        <Group name="plan" readOnly required />
      </form>,
    );
    expect(radio("a").validity.valueMissing).toBe(false);
    expect((screen.getByTestId("form") as HTMLFormElement).checkValidity()).toBe(true);
  });

  it("a form reset still follows (reason platform)", async () => {
    const action = vi.fn<Fn>();
    const { rerender } = render(
      <form data-testid="form">
        <Group readOnly value="a" valueChangeAction={action} />
      </form>,
    );
    rerender(
      <form data-testid="form">
        <Group readOnly value="c" valueChangeAction={action} />
      </form>,
    );
    await act(async () => {
      (screen.getByTestId("form") as HTMLFormElement).reset();
      await Promise.resolve();
    });
    expect(action.mock.calls.map(([n, d]) => [n, d.reason])).toEqual([["a", "platform"]]);
  });

  it("readOnly turned on while pending cancels nothing", async () => {
    const d = deferred();
    const action = vi.fn<Fn>(() => d.promise);
    const { rerender } = render(<Group defaultValue="a" valueChangeAction={action} />);
    await setupUser().click(radio("b"));
    expect(group()).toHaveAttribute("data-pending", "");
    rerender(<Group readOnly defaultValue="a" valueChangeAction={action} />);
    expect(group()).toHaveAttribute("data-pending", "");
    await act(async () => d.resolve());
    expect(group()).not.toHaveAttribute("data-pending");
    expect(radio("b")).toHaveAttribute("data-checked", "");
    await setupUser().click(radio("c"));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("Field.Root readOnly reaches the group and the Field parts", () => {
    render(
      <Field.Root name="plan" readOnly data-testid="field">
        <Field.Label>Plan</Field.Label>
        <RadioGroup.Root>
          <RadioGroup.Item value="a" aria-label="Plan a" />
        </RadioGroup.Root>
      </Field.Root>,
    );
    expect(group()).toHaveAttribute("aria-readonly", "true");
    expect(radio("a")).toHaveAttribute("data-readonly", "");
    expect(screen.getByTestId("field")).toHaveAttribute("data-readonly", "");
  });

  it("disabled wins: the fieldset is disabled; state.readOnly stays the prop", () => {
    const rootClass = vi.fn(() => "r");
    render(<Group readOnly disabled className={rootClass} />);
    expect(group()).toBeDisabled();
    expect(rootClass).toHaveBeenLastCalledWith(
      expect.objectContaining({ readOnly: true, disabled: true }),
    );
  });

  it("a radio checked before hydration is unchecked again at mount; nothing dispatched", async () => {
    const action = vi.fn<Fn>();
    await hydrateFromServer(<Group readOnly defaultValue="b" valueChangeAction={action} />, {
      mutate: (container) => {
        container.querySelector<HTMLInputElement>('input[value="c"]')!.checked = true;
      },
    });
    expect(radio("c").checked).toBe(false);
    expect(radio("b").checked).toBe(true);
    expect(action).not.toHaveBeenCalled();
  });
});

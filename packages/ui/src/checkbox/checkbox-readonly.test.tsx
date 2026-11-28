// `readOnly` on Checkbox and Switch (conventions 3.6.1, design/components/checkbox.md 8,
// switch.md): the library's prop, not the HTML attribute. The click is cancelled from the part's
// own `onChange` (internal-hooks 3.8 rule 9), so nothing dispatches and no `input` / `change`
// fires; the box stays focusable and submitted, is barred from validation and follows a reset.
// jsdom 30 toggles `checked` again in its canceled-activation steps instead of restoring the
// saved value (after react-dom already restored it), so the DOM `checked` after a cancelled
// click is asserted in real engines only: checkbox.browser.test.tsx (probe P1).
import { act, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it, vi } from "vitest";
import { deferred, hydrateFromServer, setupUser } from "../__tests__/helpers.js";
import { Field } from "../field/index.js";
import { Switch } from "../switch/index.js";
import type { SwitchProps } from "../switch/index.js";
import { Checkbox } from "./index.js";

type Fn = (next: boolean, details: { reason: string }) => unknown;

const controls: [string, ComponentType<SwitchProps>, "checkbox" | "switch"][] = [
  ["Checkbox", Checkbox as ComponentType<SwitchProps>, "checkbox"],
  ["Switch", Switch, "switch"],
];

/** Every `input` / `change` inside `container` (removed with it after the test). */
function recordFormEvents(container: HTMLElement): string[] {
  const seen: string[] = [];
  const listener = (event: Event) => seen.push(event.type);
  container.addEventListener("input", listener, true);
  container.addEventListener("change", listener, true);
  return seen;
}

describe.each(controls)("%s readOnly (conventions 3.6.1)", (_name, Control, role) => {
  const input = () => screen.getByRole(role) as HTMLInputElement;

  it("is focusable, marked aria-readonly and data-readonly, never the HTML attribute", async () => {
    const className = vi.fn(() => "c");
    render(
      <>
        <button type="button">before</button>
        <Control aria-label="Wi-Fi" readOnly className={className} />
      </>,
    );
    expect(input()).not.toBeDisabled();
    expect(input()).toHaveAttribute("aria-readonly", "true");
    expect(input()).toHaveAttribute("data-readonly", "");
    expect(input()).not.toHaveAttribute("readonly");
    expect(className).toHaveBeenLastCalledWith(expect.objectContaining({ readOnly: true }));
    const user = setupUser();
    await user.click(screen.getByRole("button"));
    await user.tab();
    expect(input()).toHaveFocus();
  });

  it("no aria-readonly or data-readonly while not read-only", () => {
    render(<Control aria-label="Wi-Fi" />);
    expect(input()).not.toHaveAttribute("aria-readonly");
    expect(input()).not.toHaveAttribute("data-readonly");
  });

  // One gesture per render: after jsdom's double toggle the next click is not a change to React.
  it.each([
    ["a click", async (user: ReturnType<typeof setupUser>) => user.click(input())],
    [
      "Space",
      async (user: ReturnType<typeof setupUser>) => {
        input().focus();
        await user.keyboard(" ");
      },
    ],
    [
      "a label click",
      async (user: ReturnType<typeof setupUser>) => user.click(screen.getByText("Wi-Fi")),
    ],
  ])("%s dispatches nothing and fires no input / change", async (_path, gesture) => {
    const action = vi.fn<Fn>();
    const { container } = render(
      <label>
        <Control readOnly defaultChecked={false} checkedChangeAction={action} />
        Wi-Fi
      </label>,
    );
    const seen = recordFormEvents(container);
    await gesture(setupUser());
    await act(async () => {});
    expect(action).not.toHaveBeenCalled();
    expect(seen).toEqual([]);
    expect(input()).not.toHaveAttribute("data-pending");
    expect(input()).not.toHaveAttribute("data-checked");
  });

  it("a checked read-only box is submitted", () => {
    render(
      <form data-testid="form">
        <Control aria-label="Wi-Fi" name="wifi" readOnly defaultChecked />
      </form>,
    );
    expect(input().checked).toBe(true);
    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(new FormData(form).get("wifi")).toBe("on");
  });

  it("required is withheld: an unchecked read-only box never blocks the form", () => {
    render(
      <form data-testid="form">
        <Control aria-label="Wi-Fi" name="wifi" readOnly required />
      </form>,
    );
    expect(input()).not.toBeRequired();
    expect(input().validity.valueMissing).toBe(false);
    expect((screen.getByTestId("form") as HTMLFormElement).checkValidity()).toBe(true);
  });

  it("a form reset still follows (reason platform)", async () => {
    const action = vi.fn<Fn>();
    const { rerender } = render(
      <form data-testid="form">
        <Control aria-label="Wi-Fi" readOnly checked={false} checkedChangeAction={action} />
      </form>,
    );
    // The parent changes the value; the reset target is the mount-time value (`false`).
    rerender(
      <form data-testid="form">
        <Control aria-label="Wi-Fi" readOnly checked checkedChangeAction={action} />
      </form>,
    );
    expect(input().checked).toBe(true);
    await act(async () => {
      (screen.getByTestId("form") as HTMLFormElement).reset();
      await Promise.resolve();
    });
    expect(action.mock.calls.map(([next, d]) => [next, d.reason])).toEqual([[false, "platform"]]);
  });

  it("readOnly turned on while pending cancels nothing; later clicks are refused", async () => {
    const d = deferred();
    const action = vi.fn<Fn>(() => d.promise);
    const { rerender } = render(<Control aria-label="Wi-Fi" checkedChangeAction={action} />);
    const user = setupUser();
    await user.click(input());
    expect(input()).toHaveAttribute("data-pending", "");
    rerender(<Control aria-label="Wi-Fi" readOnly checkedChangeAction={action} />);
    expect(input()).toHaveAttribute("data-pending", "");
    expect(input().checked).toBe(true);
    await act(async () => d.resolve());
    expect(input()).not.toHaveAttribute("data-pending");
    expect(input().checked).toBe(true);
    await user.click(input());
    expect(input()).not.toHaveAttribute("data-pending");
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("Field.Root readOnly reaches the control and every Field part", async () => {
    const action = vi.fn<Fn>();
    render(
      <Field.Root name="wifi" readOnly data-testid="field">
        <Field.Label>Wi-Fi</Field.Label>
        <Control checkedChangeAction={action} />
      </Field.Root>,
    );
    expect(input()).toHaveAttribute("aria-readonly", "true");
    expect(input()).toHaveAttribute("data-readonly", "");
    expect(screen.getByTestId("field")).toHaveAttribute("data-readonly", "");
    expect(screen.getByText("Wi-Fi")).toHaveAttribute("data-readonly", "");
    await setupUser().click(input());
    expect(action).not.toHaveBeenCalled();
    expect(input()).not.toHaveAttribute("data-checked");
  });

  it("its own readOnly marks the Field parts too (through the registration)", () => {
    render(
      <Field.Root name="wifi" data-testid="field">
        <Field.Label>Wi-Fi</Field.Label>
        <Control readOnly />
      </Field.Root>,
    );
    expect(screen.getByTestId("field")).toHaveAttribute("data-readonly", "");
  });

  it("disabled wins: natively disabled; state.readOnly stays the prop", () => {
    const className = vi.fn(() => "c");
    render(<Control aria-label="Wi-Fi" readOnly disabled className={className} />);
    expect(input()).toBeDisabled();
    expect(className).toHaveBeenLastCalledWith(
      expect.objectContaining({ readOnly: true, disabled: true }),
    );
  });

  it("a click before hydration is undone at mount, not dispatched (rule 13)", async () => {
    const action = vi.fn<Fn>();
    await hydrateFromServer(
      <Control aria-label="Wi-Fi" readOnly defaultChecked={false} checkedChangeAction={action} />,
      {
        mutate: (container) => {
          container.querySelector("input")!.checked = true;
        },
      },
    );
    expect(input().checked).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });
});

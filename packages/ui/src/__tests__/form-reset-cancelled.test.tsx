// A reset cancelled from React's delegated `onReset` on the form, in the script order (jsdom:
// `form.reset()` and a click on a reset button alike). The callback of `useFormReset` reads
// `defaultPrevented` after every listener (design/internal-hooks.md 3.8 rule 7), so nothing is
// dispatched and the DOM keeps the user's state. The real-click order is in
// form-reset-button.browser.test.tsx.
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "../checkbox/index.js";
import { NumberField } from "../number-field/index.js";
import { flushMicrotasks, setupUser } from "./helpers.js";

const form = () => screen.getByTestId("form") as HTMLFormElement;

function Cancelling({ children }: { children: React.ReactNode }) {
  return (
    <form data-testid="form" onReset={(e) => e.preventDefault()}>
      {children}
      <button type="reset">Reset</button>
    </form>
  );
}

describe("a reset cancelled in React's onReset", () => {
  it("a checkable control (Checkbox): no dispatch, stays checked", async () => {
    const user = setupUser();
    const action = vi.fn();
    render(
      <Cancelling>
        <Checkbox name="c" aria-label="c" checkedChangeAction={action} />
      </Cancelling>,
    );
    const box = screen.getByRole("checkbox");
    await user.click(box);
    expect(box).toBeChecked();
    action.mockClear();
    await act(async () => form().reset());
    await user.click(screen.getByRole("button", { name: "Reset" }));
    await flushMicrotasks();
    expect(action).not.toHaveBeenCalled();
    expect(box).toBeChecked();
  });

  it("a value control (NumberField): no dispatch, keeps its value", async () => {
    const user = setupUser();
    const action = vi.fn();
    render(
      <Cancelling>
        <NumberField.Root name="qty" locale="en-US" defaultValue={5} valueChangeAction={action}>
          <NumberField.Input aria-label="Quantity" />
        </NumberField.Root>
      </Cancelling>,
    );
    const input = screen.getByRole("textbox") as HTMLInputElement;
    await user.click(input);
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(input.value).toBe("7");
    action.mockClear();
    await act(async () => form().reset());
    await user.click(screen.getByRole("button", { name: "Reset" }));
    await flushMicrotasks();
    expect(action).not.toHaveBeenCalled();
    expect(input.value).toBe("7");
    expect((form().elements.namedItem("qty") as HTMLInputElement).value).toBe("7");
  });
});

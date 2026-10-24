// Checkbox, design/components/checkbox.md section 11. Rows 1 to 25 of the Switch plan run through
// the shared suite (C1's role pass-through is part of its row 2); the indeterminate rows C2 to C9
// follow. C6 (`:indeterminate` in real engines), rows 4b, 21b and the DOM half of 26 are in
// checkbox.browser.test.tsx; C10 (directive) is in src/__tests__/directives.test.ts.
import { act, render, screen } from "@testing-library/react";
import { startTransition, useState } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { describeCheckableInput } from "../__tests__/checkable-input-suite.js";
import {
  deferred,
  expectNotPending,
  expectPending,
  renderBoth,
  setupUser,
  flushMicrotasks,
  silenceErrors,
} from "../__tests__/helpers.js";
import type { ControlMode } from "../__tests__/helpers.js";
import { Checkbox } from "./index.js";
import type { CheckboxCheckedChangeDetails, CheckboxState } from "./index.js";

describeCheckableInput({
  name: "Checkbox",
  Control: Checkbox,
  role: "checkbox",
  extraState: { indeterminate: false },
  changeTypes: ["fsui-checkbox-check", "fsui-checkbox-uncheck"],
});

type ActionFn = (next: boolean, details: CheckboxCheckedChangeDetails) => unknown;

const box = () => screen.getByRole("checkbox") as HTMLInputElement;

/**
 * A "select all"-style parent: `checked` (controlled mode) or `defaultChecked` (uncontrolled) plus
 * a controlled `indeterminate` that the parent clears when an action succeeds, following the
 * "update on success" pattern. `catchErrors` keeps the box mounted on rejection.
 */
function MixedHarness({
  mode,
  action,
  catchErrors = false,
  clearMixedOnSuccess = true,
  inForm = false,
}: {
  mode: ControlMode;
  action?: ActionFn;
  catchErrors?: boolean;
  clearMixedOnSuccess?: boolean;
  inForm?: boolean;
}) {
  const [checked, setChecked] = useState(false);
  const [mixed, setMixed] = useState(true);
  const checkedChangeAction = async (next: boolean, details: CheckboxCheckedChangeDetails) => {
    try {
      await action?.(next, details);
    } catch (e) {
      if (!catchErrors) throw e;
      return;
    }
    startTransition(() => {
      setChecked(next);
      if (clearMixedOnSuccess) setMixed(false);
    });
  };
  const modeProps = mode === "controlled" ? { checked } : { defaultChecked: false };
  const control = (
    <Checkbox
      aria-label="Select all"
      name="all"
      {...modeProps}
      indeterminate={mixed}
      checkedChangeAction={checkedChangeAction}
    />
  );
  return inForm ? (
    <form data-testid="form">
      {control}
      <button type="reset">Reset</button>
    </form>
  ) : (
    control
  );
}

describe("Checkbox indeterminate", () => {
  it("aria-checked, including mixed, is removed through props and render (C1)", () => {
    const forced = { "aria-checked": "mixed" } as object;
    const viaProps = render(<Checkbox aria-label="All" indeterminate {...forced} />);
    expect(box()).not.toHaveAttribute("aria-checked");
    viaProps.unmount();
    render(<Checkbox aria-label="All" indeterminate render={<input aria-checked="mixed" />} />);
    expect(box()).not.toHaveAttribute("aria-checked");
  });

  it("sets the property and data-indeterminate, and follows the prop (C2)", () => {
    const { rerender } = render(<Checkbox aria-label="All" checked={false} indeterminate />);
    expect(box().indeterminate).toBe(true);
    expect(box()).toHaveAttribute("data-indeterminate", "");
    expect(box().checked).toBe(false);

    rerender(<Checkbox aria-label="All" checked={false} indeterminate={false} />);
    expect(box().indeterminate).toBe(false);
    expect(box()).not.toHaveAttribute("data-indeterminate");

    rerender(<Checkbox aria-label="All" checked={false} indeterminate />);
    expect(box().indeterminate).toBe(true);
    expect(box()).toHaveAttribute("data-indeterminate", "");

    rerender(<Checkbox aria-label="All" checked={false} />);
    expect(box().indeterminate).toBe(false);
    expect(box()).not.toHaveAttribute("data-indeterminate");
  });

  it("server-renders data-indeterminate and sets the property on hydration (C3)", async () => {
    const consoleError = silenceErrors();
    const ui = <Checkbox aria-label="All" indeterminate />;
    const html = renderToString(ui);
    expect(html).toContain('data-indeterminate=""');
    expect(html).not.toContain("aria-checked");
    expect(html).not.toMatch(/\sindeterminate=/);

    const container = document.createElement("div");
    document.body.append(container);
    container.innerHTML = html;
    expect((container.querySelector("input") as HTMLInputElement).indeterminate).toBe(false);
    render(ui, { container, hydrate: true });
    await flushMicrotasks();
    expect(box().indeterminate).toBe(true);
    expect(box()).toHaveAttribute("data-indeterminate", "");
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("a render element's own indeterminate prop is stripped (design 6.3)", () => {
    const consoleError = silenceErrors();
    const forced = { indeterminate: true } as object;
    render(<Checkbox aria-label="All" render={<input {...forced} />} />);
    expect(box().indeterminate).toBe(false);
    expect(box()).not.toHaveAttribute("indeterminate");
    expect(box()).not.toHaveAttribute("data-indeterminate");
    expect(consoleError).not.toHaveBeenCalled();
  });

  renderBoth("click on a mixed box (C4)", (mode) => {
    it("dispatches true; mixed is suspended while pending and cleared by the parent", async () => {
      const d = deferred();
      const action = vi.fn<ActionFn>(() => d.promise);
      render(<MixedHarness mode={mode} action={action} />);
      const user = setupUser();
      expect(box().indeterminate).toBe(true);

      await user.click(box());
      expect(action).toHaveBeenCalledTimes(1);
      expect(action.mock.calls[0]?.[0]).toBe(true);
      expect(box().checked).toBe(true);
      expect(box().indeterminate).toBe(false);
      expect(box()).not.toHaveAttribute("data-indeterminate");
      expect(box()).toHaveAttribute("data-checked", "");
      expectPending(box());

      await act(async () => {
        d.resolve();
      });
      expectNotPending(box());
      expect(box().checked).toBe(true);
      expect(box().indeterminate).toBe(false);
      expect(box()).not.toHaveAttribute("data-indeterminate");
    });
  });

  renderBoth("rollback to mixed (C5)", (mode) => {
    it("the dash returns after a rejection caught inside the action", async () => {
      const d = deferred();
      render(<MixedHarness mode={mode} action={() => d.promise} catchErrors />);
      const user = setupUser();

      await user.click(box());
      expect(box().indeterminate).toBe(false);
      await act(async () => {
        d.reject(new Error("save failed"));
      });
      expectNotPending(box());
      // The parent never adopted anything, so `indeterminate` is still true and comes back.
      expect(box().indeterminate).toBe(true);
      expect(box()).toHaveAttribute("data-indeterminate", "");
      // Controlled: the veto rolls `checked` back. Uncontrolled: a caught error is success and
      // commits `true` (conventions 2.4); the parent is expected to recompute `indeterminate`.
      expect(box().checked).toBe(mode === "uncontrolled");
    });
  });

  it("a mixed uncontrolled box commits true and shows the dash again while the prop says so (C5)", async () => {
    render(<Checkbox aria-label="All" indeterminate checkedChangeAction={() => {}} />);
    const user = setupUser();
    await user.click(box());
    await flushMicrotasks();
    expect(box().checked).toBe(true);
    expect(box().indeterminate).toBe(true);
    expect(box()).toHaveAttribute("data-indeterminate", "");
  });

  it("does not affect what the form submits (C7)", async () => {
    render(
      <form data-testid="form">
        <Checkbox aria-label="All" name="all" checked indeterminate />
        <Checkbox aria-label="None" name="none" checked={false} indeterminate />
      </form>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;
    expect([...new FormData(form)]).toEqual([["all", "on"]]);
  });

  renderBoth("form reset while mixed (C8)", (mode) => {
    it("dispatches platform; mixed is suspended while pending and re-applied after", async () => {
      let resolveReset: (() => void) | undefined;
      const actions: [boolean, string][] = [];
      render(
        <MixedHarness
          mode={mode}
          clearMixedOnSuccess={false}
          inForm
          action={(next, details) => {
            actions.push([next, details.reason]);
            if (details.reason === "platform") {
              return new Promise<void>((resolve) => {
                resolveReset = resolve;
              });
            }
          }}
        />,
      );
      const user = setupUser();
      await user.click(box());
      expect(box().checked).toBe(true);
      expect(box().indeterminate).toBe(true);

      await user.click(screen.getByRole("button", { name: "Reset" }));
      await flushMicrotasks();
      expect(actions).toEqual([
        [true, "activate"],
        [false, "platform"],
      ]);
      expect(box().checked).toBe(false);
      expect(box().indeterminate).toBe(false);
      expect(box()).not.toHaveAttribute("data-indeterminate");
      expectPending(box());

      await act(async () => {
        resolveReset?.();
      });
      expectNotPending(box());
      expect(box().checked).toBe(false);
      expect(box().indeterminate).toBe(true);
      expect(box()).toHaveAttribute("data-indeterminate", "");
    });
  });

  it("function props see indeterminate: false in the pending render (C9)", async () => {
    const d = deferred();
    const className = vi.fn((s: CheckboxState) => (s.indeterminate ? "mixed" : "plain"));
    const style = vi.fn((_s: CheckboxState) => undefined);
    const renderFn = vi.fn((props: object, _s: CheckboxState) => <input {...props} />);
    render(
      <Checkbox
        aria-label="All"
        checked={false}
        indeterminate
        className={className}
        style={style}
        render={renderFn}
        checkedChangeAction={() => d.promise}
      />,
    );
    const user = setupUser();
    const idle: CheckboxState = {
      checked: false,
      indeterminate: true,
      pending: false,
      disabled: false,
    };
    expect(className).toHaveBeenLastCalledWith(idle);
    expect(style).toHaveBeenLastCalledWith(idle);
    expect(renderFn.mock.calls.at(-1)?.[1]).toEqual(idle);
    expect(box()).toHaveClass("mixed");

    await user.click(box());
    const pending: CheckboxState = {
      checked: true,
      indeterminate: false,
      pending: true,
      disabled: false,
    };
    expect(className).toHaveBeenLastCalledWith(pending);
    expect(style).toHaveBeenLastCalledWith(pending);
    expect(renderFn.mock.calls.at(-1)?.[1]).toEqual(pending);
    expect(box()).toHaveClass("plain");
    expect(box()).not.toHaveAttribute("data-indeterminate");

    await act(async () => {
      d.resolve();
    });
    // Controlled veto: back to unchecked and mixed.
    expect(className).toHaveBeenLastCalledWith(idle);
    expect(box().indeterminate).toBe(true);
  });

  it("indeterminate set by the parent while pending is shown on settle", async () => {
    const d = deferred();
    function Parent() {
      const [mixed, setMixed] = useState(false);
      return (
        <>
          <Checkbox aria-label="All" indeterminate={mixed} checkedChangeAction={() => d.promise} />
          <button type="button" onClick={() => setMixed(true)}>
            mix
          </button>
        </>
      );
    }
    render(<Parent />);
    const user = setupUser();
    await user.click(box());
    await user.click(screen.getByRole("button", { name: "mix" }));
    expect(box().indeterminate).toBe(false);
    expect(box()).not.toHaveAttribute("data-indeterminate");
    await act(async () => {
      d.resolve();
    });
    expect(box().indeterminate).toBe(true);
    expect(box()).toHaveAttribute("data-indeterminate", "");
  });
});

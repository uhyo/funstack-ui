// Checkbox rows that need a real engine (design/components/checkbox.md section 11: the shared
// Switch rows 4b, 21b, 26 and C6, `:indeterminate` matching).
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { describeCheckableInputInBrowser } from "../__tests__/checkable-input-browser-suite.js";
import { checkedMatchesWhileIndeterminate } from "../__tests__/engine.js";
import { deferred } from "../__tests__/helpers.js";
import { Checkbox } from "./index.js";

describeCheckableInputInBrowser({ name: "Checkbox", Control: Checkbox, role: "checkbox" });

describe("Checkbox indeterminate (browser)", () => {
  const box = () => screen.getByRole("checkbox") as HTMLInputElement;

  it(":indeterminate matches after mount, not while pending, and again after a rollback (C6)", async () => {
    const d = deferred();
    render(
      <Checkbox
        aria-label="All"
        checked={false}
        indeterminate
        checkedChangeAction={() => d.promise}
      />,
    );
    expect(box().matches(":indeterminate")).toBe(true);
    expect(box().matches(":checked")).toBe(false);

    await userEvent.click(box());
    expect(box().matches(":indeterminate")).toBe(false);
    expect(box().matches(":checked")).toBe(true);
    expect(box()).not.toHaveAttribute("data-indeterminate");
    expect(box()).toHaveAttribute("data-pending", "");

    // The controlled parent never adopts `true`: a veto, as after a caught rejection.
    await act(async () => {
      d.resolve();
    });
    expect(box().matches(":indeterminate")).toBe(true);
    expect(box().matches(":checked")).toBe(false);
    expect(box()).toHaveAttribute("data-indeterminate", "");
  });

  it("Space on a mixed box checks it (APG: mixed to checked)", async () => {
    const next: boolean[] = [];
    render(
      <Checkbox
        aria-label="All"
        indeterminate
        checkedChangeAction={(value) => {
          next.push(value);
        }}
      />,
    );
    expect(box().matches(":indeterminate")).toBe(true);
    box().focus();
    await userEvent.keyboard(" ");
    await act(async () => {});
    expect(next).toEqual([true]);
    // Uncontrolled: committed `true`; the parent still says mixed, so the dash is back too.
    expect(box().checked).toBe(true);
    expect(box()).toHaveAttribute("data-checked", "");
    expect(box().matches(":indeterminate")).toBe(true);
  });

  it("checked + indeterminate: data-checked is set; :checked follows the engine", () => {
    // Chromium 156 does not match :checked on a checked box whose indeterminate flag is set;
    // Firefox 157 does. data-checked reflects `checked` alone in every engine, so it is the
    // selector to use when a box can be both (memo/developer/switch-checkbox.md).
    render(<Checkbox aria-label="All" checked indeterminate />);
    expect(box().checked).toBe(true);
    expect(box().indeterminate).toBe(true);
    expect(box()).toHaveAttribute("data-checked", "");
    expect(box()).toHaveAttribute("data-indeterminate", "");
    expect(box().matches(":indeterminate")).toBe(true);
    expect(box().matches(":checked")).toBe(checkedMatchesWhileIndeterminate);
  });
});

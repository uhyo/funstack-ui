// Switch, design/components/switch.md section 11. Every row is in the shared suite (Checkbox runs
// the same rows); rows 4b, 21b and the DOM half of 26 are in switch.browser.test.tsx; row 25
// (directive) is in src/__tests__/directives.test.ts.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { describeCheckableInput } from "../__tests__/checkable-input-suite.js";
import { Switch } from "./index.js";
import type { SwitchProps } from "./index.js";

describeCheckableInput({
  name: "Switch",
  Control: Switch,
  role: "switch",
  changeTypes: ["fsui-switch-on", "fsui-switch-off"],
});

describe("Switch specifics", () => {
  it("has no children and no indeterminate prop (type-level)", () => {
    // @ts-expect-error The input is a void element: no `children` (conventions 1.3).
    const props: SwitchProps = { children: "x" };
    // @ts-expect-error A switch is binary: no `indeterminate` (design section 10).
    const props2: SwitchProps = { indeterminate: true };
    expect([props, props2]).toHaveLength(2);
  });

  it("role=switch is exposed with the native checked state", () => {
    render(<Switch aria-label="Wi-Fi" defaultChecked />);
    expect(screen.getByRole("switch", { name: "Wi-Fi", checked: true })).toBeInTheDocument();
  });
});

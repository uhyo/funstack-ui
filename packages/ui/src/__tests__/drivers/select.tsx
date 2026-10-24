// Select as seen by the value-action suite (value-action-suite.tsx): a Trigger with a Value and
// options a, b, c starting on "a"; the gestures pick b, c, a with `user.selectOptions` (jsdom has
// no picker: it sets the value and fires `input` + `change`). The selected option (DOM value,
// `selected`, `data-selected`) is optimistic; the select, the Trigger and the optimistic Option
// are pending. No part takes `transition` (design decision 13).
import { cleanup, render, screen } from "@testing-library/react";
import { expect } from "vitest";
import { Select } from "../../select/index.js";
import type { SelectValueChangeDetails } from "../../select/index.js";
import { silenceErrors } from "../helpers.js";
import { definedProps } from "../value-action-suite.js";
import type { ValueActionDriver } from "../value-action-suite.js";

const OPTIONS = ["a", "b", "c"] as const;
const sel = () => screen.getByRole("combobox") as HTMLSelectElement;
const opt = (v: string) => sel().querySelector<HTMLOptionElement>(`option[value="${v}"]`)!;
const dataSelected = () =>
  [...sel().options].filter((o) => o.hasAttribute("data-selected")).map((o) => o.value);

/**
 * React warns once per module graph (so once per test file) that `<selectedcontent>` is an
 * unknown tag (jsdom has no customizable select). Call in a `beforeAll` of every file that
 * renders a Select.Value, so rows asserting no `console.error` do not depend on running after
 * another row that rendered one (#101: failed under --sequence.shuffle). The expectation fails
 * the day React stops warning: drop the warm-up then.
 */
export function takeSelectedContentWarning(): void {
  const error = silenceErrors();
  render(
    <Select.Root aria-label="warm-up">
      <Select.Trigger>
        <Select.Value />
      </Select.Trigger>
      <Select.Option value="a">A</Select.Option>
    </Select.Root>,
  );
  // Unmounts it and removes its container: the first row starts from an empty body.
  cleanup();
  expect(error).toHaveBeenCalledWith(expect.stringContaining("is unrecognized"), "selectedcontent");
  error.mockRestore();
}

export const selectDriver: ValueActionDriver<string, SelectValueChangeDetails> = {
  name: "Select.Root",
  render: ({ value, defaultValue, changeAction, extra }) => (
    <Select.Root
      aria-label="Fruit"
      {...definedProps({ value, defaultValue, valueChangeAction: changeAction })}
      {...extra}
    >
      <Select.Trigger data-testid="trigger">
        <Select.Value />
      </Select.Trigger>
      {OPTIONS.map((v) => (
        <Select.Option key={v} value={v}>
          {v.toUpperCase()}
        </Select.Option>
      ))}
    </Select.Root>
  ),
  values: ["a", "b", "c", "a"],
  gesture: (user, i) => user.selectOptions(sel(), selectDriver.values[i + 1]!),
  eventType: () => "change",
  detailsFields: () => ({ reason: "activate" }),
  expectShown: (v) => {
    expect(sel().value).toBe(v);
    expect(opt(v).selected).toBe(true);
    expect(dataSelected()).toEqual([v]);
  },
  readShown: () => sel().value,
  shown: (v) => v,
  pendingOn: (i) => [sel(), screen.getByTestId("trigger"), opt(selectDriver.values[i + 1]!)],
  pendingOff: (i) => OPTIONS.filter((v) => v !== selectDriver.values[i + 1]).map(opt),
  queryControl: () => screen.queryByRole("combobox"),
  transitionProp: false,
  props: { value: "value", defaultValue: "defaultValue" },
  format: String,
  transitionTypes: [["fsui-select"], ["fsui-select"], ["fsui-select"]],
};

// RadioGroup as seen by the value-action suite (value-action-suite.tsx): radios a, b, c starting
// on "a"; the gestures click b, c, a. The checked radio (DOM `checked` and `data-checked`) is
// optimistic; only the optimistic Item is pending, with the Root.
import { screen } from "@testing-library/react";
import { expect } from "vitest";
import { RadioGroup } from "../../radio-group/index.js";
import type { RadioGroupValueChangeDetails } from "../../radio-group/index.js";
import { definedProps } from "../value-action-suite.js";
import type { ValueActionDriver } from "../value-action-suite.js";

const ITEMS = ["a", "b", "c"] as const;
const radio = (v: string) => screen.getByRole("radio", { name: v }) as HTMLInputElement;
const radios = () => screen.getAllByRole("radio") as HTMLInputElement[];
const checkedValues = () =>
  radios()
    .filter((r) => r.checked)
    .map((r) => r.value);
const dataChecked = () =>
  radios()
    .filter((r) => r.hasAttribute("data-checked"))
    .map((r) => r.value);

export const radioGroupDriver: ValueActionDriver<string | null, RadioGroupValueChangeDetails> = {
  name: "RadioGroup.Root",
  render: ({ value, defaultValue, changeAction, transition, extra }) => (
    <RadioGroup.Root
      aria-label="Fruit"
      {...definedProps({ value, defaultValue, valueChangeAction: changeAction })}
      {...extra}
    >
      {ITEMS.map((v) => (
        <RadioGroup.Item key={v} value={v} aria-label={v} {...definedProps({ transition })} />
      ))}
    </RadioGroup.Root>
  ),
  values: ["a", "b", "c", "a"],
  gesture: (user, i) => user.click(radio(radioGroupDriver.values[i + 1]!)),
  eventType: () => "click",
  detailsFields: () => ({ reason: "activate" }),
  expectShown: (v) => {
    expect(checkedValues()).toEqual(v === null ? [] : [v]);
    expect(dataChecked()).toEqual(v === null ? [] : [v]);
  },
  readShown: () => checkedValues().join(","),
  shown: (v) => v ?? "",
  pendingOn: (i) => [screen.getByRole("radiogroup"), radio(radioGroupDriver.values[i + 1]!)],
  pendingOff: (i) => ITEMS.filter((v) => v !== radioGroupDriver.values[i + 1]).map(radio),
  queryControl: () => screen.queryByRole("radiogroup"),
  props: { value: "value", defaultValue: "defaultValue" },
  format: String,
  transitionTypes: [["fsui-radio-group"], ["fsui-radio-group"], ["fsui-radio-group"]],
};

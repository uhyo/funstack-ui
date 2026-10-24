// CheckboxGroup as seen by the value-action suite (value-action-suite.tsx): a Label, a Parent
// ("all") over Items a, b, c, starting from ["c"]; the gestures click a (inserted before c: `next`
// is in document order), click the mixed Parent (checks all, adds b) and click c. The "update on
// success" parent patches its value with `details.added` / `removed` (design 2.6). Item and Parent
// state (DOM `checked`, `data-checked`, the Parent's mixed state) is optimistic.
import { screen } from "@testing-library/react";
import { expect } from "vitest";
import { CheckboxGroup } from "../../checkbox-group/index.js";
import type { CheckboxGroupValueChangeDetails } from "../../checkbox-group/index.js";
import { definedProps } from "../value-action-suite.js";
import type { ValueActionDriver } from "../value-action-suite.js";

const ITEMS = ["a", "b", "c"] as const;
const box = (name: string) => screen.getByRole("checkbox", { name }) as HTMLInputElement;
const parentBox = () => box("all");
/** The Items (boxes with a `name`; the Parent has none). */
const items = () =>
  (screen.getAllByRole("checkbox") as HTMLInputElement[]).filter((b) => b.name !== "");
const checkedValues = () =>
  items()
    .filter((b) => b.checked)
    .map((b) => b.value);
const dataChecked = () =>
  items()
    .filter((b) => b.hasAttribute("data-checked"))
    .map((b) => b.value);

/** The Parent over a, b, c for a value: "checked", "mixed" or "unchecked". */
const parentOf = (v: readonly string[]) =>
  ITEMS.every((x) => v.includes(x)) ? "checked" : v.length === 0 ? "unchecked" : "mixed";

/** The Parent's visible state; the DOM properties and the data attributes must agree. */
function parentShows(): string {
  const el = parentBox();
  expect(el.hasAttribute("data-indeterminate")).toBe(el.indeterminate);
  expect(el.hasAttribute("data-checked")).toBe(el.checked);
  if (el.checked && el.indeterminate) return "checked+mixed";
  return el.checked ? "checked" : el.indeterminate ? "mixed" : "unchecked";
}

export const checkboxGroupDriver: ValueActionDriver<string[], CheckboxGroupValueChangeDetails> = {
  name: "CheckboxGroup.Root",
  render: ({ value, defaultValue, changeAction, transition, extra }) => (
    <CheckboxGroup.Root
      {...definedProps({ value, defaultValue, valueChangeAction: changeAction })}
      {...extra}
    >
      <CheckboxGroup.Label>Fruit</CheckboxGroup.Label>
      <CheckboxGroup.Parent
        values={[...ITEMS]}
        aria-label="all"
        {...definedProps({ transition })}
      />
      {ITEMS.map((v) => (
        <CheckboxGroup.Item key={v} value={v} aria-label={v} {...definedProps({ transition })} />
      ))}
    </CheckboxGroup.Root>
  ),
  values: [["c"], ["a", "c"], ["a", "b", "c"], ["a", "b"]],
  gesture: (user, i) => user.click(i === 1 ? parentBox() : box(ITEMS[i]!)),
  eventType: () => "click",
  detailsFields: (i) =>
    [
      { reason: "activate", added: ["a"], removed: [] },
      { reason: "activate", added: ["b"], removed: [] },
      { reason: "activate", added: [], removed: ["c"] },
    ][i]!,
  expectShown: (v) => {
    expect(checkedValues()).toEqual(v);
    expect(dataChecked()).toEqual(v);
    expect(parentShows()).toBe(parentOf(v));
  },
  // Read in a Profiler callback: no assertions here (parentShows asserts).
  readShown: () => {
    const el = parentBox();
    const parent = el.checked ? "checked" : el.indeterminate ? "mixed" : "unchecked";
    return `${checkedValues().join(",")}/${parent}`;
  },
  shown: (v) => `${v.join(",")}/${parentOf(v)}`,
  // Gesture i changes Item ITEMS[i]; an Item is pending while its own box differs from the
  // committed value, the Parent while any of its values does, the Root while any action runs.
  pendingOn: (i) => [screen.getByRole("group"), parentBox(), ...ITEMS.slice(0, i + 1).map(box)],
  pendingOff: (i) => ITEMS.slice(i + 1).map(box),
  queryControl: () => screen.queryByRole("group"),
  props: { value: "value", defaultValue: "defaultValue" },
  commit: (prev, _next, details) => [
    ...prev.filter((v) => !details.removed.includes(v)),
    ...details.added.filter((v) => !prev.includes(v)),
  ],
  orderIndependentCommit: true,
  format: (v) => [...v].sort().join(","),
  transitionTypes: [
    ["fsui-checkbox-group", "fsui-checkbox-group-check"],
    ["fsui-checkbox-group", "fsui-checkbox-group-check"],
    ["fsui-checkbox-group", "fsui-checkbox-group-uncheck"],
  ],
};

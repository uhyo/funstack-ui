// CheckboxGroup as seen by the value-action suite (value-action-suite.tsx) and the native platform
// suite (native-group-platform-suite.tsx): a Label, a Parent ("all") over Items a, b, c, starting
// from ["c"]; the gestures click a (inserted before c: `next` is in document order), click c
// (uncheck) and click the mixed Parent (checks all: adds b and c). values[2] differs from
// values[0] by an added and a removed value, so the platform rows that go there (several
// pre-hydration clicks, a reset) carry both. The "update on success" parent patches its value with
// `details.added` / `removed` (design 2.6). Item and Parent state (DOM `checked`, `data-checked`,
// the Parent's mixed state) is optimistic.
import { screen } from "@testing-library/react";
import { expect } from "vitest";
import { CheckboxGroup } from "../../checkbox-group/index.js";
import type { CheckboxGroupValueChangeDetails } from "../../checkbox-group/index.js";
import type { NativeGroupPlatformDriver } from "../native-group-platform-suite.js";
import { definedProps } from "../value-action-suite.js";

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

/** The added and removed values from `from` to `to`, in document order. */
const diff = (from: readonly string[], to: readonly string[]) => ({
  added: ITEMS.filter((x) => to.includes(x) && !from.includes(x)),
  removed: ITEMS.filter((x) => from.includes(x) && !to.includes(x)),
});

export const checkboxGroupDriver: NativeGroupPlatformDriver<
  string[],
  CheckboxGroupValueChangeDetails
> = {
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
  values: [["c"], ["a", "c"], ["a"], ["a", "b", "c"]],
  gesture: (user, i) => user.click(i === 2 ? parentBox() : box(["a", "c"][i]!)),
  eventType: () => "click",
  detailsFields: (i) =>
    [
      { reason: "activate", added: ["a"], removed: [] },
      { reason: "activate", added: [], removed: ["c"] },
      { reason: "activate", added: ["b", "c"], removed: [] },
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
  // While gestures 0..i are in flight (nothing committed yet), an Item is pending when its box
  // differs from values[0], the Parent when any of its values does, the Root while any action
  // runs.
  pendingOn: (i) => {
    const { values } = checkboxGroupDriver;
    const { added, removed } = diff(values[0], values[i + 1]!);
    return [screen.getByRole("group"), parentBox(), ...[...added, ...removed].map(box)];
  },
  pendingOff: (i) => {
    const { values } = checkboxGroupDriver;
    const { added, removed } = diff(values[0], values[i + 1]!);
    return ITEMS.filter((x) => !added.includes(x) && !removed.includes(x)).map(box);
  },
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
    ["fsui-checkbox-group", "fsui-checkbox-group-uncheck"],
    ["fsui-checkbox-group", "fsui-checkbox-group-check"],
  ],
  setDomValue: (container, v) => {
    for (const x of ITEMS) {
      container.querySelector<HTMLInputElement>(`input[name][value="${x}"]`)!.checked =
        v.includes(x);
    }
  },
  platformDetails: (from, to) => ({ reason: "platform", ...diff(from, to) }),
  // The Parent is not part of the reset target: it keeps the defaultChecked React gave it at
  // mount, from its derivation over values[0] (mixed: unchecked).
  expectResetTarget: (v) => {
    for (const x of ITEMS) expect(box(x).defaultChecked).toBe(v.includes(x));
    expect(parentBox().defaultChecked).toBe(false);
  },
};

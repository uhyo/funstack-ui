// MultiSelect as seen by the value-action suite (value-action-suite.tsx): a listbox held open
// (controlled `open`, so no gesture runs an open transition) over Ham, Olive and Corn, starting
// from ["ham"]. The gestures click Olive (added: appended, pick order, multi-select.md B.6), Ham
// (a pick toggles: removed) and Corn. The "update on success" parent patches its value with
// `details.added` / `removed`. Options' `aria-selected`, the Value's text and the hidden inputs
// are optimistic.
import { screen } from "@testing-library/react";
import { expect } from "vitest";
import { MultiSelect } from "../../multi-select/index.js";
import type { MultiSelectValueChangeDetails } from "../../multi-select/index.js";
import type { ValueActionDriver } from "../value-action-suite.js";
import { definedProps } from "../value-action-suite.js";

const ITEMS = [
  ["ham", "Ham"],
  ["olive", "Olive"],
  ["corn", "Corn"],
] as const;

const option = (v: string) => screen.getByTestId(`opt-${v}`);

const selectedOptions = () =>
  ITEMS.map(([v]) => v).filter((v) => option(v).getAttribute("aria-selected") === "true");
const hiddenValues = () =>
  [...document.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="t"]')].map(
    (el) => el.value,
  );
const shownValue = () => screen.getByTestId("value").textContent ?? "";

/** The added and removed values from `from` to `to`. */
const diff = (from: readonly string[], to: readonly string[]) => ({
  added: to.filter((x) => !from.includes(x)),
  removed: from.filter((x) => !to.includes(x)),
});

const noop = () => {};

export const multiSelectDriver: ValueActionDriver<string[], MultiSelectValueChangeDetails> = {
  name: "MultiSelect.Root",
  render: ({ value, defaultValue, changeAction, extra }) => (
    <MultiSelect.Root
      name="t"
      open
      onOpenChange={noop}
      {...definedProps({ value, defaultValue, valueChangeAction: changeAction })}
      {...extra}
    >
      <MultiSelect.Label>Toppings</MultiSelect.Label>
      <MultiSelect.Trigger data-testid="trigger">
        <MultiSelect.Value data-testid="value">{({ value: v }) => v.join(",")}</MultiSelect.Value>
      </MultiSelect.Trigger>
      <MultiSelect.Popup>
        <MultiSelect.List>
          {ITEMS.map(([v, name]) => (
            <MultiSelect.Option key={v} value={v} data-testid={`opt-${v}`}>
              {name}
            </MultiSelect.Option>
          ))}
        </MultiSelect.List>
      </MultiSelect.Popup>
    </MultiSelect.Root>
  ),
  values: [["ham"], ["ham", "olive"], ["olive"], ["olive", "corn"]],
  gesture: (user, i) => user.click(option(["olive", "ham", "corn"][i]!)),
  eventType: () => "click",
  detailsFields: (i) =>
    [
      { reason: "activate", added: ["olive"], removed: [] },
      { reason: "activate", added: [], removed: ["ham"] },
      { reason: "activate", added: ["corn"], removed: [] },
    ][i]!,
  expectShown: (v) => {
    expect(shownValue()).toBe(v.join(","));
    expect(selectedOptions()).toEqual(ITEMS.map(([x]) => x).filter((x) => v.includes(x)));
    expect(hiddenValues()).toEqual(v);
  },
  readShown: () => shownValue(),
  shown: (v) => v.join(","),
  // While gestures 0..i are in flight, an option is pending when its selection differs from
  // values[0] (being added or removed); the Trigger while any action runs.
  pendingOn: (i) => {
    const { values } = multiSelectDriver;
    const { added, removed } = diff(values[0], values[i + 1]!);
    return [screen.getByTestId("trigger"), ...[...added, ...removed].map(option)];
  },
  pendingOff: (i) => {
    const { values } = multiSelectDriver;
    const { added, removed } = diff(values[0], values[i + 1]!);
    return ITEMS.map(([x]) => x)
      .filter((x) => !added.includes(x) && !removed.includes(x))
      .map(option);
  },
  queryControl: () => screen.queryByTestId("trigger"),
  transitionProp: false,
  props: { value: "value", defaultValue: "defaultValue" },
  commit: (prev, _next, details) => [
    ...prev.filter((v) => !details.removed.includes(v)),
    ...details.added.filter((v) => !prev.includes(v)),
  ],
  orderIndependentCommit: true,
  withoutFirstGesture: [],
  format: (v) => [...v].sort().join(","),
  transitionTypes: [
    ["fsui-multi-select", "fsui-multi-select-select"],
    ["fsui-multi-select", "fsui-multi-select-deselect"],
    ["fsui-multi-select", "fsui-multi-select-select"],
  ],
};

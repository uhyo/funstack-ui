// Combobox.Root multiple as seen by the value-action suite (value-action-suite.tsx): a listbox
// held open (controlled `open`, so no gesture runs an open transition) over Japan, France and
// Jamaica, chips for the selection, starting from ["jp"]. The gestures click France (added: the
// chip is appended, design 15.2), Japan (a pick toggles: removed) and Jamaica. The "update on
// success" parent patches its value with `details.added` / `removed` (design 15.4). Chips,
// options' `aria-selected` and the hidden inputs are optimistic.
import { screen } from "@testing-library/react";
import { expect } from "vitest";
import { Combobox } from "../../combobox/index.js";
import type { ComboboxMultipleValueChangeDetails } from "../../combobox/index.js";
import type { ValueActionDriver } from "../value-action-suite.js";
import { definedProps } from "../value-action-suite.js";

const ITEMS = [
  ["jp", "Japan"],
  ["fr", "France"],
  ["jm", "Jamaica"],
] as const;

const option = (v: string) => screen.getByTestId(`opt-${v}`);
const queryChip = (v: string) => screen.queryByTestId(`chip-${v}`);

const chipValues = () =>
  screen.queryAllByRole("listitem").map((el) => el.getAttribute("data-value") ?? "");
const selectedOptions = () =>
  ITEMS.map(([v]) => v).filter((v) => option(v).getAttribute("aria-selected") === "true");
const hiddenValues = () =>
  [...document.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="c"]')].map(
    (el) => el.value,
  );

/** The added and removed values from `from` to `to`. */
const diff = (from: readonly string[], to: readonly string[]) => ({
  added: to.filter((x) => !from.includes(x)),
  removed: from.filter((x) => !to.includes(x)),
});

const noop = () => {};

export const comboboxMultipleDriver: ValueActionDriver<
  string[],
  ComboboxMultipleValueChangeDetails
> = {
  name: "Combobox.Root",
  label: "Combobox.Root multiple",
  render: ({ value, defaultValue, changeAction, extra }) => (
    <Combobox.Root
      multiple
      name="c"
      open
      onOpenChange={noop}
      {...definedProps({ value, defaultValue, valueChangeAction: changeAction })}
      {...extra}
    >
      <Combobox.Label>Countries</Combobox.Label>
      <Combobox.Chips data-testid="chips">
        {({ value: values }) =>
          values.map((v) => (
            <Combobox.Chip key={v} value={v} data-value={v} data-testid={`chip-${v}`} />
          ))
        }
      </Combobox.Chips>
      <Combobox.Input data-testid="input" />
      <Combobox.Popup>
        <Combobox.List>
          {ITEMS.map(([v, name]) => (
            <Combobox.Option key={v} value={v} data-testid={`opt-${v}`}>
              {name}
            </Combobox.Option>
          ))}
        </Combobox.List>
      </Combobox.Popup>
    </Combobox.Root>
  ),
  values: [["jp"], ["jp", "fr"], ["fr"], ["fr", "jm"]],
  gesture: (user, i) => user.click(option(["fr", "jp", "jm"][i]!)),
  eventType: () => "click",
  detailsFields: (i) =>
    [
      { reason: "activate", added: ["fr"], removed: [], custom: false },
      { reason: "activate", added: [], removed: ["jp"], custom: false },
      { reason: "activate", added: ["jm"], removed: [], custom: false },
    ][i]!,
  expectShown: (v) => {
    expect(chipValues()).toEqual(v);
    expect(selectedOptions()).toEqual(ITEMS.map(([x]) => x).filter((x) => v.includes(x)));
    expect(hiddenValues()).toEqual(v);
  },
  readShown: () => chipValues().join(","),
  shown: (v) => v.join(","),
  // While gestures 0..i are in flight, an option is pending when its selection differs from
  // values[0] (being added or removed), a chip when it is being added; the Input and Chips while
  // any action runs.
  pendingOn: (i) => {
    const { values } = comboboxMultipleDriver;
    const { added, removed } = diff(values[0], values[i + 1]!);
    return [
      screen.getByTestId("input"),
      screen.getByTestId("chips"),
      ...[...added, ...removed].map(option),
      ...added.flatMap((x) => queryChip(x) ?? []),
    ];
  },
  pendingOff: (i) => {
    const { values } = comboboxMultipleDriver;
    const { added, removed } = diff(values[0], values[i + 1]!);
    const unchanged = ITEMS.map(([x]) => x).filter(
      (x) => !added.includes(x) && !removed.includes(x),
    );
    return [...unchanged.map(option), ...unchanged.flatMap((x) => queryChip(x) ?? [])];
  },
  queryControl: () => screen.queryByTestId("input"),
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
    ["fsui-combobox", "fsui-combobox-select"],
    ["fsui-combobox", "fsui-combobox-deselect"],
    ["fsui-combobox", "fsui-combobox-select"],
  ],
};

// Accordion as seen by the value-action suite (value-action-suite.tsx), in library mode, with
// items a, b, c. The Trigger and Item `data-open` are optimistic; the `<details open>` and the
// Panel's `open` state follow the committed value. Two drivers: multiple (open a, open b, close a)
// and exclusive (from a: open b, open c, open a; walkthrough 9.3).
import { screen } from "@testing-library/react";
import { expect } from "vitest";
import { Accordion } from "../../accordion/index.js";
import type { AccordionValueChangeDetails } from "../../accordion/index.js";
import { definedProps } from "../value-action-suite.js";
import type { ControlProps, ValueActionDriver } from "../value-action-suite.js";

const ITEMS = ["a", "b", "c"] as const;
const root = () => screen.getByTestId("root");
const item = (v: string) => screen.getByTestId(`item-${v}`) as HTMLDetailsElement;
const trigger = (v: string) => screen.getByTestId(`trigger-${v}`);
const panel = (v: string) => screen.getByTestId(`panel-${v}`);
const panelOpen = (v: string) => screen.getByTestId(`panel-open-${v}`);

function items(transition: ControlProps<unknown, unknown>["transition"]) {
  return ITEMS.map((v) => (
    <Accordion.Item key={v} value={v} data-testid={`item-${v}`} {...definedProps({ transition })}>
      <Accordion.Trigger data-testid={`trigger-${v}`} {...definedProps({ transition })}>
        {v.toUpperCase()}
      </Accordion.Trigger>
      <Accordion.Panel data-testid={`panel-${v}`} {...definedProps({ transition })}>
        {({ open }) => <span data-testid={`panel-open-${v}`}>{String(open)}</span>}
      </Accordion.Panel>
    </Accordion.Item>
  ));
}

/** The open items a value names. */
const openSet = (v: readonly string[] | string | null): readonly string[] =>
  v === null ? [] : typeof v === "string" ? [v] : v;

function expectShown(v: readonly string[] | string | null): void {
  const open = openSet(v);
  for (const x of ITEMS) {
    for (const el of [trigger(x), item(x)]) {
      if (open.includes(x)) expect(el).toHaveAttribute("data-open", "");
      else expect(el).not.toHaveAttribute("data-open");
    }
  }
}

function expectCommitted(v: readonly string[] | string | null): void {
  const open = openSet(v);
  for (const x of ITEMS) {
    expect(item(x).open).toBe(open.includes(x));
    if (open.includes(x)) expect(item(x)).toHaveAttribute("open");
    else expect(item(x)).not.toHaveAttribute("open");
    expect(panelOpen(x)).toHaveTextContent(String(open.includes(x)));
  }
}

const readShown = () => ITEMS.filter((x) => trigger(x).hasAttribute("data-open")).join(",");
const readCommitted = () => ITEMS.filter((x) => item(x).hasAttribute("open")).join(",");
const join = (v: readonly string[] | string | null) => openSet(v).join(",");

/** Root, and the Item and Trigger of every item whose optimistic state differs from `committed`. */
function pendingParts(changed: readonly string[]): Element[] {
  return [root(), ...changed.flatMap((x) => [item(x), trigger(x)])];
}
function idleParts(changed: readonly string[]): Element[] {
  return [
    ...ITEMS.filter((x) => !changed.includes(x)).flatMap((x) => [item(x), trigger(x)]),
    ...ITEMS.map(panel),
  ];
}

const shared = {
  name: "Accordion.Root",
  eventType: () => "click",
  readShown,
  readCommitted,
  queryControl: () => screen.queryByTestId("root"),
  implicitDefault: false,
  props: { value: "value", defaultValue: "defaultValue" },
} as const;

const MULTIPLE_CLICKS = ["a", "b", "a"] as const;
/** Items whose optimistic state differs from the initial `[]` after gesture `i`. */
const MULTIPLE_CHANGED = [["a"], ["a", "b"], ["a"]] as const;

export const accordionDriver: ValueActionDriver<string[], AccordionValueChangeDetails> = {
  ...shared,
  render: ({ value, defaultValue, changeAction, transition, extra }) => (
    <Accordion.Root
      data-testid="root"
      {...definedProps({ value, defaultValue, valueChangeAction: changeAction })}
      {...extra}
    >
      {items(transition)}
    </Accordion.Root>
  ),
  values: [[], ["a"], ["a", "b"], ["b"]],
  gesture: (user, i) => user.click(trigger(MULTIPLE_CLICKS[i]!)),
  detailsFields: (i) => ({ reason: "activate", item: MULTIPLE_CLICKS[i], open: i !== 2 }),
  expectShown,
  expectCommitted,
  shown: join,
  committedShown: join,
  pendingOn: (i) => pendingParts(MULTIPLE_CHANGED[i]!),
  pendingOff: (i) => idleParts(MULTIPLE_CHANGED[i]!),
  transitionTypes: [
    ["fsui-accordion", "fsui-accordion-expand"],
    ["fsui-accordion", "fsui-accordion-expand"],
    ["fsui-accordion", "fsui-accordion-collapse"],
  ],
};

const EXCLUSIVE_VALUES = ["a", "b", "c", "a"] as const;
/**
 * From "a": opening b changes a (closing) and b; opening c then leaves b as committed (closed)
 * again, so it is no longer pending (walkthrough 9.3).
 */
const EXCLUSIVE_CHANGED = [
  ["a", "b"],
  ["a", "c"],
  ["a", "c"],
] as const;

export const accordionExclusiveDriver: ValueActionDriver<
  string | null,
  AccordionValueChangeDetails
> = {
  ...shared,
  label: "Accordion.Root exclusive",
  render: ({ value, defaultValue, changeAction, transition, extra }) => (
    <Accordion.Root
      exclusive
      data-testid="root"
      {...definedProps({ value, defaultValue, valueChangeAction: changeAction })}
      {...extra}
    >
      {items(transition)}
    </Accordion.Root>
  ),
  values: ["a", "b", "c", "a"],
  gesture: (user, i) => user.click(trigger(EXCLUSIVE_VALUES[i + 1]!)),
  detailsFields: (i) => ({ reason: "activate", item: EXCLUSIVE_VALUES[i + 1], open: true }),
  expectShown,
  expectCommitted,
  shown: join,
  committedShown: join,
  pendingOn: (i) => pendingParts(EXCLUSIVE_CHANGED[i]!),
  pendingOff: (i) => idleParts(EXCLUSIVE_CHANGED[i]!),
  transitionTypes: [
    ["fsui-accordion", "fsui-accordion-expand"],
    ["fsui-accordion", "fsui-accordion-expand"],
    ["fsui-accordion", "fsui-accordion-expand"],
  ],
};

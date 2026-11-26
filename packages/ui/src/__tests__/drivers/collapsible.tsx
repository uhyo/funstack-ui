// Collapsible as seen by the value-action suite (value-action-suite.tsx), in library mode: one
// `<details>`, `open`. The Root and Trigger `data-open` are optimistic; the `<details open>` and
// the Panel's `open` state follow the committed value. `data-pending` is the Root's transition, on
// Root and Trigger (design/components/collapsible.md 2.2).
import { screen } from "@testing-library/react";
import { expect } from "vitest";
import { Collapsible } from "../../collapsible/index.js";
import type { CollapsibleOpenChangeDetails } from "../../collapsible/index.js";
import { definedProps } from "../value-action-suite.js";
import type { ValueActionDriver } from "../value-action-suite.js";

const root = () => screen.getByTestId("root") as HTMLDetailsElement;
const trigger = () => screen.getByTestId("trigger");
const panel = () => screen.getByTestId("panel");
const panelOpen = () => screen.getByTestId("panel-open");

export const collapsibleDriver: ValueActionDriver<boolean, CollapsibleOpenChangeDetails> = {
  name: "Collapsible.Root",
  render: ({ value, defaultValue, changeAction, transition, extra }) => (
    <Collapsible.Root
      data-testid="root"
      {...definedProps({
        open: value,
        defaultOpen: defaultValue,
        openChangeAction: changeAction,
        transition,
      })}
      {...extra}
    >
      <Collapsible.Trigger data-testid="trigger" {...definedProps({ transition })}>
        Details
      </Collapsible.Trigger>
      <Collapsible.Panel data-testid="panel" {...definedProps({ transition })}>
        {({ open }) => <span data-testid="panel-open">{String(open)}</span>}
      </Collapsible.Panel>
    </Collapsible.Root>
  ),
  values: [false, true, false, true],
  gesture: (user) => user.click(trigger()),
  eventType: () => "click",
  detailsFields: () => ({ reason: "activate" }),
  expectShown: (open) => {
    for (const el of [root(), trigger()]) {
      if (open) expect(el).toHaveAttribute("data-open", "");
      else expect(el).not.toHaveAttribute("data-open");
    }
  },
  expectCommitted: (open) => {
    expect(root().open).toBe(open);
    if (open) expect(root()).toHaveAttribute("open");
    else expect(root()).not.toHaveAttribute("open");
    expect(panelOpen()).toHaveTextContent(String(open));
  },
  readShown: () => String(trigger().hasAttribute("data-open")),
  shown: String,
  readCommitted: () => String(root().hasAttribute("open")),
  committedShown: String,
  pendingOn: () => [root(), trigger()],
  pendingOff: () => [panel()],
  queryControl: () => screen.queryByTestId("root"),
  implicitDefault: false,
  props: { value: "open", defaultValue: "defaultOpen" },
  transitionTypes: [
    ["fsui-collapsible", "fsui-collapsible-expand"],
    ["fsui-collapsible", "fsui-collapsible-collapse"],
    ["fsui-collapsible", "fsui-collapsible-expand"],
  ],
};

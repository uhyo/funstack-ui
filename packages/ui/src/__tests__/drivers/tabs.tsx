// Tabs as seen by the value-action suite (value-action-suite.tsx): three tabs a, b, c with an
// Indicator; the selected tab is optimistic, the panel follows the committed value.
import { screen } from "@testing-library/react";
import { expect } from "vitest";
import { Tabs } from "../../tabs/index.js";
import type { TabsValueChangeDetails } from "../../tabs/index.js";
import { definedProps } from "../value-action-suite.js";
import type { ValueActionDriver } from "../value-action-suite.js";

const VALUES = ["a", "b", "c"] as const;
const tab = (v: string) => screen.getByRole("tab", { name: v.toUpperCase() });
/** The panel a tab controls (via `aria-controls`), or null when it is not mounted. */
const panelOf = (v: string) => document.getElementById(tab(v).getAttribute("aria-controls")!);
const root = () => screen.getByRole("tablist").parentElement!;
const indicator = () => screen.getByTestId("indicator");

export const tabsDriver: ValueActionDriver<string, TabsValueChangeDetails> = {
  name: "Tabs.Root",
  render: ({ value, defaultValue, changeAction, transition, extra }) => (
    <Tabs.Root
      {...definedProps({ value, defaultValue, valueChangeAction: changeAction })}
      {...extra}
    >
      <Tabs.List aria-label="Sections">
        {VALUES.map((v) => (
          <Tabs.Tab key={v} value={v} {...definedProps({ transition })}>
            {v.toUpperCase()}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator data-testid="indicator" />
      </Tabs.List>
      {VALUES.map((v) => (
        <Tabs.Panel key={v} value={v} {...definedProps({ transition })}>
          Panel {v}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  ),
  values: ["a", "b", "c", "a"],
  gesture: (user, i) => user.click(tab(tabsDriver.values[i + 1]!)),
  // Automatic activation: a click on a tab while another tab has focus dispatches from the
  // focus move (the first click comes from outside the list).
  eventType: (i) => (i === 0 ? "click" : "focusin"),
  detailsFields: () => ({ reason: "activate" }),
  expectShown: (selected) => {
    for (const v of VALUES) {
      const t = tab(v);
      expect(t).toHaveAttribute("aria-selected", String(v === selected));
      expect(t).toHaveAttribute("tabindex", v === selected ? "0" : "-1");
      if (v === selected) expect(t).toHaveAttribute("data-selected", "");
      else expect(t).not.toHaveAttribute("data-selected");
    }
  },
  expectCommitted: (selected) => {
    expect(screen.getByRole("tabpanel")).toHaveTextContent(`Panel ${selected}`);
    for (const v of VALUES) {
      if (v === selected) expect(panelOf(v)).toBeInTheDocument();
      else expect(panelOf(v)).not.toBeInTheDocument();
    }
  },
  readShown: () => screen.getByRole("tab", { selected: true }).textContent ?? "",
  shown: (v) => v.toUpperCase(),
  pendingOn: (i) => [root(), tab(tabsDriver.values[i + 1]!), indicator()],
  pendingOff: (i) => [
    ...VALUES.filter((v) => v !== tabsDriver.values[i + 1]).map(tab),
    screen.getByRole("tabpanel"),
  ],
  queryControl: () => screen.queryByRole("tablist"),
  implicitDefault: false,
  props: { value: "value", defaultValue: "defaultValue" },
  transitionTypes: [
    ["fsui-tabs", "fsui-tabs-next"],
    ["fsui-tabs", "fsui-tabs-next"],
    ["fsui-tabs", "fsui-tabs-prev"],
  ],
};

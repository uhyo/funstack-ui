// ToggleGroup (multiple) as seen by the value-action suite (value-action-suite.tsx): bold, italic,
// underline; the gestures press Bold, press Italic, release Bold. The "update on success" parent
// patches its value with `details.added` / `removed` (design 2.3).
import { screen } from "@testing-library/react";
import { expect } from "vitest";
import { ToggleGroup } from "../../toggle-group/index.js";
import type { ToggleGroupValueChangeDetails } from "../../toggle-group/index.js";
import { definedProps } from "../value-action-suite.js";
import type { ValueActionDriver } from "../value-action-suite.js";

const STYLES = ["bold", "italic", "underline"] as const;
const CLICKS = ["bold", "italic", "bold"] as const;
const item = (name: string) => screen.getByRole("button", { name });
const root = () => screen.getByRole("group");

export const toggleGroupDriver: ValueActionDriver<string[], ToggleGroupValueChangeDetails> = {
  name: "ToggleGroup.Root",
  render: ({ value, defaultValue, changeAction, transition, extra }) => (
    <ToggleGroup.Root
      aria-label="Text style"
      {...definedProps({ value, defaultValue, valueChangeAction: changeAction })}
      {...extra}
    >
      {STYLES.map((v) => (
        <ToggleGroup.Item key={v} value={v} {...definedProps({ transition })}>
          {v}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  ),
  values: [[], ["bold"], ["bold", "italic"], ["italic"]],
  gesture: (user, i) => user.click(item(CLICKS[i]!)),
  eventType: () => "click",
  detailsFields: (i) =>
    [
      { added: ["bold"], removed: [] },
      { added: ["italic"], removed: [] },
      { added: [], removed: ["bold"] },
    ][i]!,
  expectShown: (pressed) => {
    for (const v of STYLES) {
      expect(item(v)).toHaveAttribute("aria-pressed", String(pressed.includes(v)));
      if (pressed.includes(v)) expect(item(v)).toHaveAttribute("data-pressed", "");
      else expect(item(v)).not.toHaveAttribute("data-pressed");
    }
  },
  readShown: () => STYLES.filter((v) => item(v).getAttribute("aria-pressed") === "true").join(","),
  shown: (v) => STYLES.filter((s) => v.includes(s)).join(","),
  // An Item is pending while its own press is in flight; the Root while any is.
  pendingOn: (i) => [root(), ...STYLES.slice(0, i + 1).map(item)],
  pendingOff: (i) => STYLES.slice(i + 1).map(item),
  queryControl: () => screen.queryByRole("group"),
  props: { value: "value", defaultValue: "defaultValue" },
  commit: (prev, _next, details) => [
    ...prev.filter((v) => !details.removed.includes(v)),
    ...details.added.filter((v) => !prev.includes(v)),
  ],
  orderIndependentCommit: true,
  format: (v) => [...v].sort().join(","),
  transitionTypes: [
    ["fsui-toggle-group", "fsui-toggle-group-press"],
    ["fsui-toggle-group", "fsui-toggle-group-press"],
    ["fsui-toggle-group", "fsui-toggle-group-release"],
  ],
};

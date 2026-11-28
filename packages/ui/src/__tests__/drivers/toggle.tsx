// Toggle as seen by the value-action suite (value-action-suite.tsx): one button, `pressed`.
import { screen } from "@testing-library/react";
import { expect } from "vitest";
import { Toggle } from "../../toggle/toggle.js";
import type { TogglePressedChangeDetails } from "../../toggle/toggle.js";
import { definedProps } from "../value-action-suite.js";
import type { ValueActionDriver } from "../value-action-suite.js";

const button = () => screen.getByRole("button", { name: "Favorite" });

export const toggleDriver: ValueActionDriver<boolean, TogglePressedChangeDetails> = {
  name: "Toggle",
  render: ({ value, defaultValue, changeAction, extra }) => (
    <Toggle
      {...definedProps({
        pressed: value,
        defaultPressed: defaultValue,
        pressedChangeAction: changeAction,
      })}
      {...extra}
    >
      Favorite
    </Toggle>
  ),
  values: [false, true, false, true],
  gesture: (user) => user.click(button()),
  eventType: () => "click",
  detailsFields: () => ({ reason: "activate" }),
  expectShown: (pressed) => {
    expect(button()).toHaveAttribute("aria-pressed", String(pressed));
    if (pressed) expect(button()).toHaveAttribute("data-pressed", "");
    else expect(button()).not.toHaveAttribute("data-pressed");
  },
  readShown: () => button().getAttribute("aria-pressed") ?? "",
  shown: String,
  pendingOn: () => [button()],
  queryControl: () => screen.queryByRole("button", { name: "Favorite" }),
  props: { value: "pressed", defaultValue: "defaultPressed" },
  // All optimistic: no `transition` prop (conventions 5.1).
  transitionProp: false,
  transitionTypes: [
    ["fsui-toggle", "fsui-toggle-press"],
    ["fsui-toggle", "fsui-toggle-release"],
    ["fsui-toggle", "fsui-toggle-press"],
  ],
};

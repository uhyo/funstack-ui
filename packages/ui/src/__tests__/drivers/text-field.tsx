// TextField as seen by the value-action suite (value-action-suite.tsx) and the native platform
// suite (native-group-platform-suite.tsx): one input starting on "Draft"; gesture i writes the
// next text and tabs away (the blur commits, `details.event` is the `focusout`). The input shows the optimistic value and is the one pending element. No `transition` prop (design
// 11). The reset target is computed in JS and written to `defaultValue` only in the `reset` event
// (design 4.4), so `expectResetTarget` asserts nothing in the DOM: the suite's rows check the
// value a reset dispatches and shows instead.
import { act, fireEvent, screen } from "@testing-library/react";
import { expect } from "vitest";
import { TextField } from "../../text-field/index.js";
import type { TextFieldValueChangeDetails } from "../../text-field/index.js";
import type { NativeGroupPlatformDriver } from "../native-group-platform-suite.js";
import { definedProps } from "../value-action-suite.js";

export const field = () => screen.getByRole("textbox") as HTMLInputElement;

export const textFieldDriver: NativeGroupPlatformDriver<string, TextFieldValueChangeDetails> = {
  name: "TextField",
  render: ({ value, defaultValue, changeAction, extra }) => (
    <TextField
      aria-label="Title"
      {...definedProps({ value, defaultValue, valueCommitAction: changeAction })}
      {...extra}
    />
  ),
  values: ["Draft", "Report", "Plan", "Notes"],
  // One `input` event with the whole text, then a real Tab: the gesture shows the new text in
  // one commit (the post-await row records every commit of the field).
  gesture: async (user, i) => {
    act(() => {
      field().focus();
      // A form reset writes the DOM value past React's value tracker, which would drop a change
      // back to the text it last saw: a script write (no event) brings the tracker along first.
      field().value = "";
      fireEvent.change(field(), { target: { value: textFieldDriver.values[i + 1]! } });
    });
    await user.tab();
  },
  eventType: () => "focusout",
  detailsFields: () => ({ reason: "activate" }),
  expectShown: (v) => {
    expect(field().value).toBe(v);
  },
  readShown: () => field().value,
  shown: (v) => v,
  pendingOn: () => [field()],
  queryControl: () => screen.queryByRole("textbox"),
  transitionProp: false,
  props: { value: "value", defaultValue: "defaultValue" },
  format: String,
  transitionTypes: [
    ["fsui-text-field", "fsui-text-field-commit"],
    ["fsui-text-field", "fsui-text-field-commit"],
    ["fsui-text-field", "fsui-text-field-commit"],
  ],
  setDomValue: (container, v) => {
    container.querySelector("input")!.value = v;
  },
  platformDetails: () => ({ reason: "platform" }),
  expectResetTarget: () => {},
};

// Type rows of the overlay and menu alignment (#201): owned keys out of the props types
// (conventions 1.5) and the details type names (conventions 9.4). Checked by `pnpm typecheck`;
// the `it` bodies only make the rows show up in the test report.
import { describe, expectTypeOf, it } from "vitest";
import type * as UI from "../index.js";

describe("overlay owned keys are not in the props types (conventions 1.5)", () => {
  it("Trigger parts: type and aria-disabled, and the invoker attributes", () => {
    for (const key of [
      "type",
      "commandfor",
      "command",
      "popoverTarget",
      "popoverTargetAction",
      "aria-disabled",
    ] as const) {
      expectTypeOf<UI.DialogTriggerProps>().not.toHaveProperty(key);
      expectTypeOf<UI.AlertDialogTriggerProps>().not.toHaveProperty(key);
      expectTypeOf<UI.DrawerTriggerProps>().not.toHaveProperty(key);
      expectTypeOf<UI.PopoverTriggerProps>().not.toHaveProperty(key);
      expectTypeOf<UI.MenuTriggerProps>().not.toHaveProperty(key);
    }
  });

  it("Close parts: the Close list", () => {
    for (const key of [
      "type",
      "commandfor",
      "command",
      "popoverTarget",
      "popoverTargetAction",
      "aria-disabled",
    ] as const) {
      expectTypeOf<UI.DialogCloseProps>().not.toHaveProperty(key);
      expectTypeOf<UI.DrawerCloseProps>().not.toHaveProperty(key);
      expectTypeOf<UI.AlertDialogCancelProps>().not.toHaveProperty(key);
      expectTypeOf<UI.AlertDialogActionProps>().not.toHaveProperty(key);
      expectTypeOf<UI.PopoverCloseProps>().not.toHaveProperty(key);
    }
  });

  it("a dialog Popup: popover", () => {
    expectTypeOf<UI.DialogPopupProps>().not.toHaveProperty("popover");
    expectTypeOf<UI.AlertDialogPopupProps>().not.toHaveProperty("popover");
    expectTypeOf<UI.DrawerPopupProps>().not.toHaveProperty("popover");
  });

  it("passing one is a type error", () => {
    const rows = [
      // @ts-expect-error -- owned: the Trigger writes `type="button"`
      { type: "submit" } satisfies UI.DialogTriggerProps,
      // @ts-expect-error -- owned: the Trigger writes the command
      { commandfor: "x" } satisfies UI.DialogTriggerProps,
      // @ts-expect-error -- owned: the Close writes the command
      { command: "close" } satisfies UI.DialogCloseProps,
      // @ts-expect-error -- owned: `aria-disabled` follows `disabled`
      { "aria-disabled": true } satisfies UI.PopoverTriggerProps,
      // @ts-expect-error -- owned: the Close writes the command
      { popoverTarget: "x" } satisfies UI.PopoverCloseProps,
      // @ts-expect-error -- owned: the Action writes the command
      { commandfor: "x" } satisfies UI.AlertDialogActionProps,
      // @ts-expect-error -- owned: the Trigger writes `type="button"`
      { type: "submit" } satisfies UI.MenuTriggerProps,
      // @ts-expect-error -- a `<dialog popover>` breaks `showModal()`
      { popover: "auto" } satisfies UI.DialogPopupProps,
    ];
    void rows;
  });
});

describe("details type names (conventions 9.4)", () => {
  // oxlint-disable-next-line typescript/no-explicit-any -- the widest function type
  type ActionArg<F extends ((...args: any[]) => unknown) | undefined> = Parameters<NonNullable<F>>;

  it("pure triggers: <Component><Part>ActionDetails", () => {
    expectTypeOf<
      ActionArg<UI.PopoverCloseProps["action"]>[0]
    >().toEqualTypeOf<UI.PopoverCloseActionDetails>();
    expectTypeOf<
      ActionArg<UI.DialogCloseProps["action"]>[0]
    >().toEqualTypeOf<UI.DialogCloseActionDetails>();
    expectTypeOf<UI.DrawerCloseActionDetails>().toEqualTypeOf<UI.DialogCloseActionDetails>();
    expectTypeOf<UI.AlertDialogCancelActionDetails>().toEqualTypeOf<UI.DialogCloseActionDetails>();
    expectTypeOf<
      ActionArg<UI.MenuItemProps["action"]>[0]
    >().toEqualTypeOf<UI.MenuItemActionDetails>();
    expectTypeOf<UI.PopoverCloseActionDetails>().toExtend<UI.ActionDetails>();
    expectTypeOf<UI.MenuItemActionDetails>().toExtend<UI.ActionDetails>();
  });

  it("change actions: <Component><Part><State>ChangeDetails with reason", () => {
    expectTypeOf<
      ActionArg<UI.MenuCheckboxItemProps["checkedChangeAction"]>[1]
    >().toEqualTypeOf<UI.MenuCheckboxItemCheckedChangeDetails>();
    expectTypeOf<
      ActionArg<UI.MenuRadioGroupProps["valueChangeAction"]>[1]
    >().toEqualTypeOf<UI.MenuRadioGroupValueChangeDetails>();
    expectTypeOf<
      UI.MenuCheckboxItemCheckedChangeDetails["reason"]
    >().toEqualTypeOf<UI.ChangeReason>();
    expectTypeOf<UI.MenuRadioGroupValueChangeDetails["reason"]>().toEqualTypeOf<UI.ChangeReason>();
  });

  it("Menu.Popup: experimental_focusGroup (conventions 8 casing)", () => {
    expectTypeOf<UI.MenuPopupProps>().toHaveProperty("experimental_focusGroup");
    expectTypeOf<UI.MenuPopupProps>().not.toHaveProperty("experimental_focusgroup");
  });

  it("Toast: state types and closeOnActivate", () => {
    expectTypeOf<UI.ToastTitleState>().toEqualTypeOf<UI.ToastRootState>();
    expectTypeOf<UI.ToastDescriptionState>().toEqualTypeOf<UI.ToastRootState>();
    expectTypeOf<UI.ToastViewportState["empty"]>().toEqualTypeOf<boolean>();
    expectTypeOf<UI.ToastActionProps>().toHaveProperty("closeOnActivate");
    expectTypeOf<UI.ToastActionProps>().not.toHaveProperty("closeOnSettle");
  });
});

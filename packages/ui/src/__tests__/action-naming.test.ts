import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ButtonHTMLAttributes,
  DialogHTMLAttributes,
  DOMAttributes,
  InputHTMLAttributes,
} from "react";
import { describe, expect, expectTypeOf, it } from "vitest";
import type * as UI from "../index.js";

/**
 * Guards conventions 10.1 "Action naming" (#96, resolved question 39): across every public
 * `*Props` type, a key named `action` or `…Action` is a transition action (every function member
 * of its type returns `unknown`, as `Action` / `ChangeAction` do; `UrgentChangeHandler` returns
 * `void` and fails), and the library's own `on*` keys are exactly the handlers of conventions 2.1
 * (#148): `Combobox.Root`'s `onInputValueChange`, `OTPField.Root`'s `onValueChange` (#171) and
 * the overlay Roots' `onOpenChange`, each typed `UrgentChangeHandler`. DOM pass-through props (`onClick`, `onClose`, `formAction`, …) are
 * excluded when their type is React's. `Form.Root`'s `action` is React's form channel (a URL
 * string or `(formData) => unknown`): its function part returns `unknown` and passes, as it
 * should.
 *
 * Scope: `*Props` types only (conventions 10.1). Exported option objects with callbacks
 * (`ToastActionOptions.action`) are not checked here; `ToastOptions.onClose` has its own row. The check is by
 * return type, not behaviour: whether a component really runs an action in a transition is
 * covered by each component's pending / transition tests.
 *
 * The type-level assertions are enforced by `pnpm typecheck` (`tsc` over the test files); at
 * vitest runtime `expectTypeOf` is a no-op. A newly exported Props type fails the runtime
 * completeness check below until it is added to `PublicProps` and `listedKeys`.
 */

/**
 * React's types for the keys a part may pass through from `ComponentPropsWithRef<...>` to its DOM
 * element: the event handlers (`DOMAttributes`), `<dialog>`'s `onCancel` / `onClose` (Dialog.Popup,
 * Popover.Popup) and `<button>` / `<input>`'s `formAction`. `any` as the element type, so a
 * handler typed for any element matches.
 */
type DomProps = DOMAttributes<any> &
  DialogHTMLAttributes<any> &
  ButtonHTMLAttributes<any> &
  InputHTMLAttributes<any>;

/**
 * Keys of `P` that are DOM pass-throughs: named like a React DOM prop **and** typed like it (both
 * ways assignable), so a library prop that reuses a DOM name with its own type is still checked.
 */
type DomPassThroughKeys<P> = {
  [K in Extract<keyof P, keyof DomProps>]-?: [NonNullable<P[K]>] extends [NonNullable<DomProps[K]>]
    ? [NonNullable<DomProps[K]>] extends [NonNullable<P[K]>]
      ? K
      : never
    : never;
}[Extract<keyof P, keyof DomProps>];

/** The function members of a prop's type (`Form.Root`'s `action` also accepts a URL string). */
type FunctionPart<T> = Extract<NonNullable<T>, (...args: never[]) => unknown>;

/**
 * `true` for each function member returning `unknown` (a transition action), `false` for each
 * other one: distributive, so `ChangeAction<T> | ((next: T) => void)` yields `boolean`.
 */
type ReturnsUnknown<F> = F extends (...args: never[]) => infer R
  ? unknown extends R
    ? true
    : false
  : false;

type ActionKeys<P> = Exclude<Extract<keyof P, "action" | `${string}Action`>, DomPassThroughKeys<P>>;

/**
 * Keys named `action` or `…Action` whose value is not a transition action: it has no function
 * member, or one of its function members does not return `unknown`.
 */
type NonTransitionActionKeys<P> = {
  [K in ActionKeys<P>]-?: [FunctionPart<P[K]>] extends [never]
    ? K
    : false extends ReturnsUnknown<FunctionPart<P[K]>>
      ? K
      : never;
}[ActionKeys<P>];

/** `on*` keys that are not DOM pass-throughs, i.e. the library's own. */
type OwnHandlerKeys<P> = Exclude<Extract<keyof P, `on${string}`>, DomPassThroughKeys<P>>;

type PublicProps = {
  AccordionItemProps: UI.AccordionItemProps;
  AccordionPanelProps: UI.AccordionPanelProps;
  AccordionRootExclusiveProps: UI.AccordionRootExclusiveProps;
  AccordionRootMultipleProps: UI.AccordionRootMultipleProps;
  AccordionRootProps: UI.AccordionRootProps;
  AccordionTriggerProps: UI.AccordionTriggerProps;
  AlertDialogActionProps: UI.AlertDialogActionProps;
  AlertDialogCancelProps: UI.AlertDialogCancelProps;
  AlertDialogDescriptionProps: UI.AlertDialogDescriptionProps;
  AlertDialogFormProps: UI.AlertDialogFormProps;
  AlertDialogPopupProps: UI.AlertDialogPopupProps;
  AlertDialogRootProps: UI.AlertDialogRootProps;
  AlertDialogTitleProps: UI.AlertDialogTitleProps;
  AlertDialogTriggerProps: UI.AlertDialogTriggerProps;
  AvatarFallbackProps: UI.AvatarFallbackProps;
  AvatarImageProps: UI.AvatarImageProps;
  AvatarRootProps: UI.AvatarRootProps;
  ButtonProps: UI.ButtonProps;
  CSPProviderProps: UI.CSPProviderProps;
  CheckboxGroupItemProps: UI.CheckboxGroupItemProps;
  CheckboxGroupLabelProps: UI.CheckboxGroupLabelProps;
  CheckboxGroupParentProps: UI.CheckboxGroupParentProps;
  CheckboxGroupRootProps: UI.CheckboxGroupRootProps;
  CheckboxProps: UI.CheckboxProps;
  CollapsiblePanelProps: UI.CollapsiblePanelProps;
  CollapsibleRootProps: UI.CollapsibleRootProps;
  CollapsibleTriggerProps: UI.CollapsibleTriggerProps;
  ComboboxChipProps: UI.ComboboxChipProps;
  ComboboxChipRemoveProps: UI.ComboboxChipRemoveProps;
  ComboboxChipsProps: UI.ComboboxChipsProps;
  ComboboxClearProps: UI.ComboboxClearProps;
  ComboboxEmptyProps: UI.ComboboxEmptyProps;
  ComboboxGroupLabelProps: UI.ComboboxGroupLabelProps;
  ComboboxGroupProps: UI.ComboboxGroupProps;
  ComboboxInputProps: UI.ComboboxInputProps;
  ComboboxLabelProps: UI.ComboboxLabelProps;
  ComboboxListProps: UI.ComboboxListProps;
  ComboboxMultipleProps: UI.ComboboxMultipleProps;
  ComboboxOptionProps: UI.ComboboxOptionProps;
  ComboboxPopupProps: UI.ComboboxPopupProps;
  ComboboxRootProps: UI.ComboboxRootProps;
  ComboboxSingleProps: UI.ComboboxSingleProps;
  ComboboxStatusProps: UI.ComboboxStatusProps;
  ComboboxTriggerProps: UI.ComboboxTriggerProps;
  DialogCloseProps: UI.DialogCloseProps;
  DialogDescriptionProps: UI.DialogDescriptionProps;
  DialogFormProps: UI.DialogFormProps;
  DialogPopupProps: UI.DialogPopupProps;
  DialogRootProps: UI.DialogRootProps;
  DialogTitleProps: UI.DialogTitleProps;
  DialogTriggerProps: UI.DialogTriggerProps;
  DrawerCloseProps: UI.DrawerCloseProps;
  DrawerDescriptionProps: UI.DrawerDescriptionProps;
  DrawerFormProps: UI.DrawerFormProps;
  DrawerPopupProps: UI.DrawerPopupProps;
  DrawerRootProps: UI.DrawerRootProps;
  DrawerTitleProps: UI.DrawerTitleProps;
  DrawerTriggerProps: UI.DrawerTriggerProps;
  FieldControlProps: UI.FieldControlProps;
  FieldDescriptionProps: UI.FieldDescriptionProps;
  FieldErrorProps: UI.FieldErrorProps;
  FieldLabelProps: UI.FieldLabelProps;
  FieldRootProps: UI.FieldRootProps;
  FormRootProps: UI.FormRootProps;
  FormSubmitProps: UI.FormSubmitProps;
  HoverCardPopupProps: UI.HoverCardPopupProps;
  HoverCardRootProps: UI.HoverCardRootProps;
  HoverCardTriggerProps: UI.HoverCardTriggerProps;
  MenuCheckboxItemProps: UI.MenuCheckboxItemProps;
  MenuContextTriggerProps: UI.MenuContextTriggerProps;
  MenuGroupLabelProps: UI.MenuGroupLabelProps;
  MenuGroupProps: UI.MenuGroupProps;
  MenuItemProps: UI.MenuItemProps;
  MenuPopupProps: UI.MenuPopupProps;
  MenuRadioGroupProps: UI.MenuRadioGroupProps;
  MenuRadioItemProps: UI.MenuRadioItemProps;
  MenuRootProps: UI.MenuRootProps;
  MenuSeparatorProps: UI.MenuSeparatorProps;
  MenuSubmenuTriggerProps: UI.MenuSubmenuTriggerProps;
  MenuTriggerProps: UI.MenuTriggerProps;
  MenubarProps: UI.MenubarProps;
  MeterIndicatorProps: UI.MeterIndicatorProps;
  MeterLabelProps: UI.MeterLabelProps;
  MeterRootProps: UI.MeterRootProps;
  MeterTrackProps: UI.MeterTrackProps;
  MeterValueProps: UI.MeterValueProps;
  MultiSelectEmptyProps: UI.MultiSelectEmptyProps;
  MultiSelectGroupLabelProps: UI.MultiSelectGroupLabelProps;
  MultiSelectGroupProps: UI.MultiSelectGroupProps;
  MultiSelectLabelProps: UI.MultiSelectLabelProps;
  MultiSelectListProps: UI.MultiSelectListProps;
  MultiSelectOptionProps: UI.MultiSelectOptionProps;
  MultiSelectPopupProps: UI.MultiSelectPopupProps;
  MultiSelectRootProps: UI.MultiSelectRootProps;
  MultiSelectStatusProps: UI.MultiSelectStatusProps;
  MultiSelectTriggerProps: UI.MultiSelectTriggerProps;
  MultiSelectValueProps: UI.MultiSelectValueProps;
  NumberFieldDecrementProps: UI.NumberFieldDecrementProps;
  NumberFieldIncrementProps: UI.NumberFieldIncrementProps;
  NumberFieldInputProps: UI.NumberFieldInputProps;
  NumberFieldLabelProps: UI.NumberFieldLabelProps;
  NumberFieldRootProps: UI.NumberFieldRootProps;
  OTPFieldInputProps: UI.OTPFieldInputProps;
  OTPFieldRootProps: UI.OTPFieldRootProps;
  OTPFieldSlotProps: UI.OTPFieldSlotProps;
  PopoverCloseProps: UI.PopoverCloseProps;
  PopoverDescriptionProps: UI.PopoverDescriptionProps;
  PopoverPopupProps: UI.PopoverPopupProps;
  PopoverRootProps: UI.PopoverRootProps;
  PopoverTitleProps: UI.PopoverTitleProps;
  PopoverTriggerProps: UI.PopoverTriggerProps;
  ProgressIndicatorProps: UI.ProgressIndicatorProps;
  ProgressLabelProps: UI.ProgressLabelProps;
  ProgressRootProps: UI.ProgressRootProps;
  ProgressTrackProps: UI.ProgressTrackProps;
  ProgressValueProps: UI.ProgressValueProps;
  RadioGroupItemProps: UI.RadioGroupItemProps;
  RadioGroupLabelProps: UI.RadioGroupLabelProps;
  RadioGroupRootProps: UI.RadioGroupRootProps;
  SelectGroupLabelProps: UI.SelectGroupLabelProps;
  SelectGroupProps: UI.SelectGroupProps;
  SelectOptionProps: UI.SelectOptionProps;
  SelectRootProps: UI.SelectRootProps;
  SelectSeparatorProps: UI.SelectSeparatorProps;
  SelectTriggerProps: UI.SelectTriggerProps;
  SelectValueProps: UI.SelectValueProps;
  SeparatorProps: UI.SeparatorProps;
  SliderIndicatorProps: UI.SliderIndicatorProps;
  SliderLabelProps: UI.SliderLabelProps;
  SliderRootProps: UI.SliderRootProps;
  SliderThumbProps: UI.SliderThumbProps;
  SliderTrackProps: UI.SliderTrackProps;
  SliderValueProps: UI.SliderValueProps;
  SwitchProps: UI.SwitchProps;
  TabsIndicatorProps: UI.TabsIndicatorProps;
  TabsListProps: UI.TabsListProps;
  TabsPanelProps: UI.TabsPanelProps;
  TabsRootProps: UI.TabsRootProps;
  TabsTabProps: UI.TabsTabProps;
  ToastActionProps: UI.ToastActionProps;
  ToastCloseProps: UI.ToastCloseProps;
  ToastDescriptionProps: UI.ToastDescriptionProps;
  ToastRootProps: UI.ToastRootProps;
  ToastTitleProps: UI.ToastTitleProps;
  ToastViewportProps: UI.ToastViewportProps;
  ToggleGroupExclusiveProps: UI.ToggleGroupExclusiveProps;
  ToggleGroupItemProps: UI.ToggleGroupItemProps;
  ToggleGroupMultipleProps: UI.ToggleGroupMultipleProps;
  ToggleGroupRootProps: UI.ToggleGroupRootProps;
  ToggleProps: UI.ToggleProps;
  ToolbarRootProps: UI.ToolbarRootProps;
  ToolbarSeparatorProps: UI.ToolbarSeparatorProps;
  TooltipArrowProps: UI.TooltipArrowProps;
  TooltipPopupProps: UI.TooltipPopupProps;
  TooltipRootProps: UI.TooltipRootProps;
  TooltipTriggerProps: UI.TooltipTriggerProps;
};

const listedKeys = {
  AccordionItemProps: true,
  AccordionPanelProps: true,
  AccordionRootExclusiveProps: true,
  AccordionRootMultipleProps: true,
  AccordionRootProps: true,
  AccordionTriggerProps: true,
  AlertDialogActionProps: true,
  AlertDialogCancelProps: true,
  AlertDialogDescriptionProps: true,
  AlertDialogFormProps: true,
  AlertDialogPopupProps: true,
  AlertDialogRootProps: true,
  AlertDialogTitleProps: true,
  AlertDialogTriggerProps: true,
  AvatarFallbackProps: true,
  AvatarImageProps: true,
  AvatarRootProps: true,
  ButtonProps: true,
  CSPProviderProps: true,
  CheckboxGroupItemProps: true,
  CheckboxGroupLabelProps: true,
  CheckboxGroupParentProps: true,
  CheckboxGroupRootProps: true,
  CheckboxProps: true,
  CollapsiblePanelProps: true,
  CollapsibleRootProps: true,
  CollapsibleTriggerProps: true,
  ComboboxChipProps: true,
  ComboboxChipRemoveProps: true,
  ComboboxChipsProps: true,
  ComboboxClearProps: true,
  ComboboxEmptyProps: true,
  ComboboxGroupLabelProps: true,
  ComboboxGroupProps: true,
  ComboboxInputProps: true,
  ComboboxLabelProps: true,
  ComboboxListProps: true,
  ComboboxMultipleProps: true,
  ComboboxOptionProps: true,
  ComboboxPopupProps: true,
  ComboboxRootProps: true,
  ComboboxSingleProps: true,
  ComboboxStatusProps: true,
  ComboboxTriggerProps: true,
  DialogCloseProps: true,
  DialogDescriptionProps: true,
  DialogFormProps: true,
  DialogPopupProps: true,
  DialogRootProps: true,
  DialogTitleProps: true,
  DialogTriggerProps: true,
  DrawerCloseProps: true,
  DrawerDescriptionProps: true,
  DrawerFormProps: true,
  DrawerPopupProps: true,
  DrawerRootProps: true,
  DrawerTitleProps: true,
  DrawerTriggerProps: true,
  FieldControlProps: true,
  FieldDescriptionProps: true,
  FieldErrorProps: true,
  FieldLabelProps: true,
  FieldRootProps: true,
  FormRootProps: true,
  FormSubmitProps: true,
  HoverCardPopupProps: true,
  HoverCardRootProps: true,
  HoverCardTriggerProps: true,
  MenuCheckboxItemProps: true,
  MenuContextTriggerProps: true,
  MenuGroupLabelProps: true,
  MenuGroupProps: true,
  MenuItemProps: true,
  MenuPopupProps: true,
  MenuRadioGroupProps: true,
  MenuRadioItemProps: true,
  MenuRootProps: true,
  MenuSeparatorProps: true,
  MenuSubmenuTriggerProps: true,
  MenuTriggerProps: true,
  MenubarProps: true,
  MeterIndicatorProps: true,
  MeterLabelProps: true,
  MeterRootProps: true,
  MeterTrackProps: true,
  MeterValueProps: true,
  MultiSelectEmptyProps: true,
  MultiSelectGroupLabelProps: true,
  MultiSelectGroupProps: true,
  MultiSelectLabelProps: true,
  MultiSelectListProps: true,
  MultiSelectOptionProps: true,
  MultiSelectPopupProps: true,
  MultiSelectRootProps: true,
  MultiSelectStatusProps: true,
  MultiSelectTriggerProps: true,
  MultiSelectValueProps: true,
  NumberFieldDecrementProps: true,
  NumberFieldIncrementProps: true,
  NumberFieldInputProps: true,
  NumberFieldLabelProps: true,
  NumberFieldRootProps: true,
  OTPFieldInputProps: true,
  OTPFieldRootProps: true,
  OTPFieldSlotProps: true,
  PopoverCloseProps: true,
  PopoverDescriptionProps: true,
  PopoverPopupProps: true,
  PopoverRootProps: true,
  PopoverTitleProps: true,
  PopoverTriggerProps: true,
  ProgressIndicatorProps: true,
  ProgressLabelProps: true,
  ProgressRootProps: true,
  ProgressTrackProps: true,
  ProgressValueProps: true,
  RadioGroupItemProps: true,
  RadioGroupLabelProps: true,
  RadioGroupRootProps: true,
  SelectGroupLabelProps: true,
  SelectGroupProps: true,
  SelectOptionProps: true,
  SelectRootProps: true,
  SelectSeparatorProps: true,
  SelectTriggerProps: true,
  SelectValueProps: true,
  SeparatorProps: true,
  SliderIndicatorProps: true,
  SliderLabelProps: true,
  SliderRootProps: true,
  SliderThumbProps: true,
  SliderTrackProps: true,
  SliderValueProps: true,
  SwitchProps: true,
  TabsIndicatorProps: true,
  TabsListProps: true,
  TabsPanelProps: true,
  TabsRootProps: true,
  TabsTabProps: true,
  ToastActionProps: true,
  ToastCloseProps: true,
  ToastDescriptionProps: true,
  ToastRootProps: true,
  ToastTitleProps: true,
  ToastViewportProps: true,
  ToggleGroupExclusiveProps: true,
  ToggleGroupItemProps: true,
  ToggleGroupMultipleProps: true,
  ToggleGroupRootProps: true,
  ToggleProps: true,
  ToolbarRootProps: true,
  ToolbarSeparatorProps: true,
  TooltipArrowProps: true,
  TooltipPopupProps: true,
  TooltipRootProps: true,
  TooltipTriggerProps: true,
} as const satisfies Record<keyof PublicProps, true>;
const listed = Object.keys(listedKeys);

/** Per Props type, the offending keys; a failure names both (types with none are dropped). */
type Offenders = {
  [
    K in keyof PublicProps as [NonTransitionActionKeys<PublicProps[K]>] extends [never] ? never : K
  ]: NonTransitionActionKeys<PublicProps[K]>;
};
type OwnHandlers = { [K in keyof PublicProps]: OwnHandlerKeys<PublicProps[K]> }[keyof PublicProps];

describe("action naming (conventions 10.1)", () => {
  it("the guard types catch an urgent handler named as an action, and own `on*` keys", () => {
    expectTypeOf<
      NonTransitionActionKeys<{
        inputValueChangeAction?: UI.UrgentChangeHandler<string>;
        valueChangeAction?: UI.ChangeAction<string>;
        action?: string | ((formData: FormData) => unknown);
        formAction?: ButtonHTMLAttributes<HTMLButtonElement>["formAction"];
        labelAction?: string;
        mixedAction?: UI.ChangeAction<string> | ((next: string) => void);
      }>
    >().toEqualTypeOf<"inputValueChangeAction" | "labelAction" | "mixedAction">();
    // A DOM name with the library's own type is the library's: `formAction` here, `onClose` below.
    expectTypeOf<
      NonTransitionActionKeys<{ formAction?: UI.UrgentChangeHandler<string> }>
    >().toEqualTypeOf<"formAction">();
    expectTypeOf<
      OwnHandlerKeys<{
        onValueChange?: () => void;
        onClick?: DOMAttributes<HTMLButtonElement>["onClick"];
        onCancel?: DialogHTMLAttributes<HTMLDialogElement>["onCancel"];
        onClose?: (reason: string) => void;
      }>
    >().toEqualTypeOf<"onValueChange" | "onClose">();
  });

  it("every `action` / `…Action` prop is a transition action", () => {
    expectTypeOf<Offenders>().toEqualTypeOf<{}>();
  });

  it("the library's own `on*` props are the handlers of conventions 2.1 (#148)", () => {
    expectTypeOf<OwnHandlers>().toEqualTypeOf<
      "onInputValueChange" | "onOpenChange" | "onValueChange"
    >();
    expectTypeOf<UI.ComboboxRootProps["onInputValueChange"]>().toEqualTypeOf<
      UI.UrgentChangeHandler<string, UI.ComboboxInputValueChangeDetails> | undefined
    >();
    // The text of an OTPField (#171): only its Root has `onValueChange`.
    type WithValueChange = {
      [K in keyof PublicProps]: "onValueChange" extends OwnHandlerKeys<PublicProps[K]> ? K : never;
    }[keyof PublicProps];
    expectTypeOf<WithValueChange>().toEqualTypeOf<"OTPFieldRootProps">();
    expectTypeOf<UI.OTPFieldRootProps["onValueChange"]>().toEqualTypeOf<
      UI.UrgentChangeHandler<string, UI.OTPFieldValueChangeDetails> | undefined
    >();
    // Exactly the overlay Roots, each with the details type of its `openChangeAction`.
    type WithOpenChange = {
      [K in keyof PublicProps]: "onOpenChange" extends OwnHandlerKeys<PublicProps[K]> ? K : never;
    }[keyof PublicProps];
    expectTypeOf<WithOpenChange>().toEqualTypeOf<
      | "AlertDialogRootProps"
      | "ComboboxRootProps"
      | "ComboboxSingleProps"
      | "ComboboxMultipleProps"
      | "DialogRootProps"
      | "DrawerRootProps"
      | "HoverCardRootProps"
      | "MenuRootProps"
      | "MultiSelectRootProps"
      | "PopoverRootProps"
    >();
    expectTypeOf<UI.PopoverRootProps["onOpenChange"]>().toEqualTypeOf<
      UI.UrgentChangeHandler<boolean, UI.PopoverOpenChangeDetails> | undefined
    >();
    expectTypeOf<UI.MenuRootProps["onOpenChange"]>().toEqualTypeOf<
      UI.UrgentChangeHandler<boolean, UI.MenuOpenChangeDetails> | undefined
    >();
    expectTypeOf<UI.ComboboxRootProps["onOpenChange"]>().toEqualTypeOf<
      UI.UrgentChangeHandler<boolean, UI.ComboboxOpenChangeDetails> | undefined
    >();
    expectTypeOf<UI.DialogRootProps["onOpenChange"]>().toEqualTypeOf<
      UI.UrgentChangeHandler<boolean, UI.DialogOpenChangeDetails> | undefined
    >();
    expectTypeOf<UI.AlertDialogRootProps["onOpenChange"]>().toEqualTypeOf<
      UI.UrgentChangeHandler<boolean, UI.AlertDialogOpenChangeDetails> | undefined
    >();
    expectTypeOf<UI.DrawerRootProps["onOpenChange"]>().toEqualTypeOf<
      UI.UrgentChangeHandler<boolean, UI.DrawerOpenChangeDetails> | undefined
    >();
    expectTypeOf<UI.HoverCardRootProps["onOpenChange"]>().toEqualTypeOf<
      UI.UrgentChangeHandler<boolean, UI.HoverCardOpenChangeDetails> | undefined
    >();
    expectTypeOf<UI.MultiSelectRootProps["onOpenChange"]>().toEqualTypeOf<
      UI.UrgentChangeHandler<boolean, UI.MultiSelectOpenChangeDetails> | undefined
    >();
  });

  it("a toast's close callback is the `onClose` handler, not an action (#148)", () => {
    expectTypeOf<UI.ToastOptions["onClose"]>().toEqualTypeOf<
      UI.UrgentHandler<UI.ToastCloseDetails> | undefined
    >();
    expectTypeOf<UI.ToastOptions>().not.toHaveProperty("closeAction");
  });

  it("lists every Props type exported from src/index.ts", () => {
    const index = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "../index.ts"),
      "utf8",
    );
    const exported = new Set(index.match(/\b\w+Props\b/g));
    expect(exported).toEqual(new Set(listed));
  });
});

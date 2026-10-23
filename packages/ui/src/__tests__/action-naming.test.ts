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
 * `*Props` type, a key named `action` or `…Action` is a transition action (its function type
 * returns `unknown`, as `Action` / `ChangeAction` do; `UrgentChangeHandler` returns `void` and
 * fails), and the only `on*` key the library defines itself is `Combobox.Root`'s
 * `onInputValueChange`. Pass-through DOM props (`onClick`, `onClose`, `formAction`, …) are
 * excluded. `Form.Root`'s `action` is React's form channel (a URL string or
 * `(formData) => unknown`): its function part returns `unknown` and passes, as it should.
 *
 * A newly exported Props type fails the completeness check below until it is listed here.
 */

/**
 * Keys a part passes through from `ComponentPropsWithRef<...>` to its DOM element: React's
 * handlers (`DOMAttributes`), `<dialog>`'s `onCancel` / `onClose` (Dialog.Popup, Popover.Popup)
 * and `<button>` / `<input>`'s `formAction`. They are React's own and not the library's naming;
 * they cannot be told apart from library props by type, so they are not checked.
 */
type DomPassThroughKeys =
  | keyof DOMAttributes<Element>
  | keyof DialogHTMLAttributes<HTMLDialogElement>
  | keyof ButtonHTMLAttributes<HTMLButtonElement>
  | keyof InputHTMLAttributes<HTMLInputElement>;

/** The function members of a prop's type (`Form.Root`'s `action` also accepts a URL string). */
type FunctionPart<T> = Extract<NonNullable<T>, (...args: never[]) => unknown>;

/**
 * Keys named `action` or `…Action` whose value is not a transition action: a transition action
 * is a function returning `unknown`.
 */
type NonTransitionActionKeys<P> = {
  [K in Exclude<Extract<keyof P, "action" | `${string}Action`>, DomPassThroughKeys>]-?: [
    FunctionPart<P[K]>,
  ] extends [never]
    ? K
    : FunctionPart<P[K]> extends (...args: never[]) => infer R
      ? unknown extends R
        ? never
        : K
      : K;
}[Exclude<Extract<keyof P, "action" | `${string}Action`>, DomPassThroughKeys>];

/** `on*` keys that are not DOM pass-throughs, i.e. the library's own. */
type OwnHandlerKeys<P> = Exclude<Extract<keyof P, `on${string}`>, DomPassThroughKeys>;

type PublicProps = {
  AccordionItemProps: UI.AccordionItemProps;
  AccordionPanelProps: UI.AccordionPanelProps;
  AccordionRootExclusiveProps: UI.AccordionRootExclusiveProps;
  AccordionRootMultipleProps: UI.AccordionRootMultipleProps;
  AccordionRootProps: UI.AccordionRootProps;
  AccordionTriggerProps: UI.AccordionTriggerProps;
  ButtonProps: UI.ButtonProps;
  CSPProviderProps: UI.CSPProviderProps;
  CheckboxGroupItemProps: UI.CheckboxGroupItemProps;
  CheckboxGroupLabelProps: UI.CheckboxGroupLabelProps;
  CheckboxGroupParentProps: UI.CheckboxGroupParentProps;
  CheckboxGroupRootProps: UI.CheckboxGroupRootProps;
  CheckboxProps: UI.CheckboxProps;
  ComboboxClearProps: UI.ComboboxClearProps;
  ComboboxEmptyProps: UI.ComboboxEmptyProps;
  ComboboxGroupLabelProps: UI.ComboboxGroupLabelProps;
  ComboboxGroupProps: UI.ComboboxGroupProps;
  ComboboxInputProps: UI.ComboboxInputProps;
  ComboboxLabelProps: UI.ComboboxLabelProps;
  ComboboxListProps: UI.ComboboxListProps;
  ComboboxOptionProps: UI.ComboboxOptionProps;
  ComboboxPopupProps: UI.ComboboxPopupProps;
  ComboboxRootProps: UI.ComboboxRootProps;
  ComboboxStatusProps: UI.ComboboxStatusProps;
  ComboboxTriggerProps: UI.ComboboxTriggerProps;
  DialogCloseProps: UI.DialogCloseProps;
  DialogDescriptionProps: UI.DialogDescriptionProps;
  DialogFormProps: UI.DialogFormProps;
  DialogPopupProps: UI.DialogPopupProps;
  DialogRootProps: UI.DialogRootProps;
  DialogTitleProps: UI.DialogTitleProps;
  DialogTriggerProps: UI.DialogTriggerProps;
  FieldControlProps: UI.FieldControlProps;
  FieldDescriptionProps: UI.FieldDescriptionProps;
  FieldErrorProps: UI.FieldErrorProps;
  FieldLabelProps: UI.FieldLabelProps;
  FieldRootProps: UI.FieldRootProps;
  FormRootProps: UI.FormRootProps;
  FormSubmitProps: UI.FormSubmitProps;
  MenuCheckboxItemProps: UI.MenuCheckboxItemProps;
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
  MeterIndicatorProps: UI.MeterIndicatorProps;
  MeterLabelProps: UI.MeterLabelProps;
  MeterRootProps: UI.MeterRootProps;
  MeterTrackProps: UI.MeterTrackProps;
  MeterValueProps: UI.MeterValueProps;
  NumberFieldDecrementProps: UI.NumberFieldDecrementProps;
  NumberFieldIncrementProps: UI.NumberFieldIncrementProps;
  NumberFieldInputProps: UI.NumberFieldInputProps;
  NumberFieldLabelProps: UI.NumberFieldLabelProps;
  NumberFieldRootProps: UI.NumberFieldRootProps;
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

const listed = [
  "AccordionItemProps",
  "AccordionPanelProps",
  "AccordionRootExclusiveProps",
  "AccordionRootMultipleProps",
  "AccordionRootProps",
  "AccordionTriggerProps",
  "ButtonProps",
  "CSPProviderProps",
  "CheckboxGroupItemProps",
  "CheckboxGroupLabelProps",
  "CheckboxGroupParentProps",
  "CheckboxGroupRootProps",
  "CheckboxProps",
  "ComboboxClearProps",
  "ComboboxEmptyProps",
  "ComboboxGroupLabelProps",
  "ComboboxGroupProps",
  "ComboboxInputProps",
  "ComboboxLabelProps",
  "ComboboxListProps",
  "ComboboxOptionProps",
  "ComboboxPopupProps",
  "ComboboxRootProps",
  "ComboboxStatusProps",
  "ComboboxTriggerProps",
  "DialogCloseProps",
  "DialogDescriptionProps",
  "DialogFormProps",
  "DialogPopupProps",
  "DialogRootProps",
  "DialogTitleProps",
  "DialogTriggerProps",
  "FieldControlProps",
  "FieldDescriptionProps",
  "FieldErrorProps",
  "FieldLabelProps",
  "FieldRootProps",
  "FormRootProps",
  "FormSubmitProps",
  "MenuCheckboxItemProps",
  "MenuGroupLabelProps",
  "MenuGroupProps",
  "MenuItemProps",
  "MenuPopupProps",
  "MenuRadioGroupProps",
  "MenuRadioItemProps",
  "MenuRootProps",
  "MenuSeparatorProps",
  "MenuSubmenuTriggerProps",
  "MenuTriggerProps",
  "MeterIndicatorProps",
  "MeterLabelProps",
  "MeterRootProps",
  "MeterTrackProps",
  "MeterValueProps",
  "NumberFieldDecrementProps",
  "NumberFieldIncrementProps",
  "NumberFieldInputProps",
  "NumberFieldLabelProps",
  "NumberFieldRootProps",
  "PopoverCloseProps",
  "PopoverDescriptionProps",
  "PopoverPopupProps",
  "PopoverRootProps",
  "PopoverTitleProps",
  "PopoverTriggerProps",
  "ProgressIndicatorProps",
  "ProgressLabelProps",
  "ProgressRootProps",
  "ProgressTrackProps",
  "ProgressValueProps",
  "RadioGroupItemProps",
  "RadioGroupLabelProps",
  "RadioGroupRootProps",
  "SelectGroupLabelProps",
  "SelectGroupProps",
  "SelectOptionProps",
  "SelectRootProps",
  "SelectSeparatorProps",
  "SelectTriggerProps",
  "SelectValueProps",
  "SliderIndicatorProps",
  "SliderLabelProps",
  "SliderRootProps",
  "SliderThumbProps",
  "SliderTrackProps",
  "SliderValueProps",
  "SwitchProps",
  "TabsIndicatorProps",
  "TabsListProps",
  "TabsPanelProps",
  "TabsRootProps",
  "TabsTabProps",
  "ToastActionProps",
  "ToastCloseProps",
  "ToastDescriptionProps",
  "ToastRootProps",
  "ToastTitleProps",
  "ToastViewportProps",
  "ToggleGroupExclusiveProps",
  "ToggleGroupItemProps",
  "ToggleGroupMultipleProps",
  "ToggleGroupRootProps",
  "ToggleProps",
  "ToolbarRootProps",
  "ToolbarSeparatorProps",
  "TooltipArrowProps",
  "TooltipPopupProps",
  "TooltipRootProps",
  "TooltipTriggerProps",
] as const;

type Offenders = {
  [K in keyof PublicProps]: NonTransitionActionKeys<PublicProps[K]>;
}[keyof PublicProps];
type OwnHandlers = { [K in keyof PublicProps]: OwnHandlerKeys<PublicProps[K]> }[keyof PublicProps];

describe("action naming (conventions 10.1)", () => {
  it("the guard types catch an urgent handler named as an action, and own `on*` keys", () => {
    expectTypeOf<
      NonTransitionActionKeys<{
        inputValueChangeAction?: UI.UrgentChangeHandler<string>;
        valueChangeAction?: UI.ChangeAction<string>;
        action?: string | ((formData: FormData) => unknown);
        formAction?: string | ((formData: FormData) => void);
        labelAction?: string;
      }>
    >().toEqualTypeOf<"inputValueChangeAction" | "labelAction">();
    expectTypeOf<
      OwnHandlerKeys<{ onValueChange?: () => void; onClick?: () => void; onClose?: () => void }>
    >().toEqualTypeOf<"onValueChange">();
  });

  it("every `action` / `…Action` prop is a transition action", () => {
    expectTypeOf<Offenders>().toEqualTypeOf<never>();
  });

  it("the library's only own `on*` prop is Combobox.Root's urgent handler", () => {
    expectTypeOf<OwnHandlers>().toEqualTypeOf<"onInputValueChange">();
    expectTypeOf<UI.ComboboxRootProps["onInputValueChange"]>().toEqualTypeOf<
      UI.UrgentChangeHandler<string, UI.ComboboxInputValueChangeDetails> | undefined
    >();
  });

  it("lists every Props type exported from src/index.ts", () => {
    expectTypeOf<Exclude<keyof PublicProps, (typeof listed)[number]>>().toEqualTypeOf<never>();
    const index = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "../index.ts"),
      "utf8",
    );
    const exported = new Set(index.match(/\b\w+Props\b/g));
    expect(exported).toEqual(new Set(listed));
  });
});

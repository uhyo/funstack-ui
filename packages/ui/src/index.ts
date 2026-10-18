/**
 * FUNSTACK UI — headless UI library for React, Async React-native.
 *
 * Every component is also available from its own subpath (`@funstack/ui/toggle`), which is the
 * documented form.
 */
// Ships the platform attribute typings (`interestfor`, `focusgroup`, ...) to consumers
// (conventions 7.4). Type-only: nothing is imported at runtime.
import "./internal/platform-attributes.js";

export { Toggle } from "./toggle/index.js";
export type { ToggleProps, ToggleState, TogglePressedChangeDetails } from "./toggle/index.js";

export { ToggleGroup } from "./toggle-group/index.js";
export type {
  ToggleGroupRootProps,
  ToggleGroupMultipleProps,
  ToggleGroupExclusiveProps,
  ToggleGroupRootState,
  ToggleGroupValueChangeDetails,
  ToggleGroupOrientation,
  ToggleGroupItemProps,
  ToggleGroupItemState,
} from "./toggle-group/index.js";

export { Toolbar } from "./toolbar/index.js";
export type {
  ToolbarRootProps,
  ToolbarRootState,
  ToolbarOrientation,
  ToolbarButtonProps,
  ToolbarButtonState,
  ToolbarButtonActionDetails,
  ToolbarSeparatorProps,
  ToolbarSeparatorState,
} from "./toolbar/index.js";

export { Accordion } from "./accordion/index.js";
export type {
  AccordionRootProps,
  AccordionRootMultipleProps,
  AccordionRootExclusiveProps,
  AccordionRootState,
  AccordionValueChangeDetails,
  AccordionItemProps,
  AccordionItemState,
  AccordionTriggerProps,
  AccordionTriggerState,
  AccordionPanelProps,
  AccordionPanelState,
} from "./accordion/index.js";

export { Tabs } from "./tabs/index.js";
export type {
  TabsRootProps,
  TabsRootState,
  TabsValueChangeDetails,
  TabsOrientation,
  TabsActivationMode,
  TabsListProps,
  TabsListState,
  TabsTabProps,
  TabsTabState,
  TabsPanelProps,
  TabsPanelState,
  TabsIndicatorProps,
  TabsIndicatorState,
} from "./tabs/index.js";

export { Tooltip } from "./tooltip/index.js";
export type {
  TooltipRootProps,
  TooltipRootState,
  TooltipProvides,
  TooltipTriggerProps,
  TooltipTriggerState,
  TooltipPopupProps,
  TooltipPopupState,
  TooltipSide,
  TooltipAlign,
} from "./tooltip/index.js";

export { Switch } from "./switch/index.js";
export type { SwitchProps, SwitchState, SwitchCheckedChangeDetails } from "./switch/index.js";

export { Checkbox } from "./checkbox/index.js";
export type {
  CheckboxProps,
  CheckboxState,
  CheckboxCheckedChangeDetails,
} from "./checkbox/index.js";

export { Dialog } from "./dialog/index.js";
export type {
  DialogRootProps,
  DialogRootState,
  DialogOpenChangeDetails,
  DialogTriggerProps,
  DialogTriggerState,
  DialogPopupProps,
  DialogPopupState,
  DialogCloseProps,
  DialogCloseState,
  DialogCloseDetails,
  DialogFormProps,
  DialogFormState,
  DialogTitleProps,
  DialogTitleState,
  DialogDescriptionProps,
  DialogDescriptionState,
} from "./dialog/index.js";

export { Popover } from "./popover/index.js";
export type {
  PopoverRootProps,
  PopoverRootState,
  PopoverOpenChangeDetails,
  PopoverTriggerProps,
  PopoverTriggerState,
  PopoverPopupProps,
  PopoverPopupState,
  PopoverSide,
  PopoverAlign,
  PopoverCloseProps,
  PopoverCloseState,
  PopoverTitleProps,
  PopoverTitleState,
  PopoverDescriptionProps,
  PopoverDescriptionState,
} from "./popover/index.js";

export { Menu } from "./menu/index.js";
export type {
  MenuRootProps,
  MenuRootState,
  MenuOpenChangeDetails,
  MenuTriggerProps,
  MenuTriggerState,
  MenuPopupProps,
  MenuPopupState,
  MenuSide,
  MenuAlign,
  MenuItemProps,
  MenuItemState,
  MenuItemDetails,
  MenuCheckboxItemProps,
  MenuCheckboxItemState,
  MenuRadioGroupProps,
  MenuRadioGroupState,
  MenuRadioItemProps,
  MenuRadioItemState,
  MenuGroupProps,
  MenuGroupState,
  MenuGroupLabelProps,
  MenuGroupLabelState,
  MenuSeparatorProps,
  MenuSeparatorState,
  MenuSubmenuTriggerProps,
  MenuSubmenuTriggerState,
} from "./menu/index.js";

export { RadioGroup } from "./radio-group/index.js";

export { CheckboxGroup } from "./checkbox-group/index.js";
export type {
  CheckboxGroupRootProps,
  CheckboxGroupRootState,
  CheckboxGroupValueChangeDetails,
  CheckboxGroupLabelProps,
  CheckboxGroupItemProps,
  CheckboxGroupItemState,
  CheckboxGroupParentProps,
  CheckboxGroupParentState,
} from "./checkbox-group/index.js";
export type {
  RadioGroupRootProps,
  RadioGroupRootState,
  RadioGroupValueChangeDetails,
  RadioGroupLabelProps,
  RadioGroupItemProps,
  RadioGroupItemState,
} from "./radio-group/index.js";

export { Select } from "./select/index.js";
export type {
  SelectRootProps,
  SelectRootState,
  SelectValueChangeDetails,
  SelectTriggerProps,
  SelectValueProps,
  SelectOptionProps,
  SelectOptionState,
  SelectGroupProps,
  SelectGroupLabelProps,
  SelectSeparatorProps,
} from "./select/index.js";

export { Combobox } from "./combobox/index.js";
export type {
  ComboboxRootProps,
  ComboboxRootState,
  ComboboxValueChangeDetails,
  ComboboxInputValueChangeDetails,
  ComboboxOpenChangeDetails,
  ComboboxLabelProps,
  ComboboxLabelState,
  ComboboxInputProps,
  ComboboxInputState,
  ComboboxTriggerProps,
  ComboboxTriggerState,
  ComboboxClearProps,
  ComboboxClearState,
  ComboboxPopupProps,
  ComboboxPopupState,
  ComboboxListProps,
  ComboboxListState,
  ComboboxOptionProps,
  ComboboxOptionState,
  ComboboxGroupProps,
  ComboboxGroupState,
  ComboboxGroupLabelProps,
  ComboboxGroupLabelState,
  ComboboxEmptyProps,
  ComboboxEmptyState,
  ComboboxStatusProps,
  ComboboxStatusState,
} from "./combobox/index.js";

export { Toast, toast, createToastManager } from "./toast/index.js";
export type {
  ToastOptions,
  ToastItem,
  ToastPriority,
  ToastActionOptions,
  ToastActionDetails,
  ToastCloseDetails,
  ToastPromiseOptions,
  ToastManager,
  ToastViewportProps,
  ToastViewportState,
  ToastRootProps,
  ToastRootState,
  ToastTitleProps,
  ToastDescriptionProps,
  ToastActionProps,
  ToastActionState,
  ToastCloseProps,
  ToastCloseState,
} from "./toast/index.js";
export { Slider } from "./slider/index.js";
export type {
  SliderValue,
  SliderOrientation,
  SliderRootProps,
  SliderRootState,
  SliderValueChangeDetails,
  SliderValueCommitDetails,
  SliderLabelProps,
  SliderTrackProps,
  SliderTrackState,
  SliderIndicatorProps,
  SliderIndicatorState,
  SliderThumbProps,
  SliderThumbState,
  SliderValueProps,
  SliderValueState,
} from "./slider/index.js";

export { NumberField } from "./number-field/index.js";
export type {
  NumberFieldRootProps,
  NumberFieldState,
  NumberFieldValueChangeDetails,
  NumberFieldLabelProps,
  NumberFieldInputProps,
  NumberFieldIncrementProps,
  NumberFieldDecrementProps,
  NumberFieldButtonState,
} from "./number-field/index.js";

export { Field } from "./field/index.js";
export type {
  FieldRootProps,
  FieldState,
  FieldValidity,
  FieldValidate,
  FieldLabelProps,
  FieldControlProps,
  FieldDescriptionProps,
  FieldErrorProps,
} from "./field/index.js";

export { Form } from "./form/index.js";
export type {
  FormRootProps,
  FormRootState,
  FormErrors,
  FieldErrorValue,
  FormSubmitProps,
  FormSubmitState,
} from "./form/index.js";

export { Progress } from "./progress/index.js";
export type {
  ProgressRootProps,
  ProgressState,
  ProgressTrackProps,
  ProgressIndicatorProps,
  ProgressLabelProps,
  ProgressValueProps,
} from "./progress/index.js";

export { Meter } from "./meter/index.js";
export type {
  MeterRootProps,
  MeterState,
  MeterRegion,
  MeterTrackProps,
  MeterIndicatorProps,
  MeterLabelProps,
  MeterValueProps,
} from "./meter/index.js";

export type {
  Action,
  ActionDetails,
  ChangeAction,
  ChangeReason,
  RenderProp,
  StateValue,
  UrgentChangeAction,
} from "./internal/types.js";

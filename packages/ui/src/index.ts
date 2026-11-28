/**
 * FUNSTACK UI — headless UI library for React, Async React-native.
 *
 * Every component is also available from its own subpath (`@funstack/ui/toggle`), which is the
 * documented form.
 */
// Ships the platform attribute typings (`interestfor`, `focusgroup`, ...) to consumers
// (conventions 7.4). Type-only: nothing is imported at runtime.
import "./internal/platform-attributes.js";

export { Button } from "./button/index.js";
export type { ButtonProps, ButtonState, ButtonActionDetails } from "./button/index.js";

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

export { Separator } from "./separator/index.js";
export type { SeparatorProps, SeparatorState, SeparatorOrientation } from "./separator/index.js";

export { Toolbar } from "./toolbar/index.js";
export type {
  ToolbarRootProps,
  ToolbarRootState,
  ToolbarOrientation,
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

export { Collapsible } from "./collapsible/index.js";
export type {
  CollapsibleRootProps,
  CollapsibleRootState,
  CollapsibleOpenChangeDetails,
  CollapsibleTriggerProps,
  CollapsibleTriggerState,
  CollapsiblePanelProps,
  CollapsiblePanelState,
} from "./collapsible/index.js";

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
  TooltipArrowProps,
  TooltipArrowState,
} from "./tooltip/index.js";

export { HoverCard } from "./hover-card/index.js";

export { NavigationMenu } from "./navigation-menu/index.js";
export type {
  NavigationMenuRootProps,
  NavigationMenuRootState,
  NavigationMenuListProps,
  NavigationMenuListState,
  NavigationMenuItemProps,
  NavigationMenuItemState,
  NavigationMenuOpenChangeDetails,
  NavigationMenuTriggerProps,
  NavigationMenuTriggerState,
  NavigationMenuPopupProps,
  NavigationMenuPopupState,
  NavigationMenuSide,
  NavigationMenuAlign,
  NavigationMenuLinkProps,
  NavigationMenuLinkState,
} from "./navigation-menu/index.js";
export type {
  HoverCardRootProps,
  HoverCardRootState,
  HoverCardOpenChangeDetails,
  HoverCardTriggerProps,
  HoverCardTriggerState,
  HoverCardPopupProps,
  HoverCardPopupState,
  HoverCardSide,
  HoverCardAlign,
} from "./hover-card/index.js";

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
  DialogCloseActionDetails,
  DialogFormProps,
  DialogFormState,
  DialogTitleProps,
  DialogTitleState,
  DialogDescriptionProps,
  DialogDescriptionState,
} from "./dialog/index.js";

export { AlertDialog } from "./alert-dialog/index.js";

export { Drawer } from "./drawer/index.js";
export type {
  DrawerRootProps,
  DrawerRootState,
  DrawerOpenChangeDetails,
  DrawerTriggerProps,
  DrawerTriggerState,
  DrawerPopupProps,
  DrawerPopupState,
  DrawerSide,
  DrawerTitleProps,
  DrawerTitleState,
  DrawerDescriptionProps,
  DrawerDescriptionState,
  DrawerCloseProps,
  DrawerCloseState,
  DrawerCloseActionDetails,
  DrawerFormProps,
  DrawerFormState,
} from "./drawer/index.js";
export type {
  AlertDialogRootProps,
  AlertDialogRootState,
  AlertDialogOpenChangeDetails,
  AlertDialogTriggerProps,
  AlertDialogTriggerState,
  AlertDialogPopupProps,
  AlertDialogPopupState,
  AlertDialogTitleProps,
  AlertDialogTitleState,
  AlertDialogDescriptionProps,
  AlertDialogDescriptionState,
  AlertDialogCancelProps,
  AlertDialogCancelState,
  AlertDialogCancelActionDetails,
  AlertDialogActionProps,
  AlertDialogActionState,
  AlertDialogActionDetails,
  AlertDialogFormProps,
  AlertDialogFormState,
} from "./alert-dialog/index.js";

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
  PopoverCloseActionDetails,
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
  MenuItemActionDetails,
  MenuCheckboxItemProps,
  MenuCheckboxItemState,
  MenuCheckboxItemCheckedChangeDetails,
  MenuRadioGroupProps,
  MenuRadioGroupState,
  MenuRadioGroupValueChangeDetails,
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
  MenuContextTriggerProps,
  MenuContextTriggerState,
} from "./menu/index.js";

export { Menubar } from "./menubar/index.js";
export type { MenubarProps, MenubarState } from "./menubar/index.js";

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

export { MultiSelect } from "./multi-select/index.js";
export type {
  MultiSelectRootProps,
  MultiSelectRootState,
  MultiSelectValueChangeDetails,
  MultiSelectOpenChangeDetails,
  MultiSelectLabelProps,
  MultiSelectLabelState,
  MultiSelectTriggerProps,
  MultiSelectTriggerState,
  MultiSelectValueProps,
  MultiSelectValueState,
  MultiSelectPopupProps,
  MultiSelectPopupState,
  MultiSelectListProps,
  MultiSelectListState,
  MultiSelectOptionProps,
  MultiSelectOptionState,
  MultiSelectGroupProps,
  MultiSelectGroupState,
  MultiSelectGroupLabelProps,
  MultiSelectGroupLabelState,
  MultiSelectEmptyProps,
  MultiSelectEmptyState,
  MultiSelectStatusProps,
  MultiSelectStatusState,
} from "./multi-select/index.js";
export type {
  ComboboxRootProps,
  ComboboxSingleProps,
  ComboboxMultipleProps,
  ComboboxRootState,
  ComboboxMultipleRootState,
  ComboboxValueChangeDetails,
  ComboboxMultipleValueChangeDetails,
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
  ComboboxChipsProps,
  ComboboxChipsState,
  ComboboxChipProps,
  ComboboxChipState,
  ComboboxChipRemoveProps,
  ComboboxChipRemoveState,
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
  ToastTitleState,
  ToastDescriptionProps,
  ToastDescriptionState,
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

export { OTPField } from "./otp-field/index.js";
export type {
  OTPFieldRootProps,
  OTPFieldState,
  OTPFieldValueChangeDetails,
  OTPFieldCompleteDetails,
  OTPFieldInputProps,
  OTPFieldSlotProps,
  OTPFieldSlotState,
  OTPFieldCharset,
} from "./otp-field/index.js";
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

export { TextField } from "./text-field/index.js";
export type {
  TextFieldProps,
  TextFieldState,
  TextFieldValueChangeDetails,
} from "./text-field/index.js";

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

export { Avatar } from "./avatar/index.js";
export type {
  AvatarRootProps,
  AvatarState,
  AvatarStatus,
  AvatarImageProps,
  AvatarFallbackProps,
} from "./avatar/index.js";

export { CSPProvider, STYLE_SHA256 } from "./csp/index.js";
export type { CSPProviderProps } from "./csp/index.js";

export type {
  Action,
  ActionDetails,
  ChangeAction,
  ChangeReason,
  RenderProp,
  StateValue,
  UrgentChangeHandler,
  UrgentHandler,
  WhilePending,
} from "./internal/types.js";

// Ships the platform attribute typings with this subpath (conventions 7.4). Type-only: the built
// JS has no import of it.
import "../internal/platform-attributes.js";
import {
  MultiSelectEmpty,
  MultiSelectGroup,
  MultiSelectGroupLabel,
  MultiSelectStatus,
} from "./multi-select-group.js";
import { MultiSelectLabel } from "./multi-select-label.js";
import { MultiSelectList } from "./multi-select-list.js";
import { MultiSelectOption } from "./multi-select-option.js";
import { MultiSelectPopup } from "./multi-select-popup.js";
import { MultiSelectRoot } from "./multi-select-root.js";
import { MultiSelectTrigger } from "./multi-select-trigger.js";
import { MultiSelectValue } from "./multi-select-value.js";

/**
 * A select-only combobox with a multi-select listbox (WAI-ARIA APG) on `popover="auto"`: `Root`
 * (no DOM, or one hidden input per value with `name`) > `Label`, `Trigger`
 * (`button[role=combobox]`) > `Value`, `Popup` (`div[popover=auto]`) > `List`
 * (`div[role=listbox][aria-multiselectable]`) > `Option`, `Group` > `GroupLabel`; `Empty` and
 * `Status` in the Popup. A pick toggles one option and the listbox stays open; each pick is a
 * transition with an optimistic selection and `data-pending` on the option. Single selection is
 * `Select`, the browser's own control.
 *
 * @see https://ui.funstack.work/components/multi-select
 */
export const MultiSelect = {
  Root: MultiSelectRoot,
  Label: MultiSelectLabel,
  Trigger: MultiSelectTrigger,
  Value: MultiSelectValue,
  Popup: MultiSelectPopup,
  List: MultiSelectList,
  Option: MultiSelectOption,
  Group: MultiSelectGroup,
  GroupLabel: MultiSelectGroupLabel,
  Empty: MultiSelectEmpty,
  Status: MultiSelectStatus,
} as const;

export type {
  MultiSelectRootProps,
  MultiSelectRootState,
  MultiSelectValueChangeDetails,
  MultiSelectOpenChangeDetails,
} from "./multi-select-root.js";
export type { MultiSelectLabelProps, MultiSelectLabelState } from "./multi-select-label.js";
export type { MultiSelectTriggerProps, MultiSelectTriggerState } from "./multi-select-trigger.js";
export type { MultiSelectValueProps, MultiSelectValueState } from "./multi-select-value.js";
export type { MultiSelectPopupProps, MultiSelectPopupState } from "./multi-select-popup.js";
export type { MultiSelectListProps, MultiSelectListState } from "./multi-select-list.js";
export type { MultiSelectOptionProps, MultiSelectOptionState } from "./multi-select-option.js";
export type {
  MultiSelectGroupProps,
  MultiSelectGroupState,
  MultiSelectGroupLabelProps,
  MultiSelectGroupLabelState,
  MultiSelectEmptyProps,
  MultiSelectEmptyState,
  MultiSelectStatusProps,
  MultiSelectStatusState,
} from "./multi-select-group.js";

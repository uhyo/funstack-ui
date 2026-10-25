// Ships the platform attribute typings with this subpath (conventions 7.4). Type-only: the built
// JS has no import of it.
import "../internal/platform-attributes.js";
import { ComboboxClear } from "./combobox-clear.js";
import {
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxStatus,
} from "./combobox-group.js";
import { ComboboxInput } from "./combobox-input.js";
import { ComboboxLabel } from "./combobox-label.js";
import { ComboboxList } from "./combobox-list.js";
import { ComboboxOption } from "./combobox-option.js";
import { ComboboxPopup } from "./combobox-popup.js";
import { ComboboxRoot } from "./combobox-root.js";
import { ComboboxTrigger } from "./combobox-trigger.js";

/**
 * Editable combobox with list autocomplete (WAI-ARIA APG) on `popover="auto"`: `Root` (no DOM,
 * or one hidden input with `name`) > `Label`, `Input` (`input[role=combobox]`), `Trigger`,
 * `Clear`, `Popup` (`div[popover=auto]`) > `List` (`div[role=listbox]`) > `Option`, `Group` >
 * `GroupLabel`; `Empty` and `Status` in the Popup. Typing is urgent (the `onInputValueChange`
 * handler, the library's urgent lane); the results render from the deferred `query`; accepting an
 * option is a transition with `data-pending` on it, and the listbox closes when it settles.
 */
export const Combobox = {
  Root: ComboboxRoot,
  Label: ComboboxLabel,
  Input: ComboboxInput,
  Trigger: ComboboxTrigger,
  Clear: ComboboxClear,
  Popup: ComboboxPopup,
  List: ComboboxList,
  Option: ComboboxOption,
  Group: ComboboxGroup,
  GroupLabel: ComboboxGroupLabel,
  Empty: ComboboxEmpty,
  Status: ComboboxStatus,
} as const;

export type {
  ComboboxRootProps,
  ComboboxRootState,
  ComboboxValueChangeDetails,
  ComboboxInputValueChangeDetails,
  ComboboxOpenChangeDetails,
} from "./combobox-root.js";
export type { ComboboxLabelProps, ComboboxLabelState } from "./combobox-label.js";
export type { ComboboxInputProps, ComboboxInputState } from "./combobox-input.js";
export type { ComboboxTriggerProps, ComboboxTriggerState } from "./combobox-trigger.js";
export type { ComboboxClearProps, ComboboxClearState } from "./combobox-clear.js";
export type { ComboboxPopupProps, ComboboxPopupState } from "./combobox-popup.js";
export type { ComboboxListProps, ComboboxListState } from "./combobox-list.js";
export type { ComboboxOptionProps, ComboboxOptionState } from "./combobox-option.js";
export type {
  ComboboxGroupProps,
  ComboboxGroupState,
  ComboboxGroupLabelProps,
  ComboboxGroupLabelState,
  ComboboxEmptyProps,
  ComboboxEmptyState,
  ComboboxStatusProps,
  ComboboxStatusState,
} from "./combobox-group.js";

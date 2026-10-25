// Ships the platform typings (the `selectedcontent` element) with this subpath (conventions 7.4).
// Type-only: the built JS has no import of it.
import "../internal/platform-attributes.js";
import { SelectGroup } from "./select-group.js";
import { SelectGroupLabel } from "./select-group-label.js";
import { SelectOption } from "./select-option.js";
import { SelectRoot } from "./select-root.js";
import { SelectSeparator } from "./select-separator.js";
import { SelectTrigger } from "./select-trigger.js";
import { SelectValue } from "./select-value.js";

/**
 * Select: a real `<select>` (`Root`), progressively enhanced with customizable select. Optional
 * `Trigger` (`<button>`, first child) and `Value` (`<selectedcontent>`) for rich button content,
 * `Option` (`<option>`), `Group` (`<optgroup>`) with an optional `GroupLabel` (`<legend>`), and
 * `Separator` (`<hr>`). The picker, its keyboard and its placement are the browser's; opt into
 * the styled picker with `appearance: base-select` in your CSS. The selected option is the
 * optimistic value; the Root, the Trigger and the picked Option carry `data-pending` while
 * `valueChangeAction` is in flight.
 *
 * @see https://ui.funstack.work/components/select
 */
export const Select = {
  Root: SelectRoot,
  Trigger: SelectTrigger,
  Value: SelectValue,
  Option: SelectOption,
  Group: SelectGroup,
  GroupLabel: SelectGroupLabel,
  Separator: SelectSeparator,
} as const;

export type { SelectRootProps, SelectRootState, SelectValueChangeDetails } from "./select-root.js";
export type { SelectTriggerProps } from "./select-trigger.js";
export type { SelectValueProps } from "./select-value.js";
export type { SelectOptionProps, SelectOptionState } from "./select-option.js";
export type { SelectGroupProps } from "./select-group.js";
export type { SelectGroupLabelProps } from "./select-group-label.js";
export type { SelectSeparatorProps } from "./select-separator.js";

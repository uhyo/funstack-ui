// Ships the platform attribute typings with this subpath (conventions 7.4). Type-only: the
// built JS has no import of it.
import "../internal/platform-attributes.js";
import { CheckboxGroupItem } from "./checkbox-group-item.js";
import { CheckboxGroupLabel } from "./checkbox-group-label.js";
import { CheckboxGroupParent } from "./checkbox-group-parent.js";
import { CheckboxGroupRoot } from "./checkbox-group-root.js";

/**
 * CheckboxGroup (WAI-ARIA APG Checkbox pattern, native HTML variant): `Root` (`fieldset`, role
 * `group`), an optional `Label` (`legend`, first child), one `Item` (`input[type=checkbox]`) per
 * value, and optional `Parent` boxes (the mixed-state "select all" over a subset of values). The
 * value is a set of strings; the keyboard is entirely native. Each box's DOM `checked` is
 * optimistic; the Root and the boxes whose state is changing carry `data-pending` while
 * `valueChangeAction` is in flight.
 */
export const CheckboxGroup = {
  Root: CheckboxGroupRoot,
  Label: CheckboxGroupLabel,
  Item: CheckboxGroupItem,
  Parent: CheckboxGroupParent,
} as const;

export type {
  CheckboxGroupRootProps,
  CheckboxGroupRootState,
  CheckboxGroupValueChangeDetails,
} from "./checkbox-group-root.js";
export type { CheckboxGroupLabelProps } from "./checkbox-group-label.js";
export type { CheckboxGroupItemProps, CheckboxGroupItemState } from "./checkbox-group-item.js";
export type {
  CheckboxGroupParentProps,
  CheckboxGroupParentState,
} from "./checkbox-group-parent.js";

// Ships the platform attribute typings with this subpath (conventions 7.4). Type-only: the
// built JS has no import of it.
import "../internal/platform-attributes.js";
import { RadioGroupItem } from "./radio-group-item.js";
import { RadioGroupLabel } from "./radio-group-label.js";
import { RadioGroupRoot } from "./radio-group-root.js";

/**
 * RadioGroup (WAI-ARIA APG Radio Group pattern, native HTML radio variant): `Root`
 * (`fieldset[role=radiogroup]`), an optional `Label` (`legend`, first child) and one `Item`
 * (`input[type=radio]`) per option. The keyboard is entirely native. Each Item's DOM `checked` is
 * the optimistic value; the Root and the checked Item carry `data-pending` while
 * `valueChangeAction` is in flight.
 */
export const RadioGroup = {
  Root: RadioGroupRoot,
  Label: RadioGroupLabel,
  Item: RadioGroupItem,
} as const;

export type {
  RadioGroupRootProps,
  RadioGroupRootState,
  RadioGroupValueChangeDetails,
} from "./radio-group-root.js";
export type { RadioGroupLabelProps } from "./radio-group-label.js";
export type { RadioGroupItemProps, RadioGroupItemState } from "./radio-group-item.js";

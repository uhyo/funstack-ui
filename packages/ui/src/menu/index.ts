// Ships the platform attribute typings (`command`, `commandfor`, `focusgroup`) with this subpath
// (conventions 7.4). Type-only: the built JS has no import of it.
import "../internal/platform-attributes.js";
import { MenuCheckboxItem } from "./menu-checkbox-item.js";
import { MenuGroup, MenuGroupLabel, MenuSeparator } from "./menu-group.js";
import { MenuItem } from "./menu-item.js";
import { MenuPopup } from "./menu-popup.js";
import { MenuRadioGroup } from "./menu-radio-group.js";
import { MenuRadioItem } from "./menu-radio-item.js";
import { MenuRoot } from "./menu-root.js";
import { MenuSubmenuTrigger } from "./menu-submenu-trigger.js";
import { MenuTrigger } from "./menu-trigger.js";

/**
 * Menu button (WAI-ARIA APG Menu Button + Menu) on `popover="auto"`: `Root` (no DOM) > `Trigger`
 * (`button[aria-haspopup=menu]`) + `Popup` (`div[popover=auto][role=menu]`) > `Item`,
 * `CheckboxItem`, `RadioGroup` > `RadioItem`, `Group` > `GroupLabel`, `Separator`, and submenus
 * (a `Root` inside a `Popup`, opened by its `SubmenuTrigger`). An item's `action` runs in its own
 * transition with `data-pending` on the item, and the whole menu closes when it settles.
 */
export const Menu = {
  Root: MenuRoot,
  Trigger: MenuTrigger,
  Popup: MenuPopup,
  Item: MenuItem,
  CheckboxItem: MenuCheckboxItem,
  RadioGroup: MenuRadioGroup,
  RadioItem: MenuRadioItem,
  Group: MenuGroup,
  GroupLabel: MenuGroupLabel,
  Separator: MenuSeparator,
  SubmenuTrigger: MenuSubmenuTrigger,
} as const;

export type { MenuRootProps, MenuRootState, MenuOpenChangeDetails } from "./menu-root.js";
export type { MenuTriggerProps, MenuTriggerState } from "./menu-trigger.js";
export type { MenuPopupProps, MenuPopupState, MenuSide, MenuAlign } from "./menu-popup.js";
export type { MenuItemProps, MenuItemState, MenuItemDetails } from "./menu-item.js";
export type { MenuCheckboxItemProps, MenuCheckboxItemState } from "./menu-checkbox-item.js";
export type { MenuRadioGroupProps, MenuRadioGroupState } from "./menu-radio-group.js";
export type { MenuRadioItemProps, MenuRadioItemState } from "./menu-radio-item.js";
export type {
  MenuGroupProps,
  MenuGroupState,
  MenuGroupLabelProps,
  MenuGroupLabelState,
  MenuSeparatorProps,
  MenuSeparatorState,
} from "./menu-group.js";
export type { MenuSubmenuTriggerProps, MenuSubmenuTriggerState } from "./menu-submenu-trigger.js";

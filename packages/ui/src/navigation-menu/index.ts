// Ships the platform attribute typings (`command`, `commandfor`) with this subpath
// (conventions 7.4). Type-only: the built JS has no import of it.
import "../internal/platform-attributes.js";
import { NavigationMenuItem } from "./navigation-menu-item.js";
import { NavigationMenuLink } from "./navigation-menu-link.js";
import { NavigationMenuList } from "./navigation-menu-list.js";
import { NavigationMenuPopup } from "./navigation-menu-popup.js";
import { NavigationMenuRoot } from "./navigation-menu-root.js";
import { NavigationMenuTrigger } from "./navigation-menu-trigger.js";

/**
 * A site's main navigation, the APG disclosure pattern (no menu roles, Tab through everything):
 * `Root` (`nav`) > `List` (`ul[role=list]`) > `Item` (`li`, the owner of one flyout) >
 * `Trigger` (`button[popovertarget]`) + `Popup` (`div[popover=auto]`, right after the Trigger),
 * and `Link` (`a`). JS-free when an Item has none of `open` / `defaultOpen` /
 * `openChangeAction` / `onOpenChange`: the browser toggles the panel, keeps one open at a time,
 * closes it on Escape and a press outside. After hydration the library adds two closes: focus
 * leaving the Item, and a followed Link inside the panel. In library mode opening and the closes a
 * part asks for are requests (pending Trigger, content from committed state); dismissals are
 * facts for `onOpenChange(false)`.
 *
 * @see https://ui.funstack.work/components/navigation-menu
 */
export const NavigationMenu = {
  Root: NavigationMenuRoot,
  List: NavigationMenuList,
  Item: NavigationMenuItem,
  Trigger: NavigationMenuTrigger,
  Popup: NavigationMenuPopup,
  Link: NavigationMenuLink,
} as const;

export type { NavigationMenuRootProps, NavigationMenuRootState } from "./navigation-menu-root.js";
export type { NavigationMenuListProps, NavigationMenuListState } from "./navigation-menu-list.js";
export type {
  NavigationMenuItemProps,
  NavigationMenuItemState,
  NavigationMenuOpenChangeDetails,
} from "./navigation-menu-item.js";
export type {
  NavigationMenuTriggerProps,
  NavigationMenuTriggerState,
} from "./navigation-menu-trigger.js";
export type {
  NavigationMenuPopupProps,
  NavigationMenuPopupState,
  NavigationMenuSide,
  NavigationMenuAlign,
} from "./navigation-menu-popup.js";
export type { NavigationMenuLinkProps, NavigationMenuLinkState } from "./navigation-menu-link.js";

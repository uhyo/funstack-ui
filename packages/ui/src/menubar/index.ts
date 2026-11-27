// Ships the platform attribute typings with this subpath (conventions 7.4). Type-only.
import "../internal/platform-attributes.js";

/**
 * Menubar (WAI-ARIA APG Menubar): one element, `div[role=menubar]`, around top-level
 * `Menu.Root`s from `@funstack/ui/menu`. Each `Menu.Trigger` inside becomes an item of the bar
 * (`role="menuitem"`, one Tab stop, arrow keys between the menus); each menu keeps its own open
 * state, items and actions.
 *
 * @see https://ui.funstack.work/components/menubar
 */
export { Menubar } from "./menubar.js";
export type { MenubarProps, MenubarState } from "./menubar.js";

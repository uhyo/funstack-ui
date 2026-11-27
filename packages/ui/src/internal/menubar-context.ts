"use client";
import { createContext, use } from "react";

/**
 * Where focus goes when a switch opens a menu of the bar (design/components/menubar.md 2.2): the
 * first item (`"first"`, a switch from inside a menu), or nowhere (`"none"`: the arrow keys on a
 * Trigger and the pointer leave focus on the Trigger).
 */
export type MenubarOpenFocus = "first" | "none";

/**
 * What a menu of the bar registers with it (menubar.md 2.1): read and called by the bar's
 * handlers only. Registered by `Menu.Trigger` from its ref callback, keyed by its element.
 */
export interface MenubarMenu {
  /** The `disabled` prop of the Trigger: focused by a switch, never opened. */
  readonly disabled: () => boolean;
  /** The menu's `intended()` (an open requested or shown). */
  readonly intended: () => boolean;
  /**
   * The browser hid the popup and its `toggle` has not arrived yet: the menu's own rule (Tab,
   * focus leaving the popup) already dismissed it, so there is nothing to supersede.
   */
  readonly hiddenBeforeToggle: () => boolean;
  /** The popup element (`:popover-open` tells whether it is shown). */
  readonly popup: () => HTMLElement | null;
  /** Request the open (`openChangeAction(true, "activate")`) with this focus target. */
  readonly open: (event: Event, focus: MenubarOpenFocus) => void;
  /** Supersede a pending open: `requestClose(event, "dismiss")`. */
  readonly supersede: (event: Event) => void;
}

/**
 * Provided by `Menubar`; read across folders by `Menu.Trigger` (an item of the bar, its
 * registration and the hover switch) and the top-level `Menu.Popup` (the arrow keys that switch
 * from inside a menu). A `Menu.Popup` provides `null` to its content: the bar's context ends
 * there, so a submenu is not a menu of the bar (menubar.md 1). Conventions 7.1.
 */
export interface MenubarContextValue {
  /** Register the menu whose Trigger is `trigger`; returns the unregistration. */
  readonly register: (trigger: HTMLElement, menu: MenubarMenu) => () => void;
  /**
   * The switch of menubar.md 2.2: focus `target` (quietly for the pointer), close the other
   * menus of the bar at once, request `target`'s open (unless it is disabled).
   */
  readonly switchTo: (
    target: HTMLElement,
    focus: MenubarOpenFocus,
    event: Event,
    pointer: boolean,
  ) => void;
  /**
   * From inside the menu whose Trigger is `from`: switch to the next (`1`) or previous (`-1`)
   * menu of the bar, first item focused. Wraps with the bar's `loop`.
   */
  readonly step: (from: HTMLElement, delta: 1 | -1, event: Event) => void;
  /** Some menu of the bar other than `trigger`'s is intended open (menu mode, 2.1). */
  readonly otherIntended: (trigger: HTMLElement) => boolean;
  /** The bar's computed `direction` is `rtl`, read at the event (conventions 14.1). */
  readonly rtl: () => boolean;
}

export const MenubarContext = createContext<MenubarContextValue | null>(null);

/** The enclosing Menubar, or `null` outside one (and inside a `Menu.Popup`). */
export function useMenubarContext(): MenubarContextValue | null {
  return use(MenubarContext);
}

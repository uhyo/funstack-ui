"use client";
import { createContext, use } from "react";
import type { DelayedPair } from "../internal/use-delayed-pair.js";
import type { PopoverRootValue } from "../internal/use-popover-root.js";

/**
 * Where focus goes when the menu opens (design/components/menu.md 6.1): the first enabled item,
 * the last one (ArrowUp on the Trigger), or nowhere (a hover-opened submenu keeps focus on its
 * SubmenuTrigger).
 */
export type MenuOpenCause = "first" | "last" | "none";

/** One menu level: what its Root provides to its Trigger, Popup and items. */
export interface MenuContextValue {
  /** The shared popover machinery (`usePopoverRoot`). */
  readonly popover: PopoverRootValue;
  /** This Root is nested in a `Menu.Popup`. */
  readonly submenu: boolean;
  /** The top-level menu: item activation closes the whole stack through it (design 2.2). */
  readonly root: MenuContextValue;
  /** The enclosing menu of a submenu; `null` at the top level. */
  readonly parent: MenuContextValue | null;
  readonly loop: boolean;
  readonly delay: number;
  readonly closeDelay: number;
  /** The Trigger's id (`aria-labelledby` of the Popup). */
  readonly triggerId: string;
  /** Record the focus target of the next open; read when it is dispatched. */
  readonly setOpenCause: (cause: MenuOpenCause) => void;
  /** Read and clear the focus target of the open being shown (default `"first"`). */
  readonly takeOpenCause: () => MenuOpenCause;
  /** Submenu hover-intent timers, shared by the SubmenuTrigger and the Popup. */
  readonly timers: DelayedPair;
}

export const MenuContext = createContext<MenuContextValue | null>(null);

/**
 * The close an activated item runs once its action settled: the whole stack, through the
 * top-level Root (design 2.2). Recorded at activation: if the menu was dismissed and opened again
 * meanwhile, the close belongs to the previous opening and does nothing (as `useActionTrigger`).
 */
export function closeStackLater(menu: MenuContextValue, event: Event): () => void {
  const { popover } = menu.root;
  const generation = popover.openGeneration();
  return () => {
    if (popover.openGeneration() === generation) popover.requestClose(event, "activate");
  };
}

export function useMenuContext(part: string): MenuContextValue {
  const context = use(MenuContext);
  if (context === null) {
    throw new Error(`${part} must be rendered inside a Menu.Root.`);
  }
  return context;
}

/** What a `Menu.Popup` tells the items rendered in it. */
export interface MenuListContextValue {
  /** The menu this popup belongs to. */
  readonly menu: MenuContextValue;
  /**
   * `experimental_focusgroup` is on and the engine implements it: items render no `tabindex`
   * (Chromium leaves `tabindex="-1"` elements out of a focusgroup) and the JS arrow keys step
   * aside.
   */
  readonly nativeFocusgroup: boolean;
  /** A typeahead buffer is active: Space is a character, not an activation (design 5.1). */
  readonly typingAhead: () => boolean;
}

export const MenuListContext = createContext<MenuListContextValue | null>(null);

/** `Menu.Group` / `Menu.RadioGroup`: the id their `Menu.GroupLabel` renders. */
export interface MenuGroupContextValue {
  readonly labelId: string;
}

export const MenuGroupContext = createContext<MenuGroupContextValue | null>(null);

/** `Menu.RadioGroup`'s state for its `Menu.RadioItem`s. */
export interface MenuRadioGroupContextValue {
  /** Optimistic value. */
  readonly value: string | null;
  readonly pending: boolean;
  /**
   * Dispatch `value` through the group's transition; `then` runs once the change action
   * resolved (an item's `closeOnActivate`).
   */
  readonly select: (value: string, event: Event, then: (() => void) | undefined) => void;
}

export const MenuRadioGroupContext = createContext<MenuRadioGroupContextValue | null>(null);

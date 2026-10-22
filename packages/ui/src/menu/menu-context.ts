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

/** How the open being shown should place focus (design 6.1; review H1). */
export interface MenuOpenFocus {
  readonly cause: MenuOpenCause;
  /**
   * The open came from a pointer click (`detail > 0`): the item is focused without the focus
   * ring where the engine supports `focus({ focusVisible: false })`.
   */
  readonly pointer: boolean;
}

/**
 * How the current open is placed (design/components/context-menu.md 3.1): against the Trigger
 * (`anchor`: a Menu.Trigger, a foreign invoker, a controlled or platform open), or at a point
 * (`point`: a Menu.ContextTrigger). `generation` grows with every point open or move, so a second
 * right-click at a new point is a state change while the menu is open (4.3).
 */
export type MenuPlacement =
  | { readonly kind: "anchor" }
  | {
      readonly kind: "point";
      readonly x: number;
      readonly y: number;
      readonly generation: number;
      /** The region that opened: the `source` of `showPopover({ source })` (nesting). */
      readonly source: HTMLElement;
      /** The pointer held down at the open, re-captured after a move's re-show (2.1). */
      readonly pointerId: number | undefined;
    };

export const ANCHOR_PLACEMENT: MenuPlacement = { kind: "anchor" };

/** What a ContextTrigger passes to `openAt`. */
export interface MenuOpenAtOptions {
  readonly source: HTMLElement;
  /** The `contextmenu` event, or the long-press `pointerdown` (`details.event`). */
  readonly event: Event;
  /** A pointer opened (quiet focus); `false` for the keyboard (focus ring). */
  readonly pointer: boolean;
  readonly pointerId: number | undefined;
}

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
  /** Record the focus target of the next open (and whether a pointer asked for it). */
  readonly setOpenCause: (cause: MenuOpenCause, pointer?: boolean) => void;
  /** Read and clear the focus target of the open being shown (default `"first"`, keyboard). */
  readonly takeOpenCause: () => MenuOpenFocus;
  /** Submenu hover-intent timers, shared by the SubmenuTrigger and the Popup. */
  readonly timers: DelayedPair;
  /** Placement of the current (or last) open (context-menu.md 3.1). */
  readonly placement: MenuPlacement;
  /**
   * A ContextTrigger opens the menu at `point`, or moves it there when it is already open (no
   * dispatch, 4.3).
   */
  readonly openAt: (
    point: { readonly x: number; readonly y: number },
    options: MenuOpenAtOptions,
  ) => void;
  /**
   * Back to the anchored placement once a point open has been shown and hidden (the popup is no
   * longer visible): the next open that is not a ContextTrigger's (controlled, platform, foreign
   * invoker) places against the Trigger. Ignored when a newer point was recorded meanwhile.
   */
  readonly resetPlacement: (generation: number) => void;
}

export const MenuContext = createContext<MenuContextValue | null>(null);

/**
 * `true` inside a `Menu.ContextTrigger`: a `Menu.Root` there is a nested context region's own
 * top-level menu (context-menu.md 2.4), not a misplaced submenu.
 */
export const MenuRegionContext = createContext(false);

/**
 * `contextmenu` events a ContextTrigger handled (opened or moved its menu), with the top-level
 * menu they belong to: that menu's document listener leaves its menu open for them
 * (context-menu.md 5 and 14).
 */
const handledEvents = new WeakMap<Event, object>();

/** The top-level menu's identity: its popup ref object, stable for the Root's lifetime. */
const menuKey = (menu: MenuContextValue): object => menu.root.popover.popupRef;

export function markHandled(event: Event, menu: MenuContextValue): void {
  handledEvents.set(event, menuKey(menu));
}

export function isHandledBy(event: Event, menu: MenuContextValue): boolean {
  return handledEvents.get(event) === menuKey(menu);
}

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

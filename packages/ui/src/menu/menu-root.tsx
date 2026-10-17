"use client";
import { use, useCallback, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import type { ActionDetails, ChangeAction, ChangeReason, StateValue } from "../internal/types.js";
import { useDelayedPair } from "../internal/use-delayed-pair.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { usePopoverRoot } from "../internal/use-popover-root.js";
import { resolveStateValue } from "../internal/use-render.js";
import { MenuContext, MenuListContext } from "./menu-context.js";
import type { MenuContextValue, MenuOpenFocus } from "./menu-context.js";

/** Details passed as the second argument of `Menu.Root`'s `openChangeAction`. */
export interface MenuOpenChangeDetails extends ActionDetails {
  /**
   * `"activate"`: the user acted on a part: the Trigger or SubmenuTrigger (click, Enter / Space,
   * arrow keys), an item's activation (the close after its action), ArrowLeft in a submenu, or a
   * foreign invoker.
   * `"dismiss"`: Escape, a click outside, Tab or focus leaving the menu, the pointer leaving a
   * hover-opened submenu, the parent menu closing (a submenu when the whole stack closes), script.
   * `"platform"`: the menu was found open on mount (opened before hydration); `event` is
   * `undefined`.
   */
  readonly reason: ChangeReason;
}

export interface MenuRootState {
  /** Optimistic open state. Content rendered from it must not suspend. */
  readonly open: boolean;
  /** An open or close of this Root is in flight (its `openChangeAction`). */
  readonly pending: boolean;
  /** This Root is a submenu (rendered inside a `Menu.Popup`). */
  readonly submenu: boolean;
}

export interface MenuRootProps {
  /** Controlled open state. `undefined` means uncontrolled. */
  open?: boolean;
  /** Initial open state when uncontrolled. Opens after hydration. */
  defaultOpen?: boolean;
  /**
   * Awaited for `true` (the menu opens when it resolves and the items have rendered) and for the
   * closes the user asks a part for (Trigger toggle, an item's activation, ArrowLeft in a
   * submenu); a notification for dismissals (Escape, a click outside, Tab, the parent menu
   * closing). May be a Server Function. A `setState` placed after your own `await` needs
   * `startTransition` (React limitation).
   */
  openChangeAction?: ChangeAction<boolean, MenuOpenChangeDetails>;
  /** Arrow keys wrap from the last item to the first and back. Default `true`. */
  loop?: boolean;
  /** Submenu only: milliseconds from hovering the SubmenuTrigger to the open. Default 100. */
  delay?: number;
  /**
   * Submenu only: milliseconds from the pointer leaving the SubmenuTrigger and the submenu to the
   * close. Default 150.
   */
  closeDelay?: number;
  children?: StateValue<ReactNode, MenuRootState>;
}

/**
 * Owns the ids, the open state and the context of one menu level. Renders no DOM. A `Menu.Root`
 * rendered inside a `Menu.Popup` is a **submenu**: its Trigger is a `Menu.SubmenuTrigger` (an
 * item of the parent menu) and its Popup opens beside that item.
 *
 * A menu is always in library mode (design/components/menu.md 2.1): opening and the closes a
 * part asks for are transitions (pending Trigger, items render from committed state,
 * `showPopover()` / `hidePopover()` once the change has committed); dismissals are the
 * browser's and `openChangeAction(false)` is a notification.
 */
const DEFAULT_FOCUS: MenuOpenFocus = { cause: "first", pointer: false };

export function MenuRoot({
  open,
  defaultOpen,
  openChangeAction,
  loop = true,
  delay,
  closeDelay,
  children,
}: MenuRootProps) {
  const parent = use(MenuContext);
  const list = use(MenuListContext);
  // A Root inside a Popup's content is a submenu (design 1); the enclosing menu is the Popup's.
  const parentMenu = list !== null ? list.menu : null;
  const submenu = parentMenu !== null;

  useDevWarning(
    !submenu && (delay !== undefined || closeDelay !== undefined),
    "Menu.Root: `delay` and `closeDelay` only apply to a submenu (a Menu.Root inside a " +
      "Menu.Popup); a top-level menu does not open on hover.",
  );
  useDevWarning(
    parent !== null && !submenu,
    "Menu.Root: rendered inside another Menu.Root but outside its Menu.Popup. A submenu's Root " +
      "goes inside the parent's Menu.Popup.",
  );

  const timers = useDelayedPair();
  // The cause recorded by the part about to dispatch an open, and the cause of the open being
  // shown (design 14, "Open cause").
  const nextCause = useRef<MenuOpenFocus | null>(null);
  const openCause = useRef<MenuOpenFocus | null>(null);

  const popover = usePopoverRoot<MenuOpenChangeDetails>({
    component: "menu",
    part: "Menu.Root",
    mode: "library",
    open,
    defaultOpen,
    openChangeAction,
    onDispatch: (next) => {
      // Any dispatch cancels hover intent (walkthrough 9).
      timers.cancel();
      if (next) openCause.current = nextCause.current ?? DEFAULT_FOCUS;
      nextCause.current = null;
    },
  });

  const setOpenCause = useCallback((cause: MenuOpenFocus["cause"], pointer = false) => {
    nextCause.current = { cause, pointer };
  }, []);
  const takeOpenCause = useCallback(() => {
    const cause = openCause.current ?? DEFAULT_FOCUS;
    openCause.current = null;
    return cause;
  }, []);

  const resolvedDelay = delay ?? 100;
  const resolvedCloseDelay = closeDelay ?? 150;
  // `popover` is memoised by `usePopoverRoot` (#48) and the other members are stable, so this
  // changes only with the open state, pending and the props listed below.
  const value = useMemo<MenuContextValue>(() => {
    const self: MenuContextValue = {
      popover,
      submenu,
      // The top-level menu: this one, or the parent's root (design 2.2).
      get root() {
        return parentMenu?.root ?? self;
      },
      parent: parentMenu,
      loop,
      delay: resolvedDelay,
      closeDelay: resolvedCloseDelay,
      triggerId: `${popover.ids.popup}-trigger`,
      setOpenCause,
      takeOpenCause,
      timers,
    };
    return self;
  }, [
    popover,
    submenu,
    parentMenu,
    loop,
    resolvedDelay,
    resolvedCloseDelay,
    setOpenCause,
    takeOpenCause,
    timers,
  ]);

  const state: MenuRootState = {
    open: popover.optimistic,
    pending: popover.pending,
    submenu,
  };

  return <MenuContext value={value}>{resolveStateValue(children, state)}</MenuContext>;
}

MenuRoot.displayName = "MenuRoot";

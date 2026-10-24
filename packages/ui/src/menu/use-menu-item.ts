"use client";
import { use } from "react";
import type { KeyboardEvent, MouseEvent, PointerEvent } from "react";
import { dataAttr } from "../internal/data-attr.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import type { DataAttributes } from "../internal/use-render.js";
import { MenuListContext } from "./menu-context.js";
import { hasModifier } from "./menu-dom.js";

const isDev = process.env.NODE_ENV !== "production";

export interface MenuItemBaseOptions {
  /** Public name of the part for development warnings. */
  readonly part: string;
  readonly role: "menuitem" | "menuitemcheckbox" | "menuitemradio";
  readonly disabled: boolean;
  readonly label: string | undefined;
  /**
   * Runs for a click on an enabled item (never for a disabled one). Omitted when another hook
   * handles the click (SubmenuTrigger).
   */
  readonly activate?: (event: Event) => void;
}

export interface MenuItemBase {
  /** Owned props shared by every item kind (design 3.4). */
  readonly libraryProps: {
    role: string;
    tabIndex: number | undefined;
    "aria-disabled": true | undefined;
    disabled: undefined;
    onClick: (event: MouseEvent<HTMLElement>) => void;
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  } & DataAttributes;
}

/**
 * The parts every menu item shares: role, roving `tabindex` (none on the native `focusgroup`
 * path), `aria-disabled`, activation by click / Enter / Space (Space is a typeahead character
 * while a buffer is active), and the current item following the pointer (design 6.2).
 */
export function useMenuItem(options: MenuItemBaseOptions): MenuItemBase {
  const { part, role, disabled, label, activate } = options;
  const list = use(MenuListContext);
  useDevWarning(list === null, isDev && `${part}: rendered outside a Menu.Popup.`);

  const onClick = (event: MouseEvent<HTMLElement>) => {
    if (disabled) {
      // A disabled link must not navigate either.
      event.preventDefault();
      return;
    }
    activate?.(event.nativeEvent);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || hasModifier(event)) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.key === " " && list?.typingAhead()) return;
    // No page scroll for Space, no second native click.
    event.preventDefault();
    if (disabled) return;
    // Activation is always the element's click: it runs `onClick` (and so `activate`) and the
    // element's own activation behaviour, which a link (navigation) and an item composed with
    // another trigger (`Dialog.Trigger render={<Menu.Item />}`: its command) depend on.
    event.currentTarget.click();
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const element = event.currentTarget;
    if (element.ownerDocument.activeElement !== element) element.focus();
  };

  return {
    libraryProps: {
      role,
      tabIndex: list?.nativeFocusgroup === true ? undefined : -1,
      "aria-disabled": disabled ? true : undefined,
      // Never the native attribute: disabled items stay focusable (APG), and Chromium's
      // focusgroup skips natively disabled buttons.
      disabled: undefined,
      "data-disabled": dataAttr(disabled),
      "data-typeahead": label,
      onClick,
      onKeyDown,
      onPointerMove,
    },
  };
}

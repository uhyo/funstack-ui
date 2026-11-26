"use client";
import { useCallback, useRef } from "react";
import type { KeyboardEvent } from "react";
import type { MenuContextValue } from "./menu-context.js";
import { focusItem, hasModifier, isMenuItem, isRtl, menuItems, typeaheadText } from "./menu-dom.js";
import { createTypeaheadBuffer, isTypingAhead, typeaheadMatch } from "../internal/typeahead.js";

export interface MenuKeyboard {
  /** Menu.Popup's `onKeyDown`. */
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  /** Whether a typeahead buffer is live (Space then belongs to it, not to an item). Stable. */
  readonly typingAhead: () => boolean;
}

/**
 * The keyboard model of a menu popup (design 5): ArrowUp / ArrowDown / Home / End move focus
 * between items (the browser does where `focusgroup` is native), printable characters run
 * typeahead, ArrowLeft (ArrowRight in RTL) closes a submenu.
 */
export function useMenuKeyboard(menu: MenuContextValue, nativeFocusgroup: boolean): MenuKeyboard {
  const { popover, submenu, loop } = menu;
  const typeahead = useRef(createTypeaheadBuffer());
  const typingAhead = useCallback(() => isTypingAhead(typeahead.current), []);

  // Typeahead (design 5.1, `internal/typeahead.ts`): a repeated single character cycles through
  // the items starting with it; a longer buffer keeps the current item while it still matches.
  const runTypeahead = (popup: HTMLElement, current: HTMLElement | null, key: string): boolean => {
    const items = menuItems(popup);
    const index = current === null ? -1 : items.indexOf(current);
    const match = typeaheadMatch(typeahead.current, key, items.map(typeaheadText), index);
    if (match === null) return false;
    const item = items[match];
    if (item !== undefined && item !== current) focusItem(item);
    return true;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || hasModifier(event)) return;
    const popup = event.currentTarget;
    const target = event.target as HTMLElement;
    const onItem = isMenuItem(target, popup);
    if (!onItem && target !== popup) return;
    const key = event.key;

    // ArrowLeft (ArrowRight in RTL) closes a submenu; focus returns to its SubmenuTrigger
    // through the popover hook's nested focus rule (design 6.3).
    if (submenu && key === (isRtl(popup) ? "ArrowRight" : "ArrowLeft")) {
      event.preventDefault();
      popover.requestClose(event.nativeEvent, "activate");
      return;
    }

    if (key === "ArrowDown" || key === "ArrowUp" || key === "Home" || key === "End") {
      if (!onItem) {
        // The popup itself has focus (no items at open, or focus landed on it some other way):
        // into the list from its edge.
        event.preventDefault();
        const items = menuItems(popup);
        const item = key === "ArrowDown" || key === "Home" ? items[0] : items.at(-1);
        if (item !== undefined) focusItem(item);
        return;
      }
      // The browser moves focus itself where `focusgroup` is implemented.
      if (nativeFocusgroup) return;
      event.preventDefault();
      const items = menuItems(popup);
      const index = items.indexOf(target);
      const last = items.length - 1;
      let next: number;
      if (key === "Home") next = 0;
      else if (key === "End") next = last;
      else if (key === "ArrowDown") next = index >= last ? (loop ? 0 : last) : index + 1;
      else next = index <= 0 ? (loop ? last : 0) : index - 1;
      const item = items[next];
      if (item !== undefined && item !== target) focusItem(item);
      return;
    }

    if (key.length === 1 && runTypeahead(popup, onItem ? target : null, key)) {
      event.preventDefault();
    }
  };

  return { onKeyDown, typingAhead };
}

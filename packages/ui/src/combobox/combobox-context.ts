"use client";
import { createContext, use } from "react";
import type { RefObject } from "react";
import type { PopoverRootValue } from "../internal/use-popover-root.js";

/** What a mounted `Combobox.Option` tells its Root (design 2, "mounted options, labels"). */
export interface ComboboxOptionEntry {
  readonly element: HTMLElement;
  /** The `label` prop; `undefined`: the element's trimmed `textContent` at the moment of use. */
  readonly label: string | undefined;
  readonly disabled: boolean;
}

/** One Combobox: what its Root provides to every part (design 14, `combobox-context.ts`). */
export interface ComboboxContextValue {
  /** The shared popover machinery (`usePopoverRoot`, library mode). */
  readonly popover: PopoverRootValue;
  readonly ids: {
    readonly input: string;
    readonly label: string;
    readonly list: string;
    /** `${root}-option-`: an Option's id is this plus `encodeURIComponent(value)`. */
    readonly optionPrefix: string;
  };
  /** Optimistic selection. */
  readonly value: string | null;
  /** The `valueChangeAction` transition is in flight. */
  readonly valuePending: boolean;
  /** `valuePending` or the open transition is in flight (the Root's `pending`). */
  readonly pending: boolean;
  /** The urgent text. */
  readonly inputValue: string;
  /** `useDeferredValue(inputValue)`: what the mounted results are for. */
  readonly query: string;
  readonly stale: boolean;
  /** The option `aria-activedescendant` points at (urgent virtual focus), or `null`. */
  readonly activeValue: string | null;
  /** No option is mounted and the results are settled (`Empty`, `data-empty`). */
  readonly empty: boolean;
  readonly disabled: boolean;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly listRef: RefObject<HTMLElement | null>;
  /** Registers a mounted Option; returns the unregistration. */
  readonly registerOption: (value: string, entry: ComboboxOptionEntry) => () => void;
  /** Registers a mounted `Combobox.Status`; while one is mounted the results count as loading. */
  readonly registerStatus: () => () => void;
  /** Make `value` the active option (urgent; never dispatches). */
  readonly setActive: (value: string | null) => void;
  /** Accept an option (design 5.2): urgent text write, dispatch, close when it settles. */
  readonly accept: (value: string, event: Event) => void;
  /** `Combobox.Clear` (design 3.3). */
  readonly clear: (event: Event) => void;
  /** The `change` of the Input: urgent text write and an open request (design 2.2, 5.1). */
  readonly typed: (text: string, event: Event) => void;
  /** Keyboard model of design section 8, run by the Input's `onKeyDown`. */
  readonly keyDown: (event: KeyboardEvent) => boolean;
  /** Focus left the Input (design 5.4): close at once, then revert or commit free text. */
  readonly focusOut: (event: FocusEvent) => void;
  /** A pointer click in the Input (`openOnClick`). */
  readonly inputClick: (event: MouseEvent) => void;
}

export const ComboboxContext = createContext<ComboboxContextValue | null>(null);

export function useComboboxContext(part: string): ComboboxContextValue {
  const context = use(ComboboxContext);
  if (context === null) {
    throw new Error(`${part} must be rendered inside a Combobox.Root.`);
  }
  return context;
}

/** Provided by `Combobox.Popup` (a List outside a Popup warns). */
export const ComboboxPopupContext = createContext<boolean>(false);

/** Provided by `Combobox.List` (an Option outside a List warns). */
export const ComboboxListContext = createContext<boolean>(false);

/** `Combobox.Group`: the id its `Combobox.GroupLabel` renders. */
export const ComboboxGroupContext = createContext<string | null>(null);

/** The id fragment of an option value: stable across result sets, no whitespace (design 3.5). */
export function optionId(prefix: string, value: string): string {
  return `${prefix}${encodeURIComponent(value)}`;
}

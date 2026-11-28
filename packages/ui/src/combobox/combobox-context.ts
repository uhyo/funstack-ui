"use client";
import { createContext, use } from "react";
import type { RefObject } from "react";
import type { PopoverRootValue } from "../internal/overlay/use-overlay-root.js";
import type { ListboxOptionEntry } from "../internal/use-option-registry.js";

export { optionId } from "../internal/use-option-registry.js";

/** What a mounted `Combobox.Option` tells its Root (design 2, "mounted options, labels"). */
export type ComboboxOptionEntry = ListboxOptionEntry;

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
  /** Optimistic selection; always `null` with `multiple` (design 15.2). */
  readonly value: string | null;
  /** `multiple` at mount (design 15). */
  readonly multiple: boolean;
  /** Optimistic selection as a list: pick order with `multiple`, `[value]` or `[]` otherwise. */
  readonly values: readonly string[];
  /** `value` is in the optimistic selection (`aria-selected`, `data-selected`). */
  readonly isSelected: (value: string) => boolean;
  /**
   * `data-pending` of an Option, Chip or ChipRemove: the value action is in flight and `value`
   * is its optimistic target (single, design 5.2), or its optimistic and committed membership
   * differ (`multiple`, design 15.5).
   */
  readonly isPending: (value: string) => boolean;
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
  /** A `Combobox.Status` is mounted inside the List (a Suspense fallback): results are loading. */
  readonly loading: boolean;
  /** A `Combobox.Label` is mounted (the List's `aria-labelledby` names it only then). */
  readonly hasLabel: boolean;
  /** The enclosing `Field.Label`'s id: names the List when no `Combobox.Label` is mounted. */
  readonly fieldLabelId: string | undefined;
  readonly disabled: boolean;
  /** The Root's `readOnly` (or the Field's): the popup never opens, nothing dispatches. */
  readonly readOnly: boolean;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly listRef: RefObject<HTMLElement | null>;
  /** Registers a mounted Option; returns the unregistration. */
  readonly registerOption: (value: string, entry: ComboboxOptionEntry) => () => void;
  /** Registers a mounted `Combobox.Status`; while one is mounted the results count as loading. */
  readonly registerStatus: () => () => void;
  /** Registers a mounted `Combobox.Label`; returns the unregistration. */
  readonly registerLabel: () => () => void;
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
  /** Focus arrived in the Input: track presses until a leave is decided. */
  readonly focusIn: (event: FocusEvent) => void;
  /** Focus left the Input (design 5.4): close at once, then revert or commit free text. */
  readonly focusOut: (event: FocusEvent) => void;
  /** A pointer click in the Input (`openOnClick`). */
  readonly inputClick: (event: MouseEvent) => void;
  /** A press on the Input: captures the pointer to the shown Popup (design 5.4). */
  readonly inputPointerDown: (event: PointerEvent) => void;
  /** The chips of `multiple` (design 15); inert without it. */
  readonly chips: ComboboxChipsValue;
}

/** What a mounted `Combobox.Chip` tells its Root (design 15.6, 15.7). */
export interface ComboboxChipEntry {
  readonly element: HTMLElement;
  /** The Chip's `label` prop. */
  readonly label: string | undefined;
}

/** The chips half of the Root's context (design 15). */
export interface ComboboxChipsValue {
  /** The `Combobox.Chips` element: inside the combobox for the leave rule (design 15.6). */
  readonly chipsRef: RefObject<HTMLElement | null>;
  /** The label cache's entry for `value` (design 15.1), from render state. */
  readonly labelOf: (value: string) => string | undefined;
  /** Registers a mounted Chip; returns the unregistration. */
  readonly registerChip: (value: string, entry: ComboboxChipEntry) => () => void;
  /** Registers a mounted `ChipRemove` element (skipped in a chip's announced text). */
  readonly registerRemove: (element: Element) => () => void;
  /** `Combobox.ChipRemove`'s click: remove `value`, announce it, focus the Input. */
  readonly removeChip: (value: string, event: Event) => void;
  /** The keys of a focused chip (design 15.6), run by `Chips`' `onKeyDown`. */
  readonly keyDown: (event: KeyboardEvent) => void;
  /** Focus arrived in `Chips` (on a chip): the listbox closes (design 15.6). */
  readonly focusIn: (event: FocusEvent) => void;
  /** Focus left a chip. */
  readonly focusOut: (event: FocusEvent) => void;
  /** A click in `Chips`: the Input takes focus (design 15.6). */
  readonly click: (event: MouseEvent) => void;
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

/** `Combobox.Chip`: its value, for the `Combobox.ChipRemove` inside it. */
export const ComboboxChipContext = createContext<string | null>(null);

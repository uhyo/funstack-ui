"use client";
import { createContext, use } from "react";
import type { RefObject } from "react";
import type { PopoverRootValue } from "../internal/overlay/use-overlay-root.js";
import type { GroupLabelContextValue } from "../internal/use-group-label.js";
import type { ListboxOptionEntry } from "../internal/use-option-registry.js";

/** One MultiSelect: what its Root provides to every part (design/components/multi-select.md B.1). */
export interface MultiSelectContextValue {
  /** The shared popover machinery (`usePopoverRoot`, library mode). */
  readonly popover: PopoverRootValue;
  readonly ids: {
    readonly trigger: string;
    readonly label: string;
    readonly list: string;
    /** `${root}-option-`: an Option's id is this plus `encodeURIComponent(value)`. */
    readonly optionPrefix: string;
  };
  /** Optimistic selection in pick order. */
  readonly values: readonly string[];
  /** For each value, the label cache's entry from render state (`undefined`: never seen). */
  readonly labels: readonly (string | undefined)[];
  /** `value` is in the optimistic selection (`aria-selected`, `data-selected`). */
  readonly isSelected: (value: string) => boolean;
  /** `data-pending` of an Option: its optimistic and committed membership differ (B.5). */
  readonly isPending: (value: string) => boolean;
  /** A value or open transition is in flight (the Root's `pending`). */
  readonly pending: boolean;
  /** The option `aria-activedescendant` points at (urgent virtual focus), or `null`. */
  readonly activeValue: string | null;
  /** No option is mounted and the List is not loading (`Empty`, `data-empty`). */
  readonly empty: boolean;
  /** A `MultiSelect.Status` is mounted inside the List (a Suspense fallback). */
  readonly loading: boolean;
  /** A `MultiSelect.Label` is mounted (the List's `aria-labelledby` names it only then). */
  readonly hasLabel: boolean;
  /**
   * The enclosing `Field.Label`'s id while one is mounted (field-form.md 4.2, #217): names the
   * List when no `MultiSelect.Label` is mounted.
   */
  readonly fieldLabelId: string | undefined;
  readonly disabled: boolean;
  /** The Root's `readOnly` (or the Field's): the popup never opens, nothing dispatches. */
  readonly readOnly: boolean;
  /** `required` (own or the Field's): the Trigger renders the validity element (B.10). */
  readonly required: boolean;
  /** The Root's `form`, for the validity element. */
  readonly form: string | undefined;
  readonly triggerRef: RefObject<HTMLButtonElement | null>;
  readonly listRef: RefObject<HTMLElement | null>;
  /** The validity element (B.10), rendered by the Trigger with `required`. */
  readonly validityRef: RefObject<HTMLSelectElement | null>;
  /** Registers a mounted Option; returns the unregistration. */
  readonly registerOption: (value: string, entry: ListboxOptionEntry) => () => void;
  /** Registers a mounted `MultiSelect.Status`; while one is mounted the List is loading. */
  readonly registerStatus: () => () => void;
  /** Registers a mounted `MultiSelect.Label`; returns the unregistration. */
  readonly registerLabel: () => () => void;
  /** Make `value` the active option (urgent; never dispatches). */
  readonly setActive: (value: string | null) => void;
  /** A pick (B.5): toggles the option; the listbox stays open. */
  readonly toggle: (value: string, event: Event) => void;
  /** The Trigger's click (B.4): toggles the listbox and focuses the Trigger. */
  readonly triggerClick: (event: MouseEvent) => void;
  /** The keyboard model of B.8, run by the Trigger's `onKeyDown`. */
  readonly keyDown: (event: KeyboardEvent) => void;
  /** Focus arrived on the Trigger: track presses until a leave is decided. */
  readonly focusIn: (event: FocusEvent) => void;
  /** Focus left the Trigger (B.4): the listbox closes when it went outside the Popup. */
  readonly focusOut: (event: FocusEvent) => void;
  /** The Label's click (B.8): focus the Trigger without opening the listbox. */
  readonly labelClick: (event: MouseEvent) => void;
}

export const MultiSelectContext = createContext<MultiSelectContextValue | null>(null);

export function useMultiSelectContext(part: string): MultiSelectContextValue {
  const context = use(MultiSelectContext);
  if (context === null) {
    throw new Error(`${part} must be rendered inside a MultiSelect.Root.`);
  }
  return context;
}

/** Provided by `MultiSelect.Popup` (a List outside a Popup warns). */
export const MultiSelectPopupContext = createContext<boolean>(false);

/** Provided by `MultiSelect.List` (an Option outside a List warns). */
export const MultiSelectListContext = createContext<boolean>(false);

/** `MultiSelect.Group`: the id its `MultiSelect.GroupLabel` renders and its registration (#218). */
export const MultiSelectGroupContext = createContext<GroupLabelContextValue | null>(null);

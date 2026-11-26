"use client";
import type { RefObject } from "react";
import { isPopoverOpen } from "../internal/overlay/popover-open.js";
import type { PopoverRootValue } from "../internal/overlay/use-overlay-root.js";
import { findTypeahead, isTypingAhead, pushTypeahead } from "../internal/typeahead.js";
import type { TypeaheadBuffer } from "../internal/typeahead.js";
import type { ActiveOption, PendingEdge } from "../internal/use-active-option.js";
import { optionLabel } from "../internal/use-option-registry.js";
import type { OptionRegistry, OrderedOption } from "../internal/use-option-registry.js";

/** PageDown / PageUp move this many options (APG). */
const PAGE = 10;

export interface MultiSelectKeyboardOptions {
  /** The Root's `disabled` and `loop`. */
  readonly disabled: boolean;
  readonly loop: boolean;
  readonly popover: Pick<PopoverRootValue, "popupRef" | "requestOpen" | "requestClose">;
  readonly options: Pick<OptionRegistry, "registry" | "orderedOptions">;
  readonly active: Pick<ActiveOption, "activeRef" | "setActive" | "pendingEdgeRef">;
  /** The typeahead buffer (a ref of the Root). */
  readonly typeahead: RefObject<TypeaheadBuffer>;
  /** The initial active option of an open: the first selected one, else `fallback` (B.8). */
  readonly selectedEdge: (fallback: "first" | "last") => PendingEdge;
  /** A pick (B.5). */
  readonly toggle: (optionValue: string, event: Event) => void;
}

/** One printable character: a single code point (an astral character counts). */
function isPrintable(key: string): boolean {
  return [...key].length === 1;
}

/** What typeahead matches: each option's `label`, else its text content (B.8). */
function typeaheadTexts(enabled: readonly OrderedOption[]): string[] {
  return enabled.map((option) => optionLabel(option).trim().toLowerCase());
}

/**
 * The keyboard model of `MultiSelect.Trigger` (design/components/multi-select.md B.8), the
 * select-only counterpart of `combobox/combobox-keyboard.ts`. A plain factory, not a hook (it
 * calls none): the Root calls it on every render. DOM focus stays on the Trigger; the options
 * are virtual focus. "Open" is judged against the popup's `:popover-open`.
 */
export function createMultiSelectKeyDown({
  disabled,
  loop,
  popover,
  options,
  active,
  typeahead,
  selectedEdge,
  toggle,
}: MultiSelectKeyboardOptions): (event: KeyboardEvent) => void {
  const { registry, orderedOptions } = options;
  const { activeRef, setActive, pendingEdgeRef } = active;

  const enabledOptions = (): OrderedOption[] =>
    orderedOptions().filter((option) => !option.disabled);

  const activate = (target: OrderedOption | undefined): void => {
    if (target === undefined) return;
    setActive(target.value);
    if (typeof target.element.scrollIntoView === "function") {
      target.element.scrollIntoView({ block: "nearest" });
    }
  };

  const move = (by: number): void => {
    const enabled = enabledOptions();
    if (enabled.length === 0) return;
    const last = enabled.length - 1;
    const index = enabled.findIndex((option) => option.value === activeRef.current);
    let next: number;
    if (Math.abs(by) === 1) {
      if (by === 1) next = index < 0 ? 0 : index >= last ? (loop ? 0 : last) : index + 1;
      else next = index < 0 ? last : index <= 0 ? (loop ? last : 0) : index - 1;
    } else {
      // PageDown / PageUp: clamped, never wrapped.
      const from = index < 0 ? (by > 0 ? -1 : enabled.length) : index;
      next = Math.min(last, Math.max(0, from + by));
    }
    activate(enabled[next]);
  };

  const activeEnabled = (): string | null => {
    const current = activeRef.current;
    if (current === null) return null;
    const entry = registry.get(current);
    return entry !== undefined && !entry.disabled ? current : null;
  };

  const open = (event: Event, edge: PendingEdge): void => {
    pendingEdgeRef.current = edge;
    popover.requestOpen(event, "activate");
  };

  return (event: KeyboardEvent): void => {
    if (disabled || event.ctrlKey || event.metaKey) return;
    if (event.isComposing || event.keyCode === 229) return;
    const isOpen = isPopoverOpen(popover.popupRef.current);
    const key = event.key;
    const buffer = typeahead.current;
    // Space belongs to a live typeahead buffer; otherwise it opens or toggles (B.8).
    const typeaheadKey =
      !event.altKey && isPrintable(key) && (key !== " " || isTypingAhead(buffer));

    if (!isOpen) {
      if (typeaheadKey) {
        event.preventDefault();
        pushTypeahead(buffer, key);
        // The match is taken once the options are there (they mount with the open).
        open(event, (enabled) => {
          const index = findTypeahead(buffer, typeaheadTexts(enabled), -1);
          return index < 0 ? null : enabled[index]!.value;
        });
        return;
      }
      switch (key) {
        case "Enter":
        case " ":
        case "ArrowDown":
          event.preventDefault();
          open(event, selectedEdge("first"));
          return;
        case "ArrowUp":
          event.preventDefault();
          // Alt+ArrowUp closes; with the listbox closed there is nothing to do.
          if (!event.altKey) open(event, selectedEdge("last"));
          return;
        case "Home":
          event.preventDefault();
          open(event, "first");
          return;
        case "End":
          event.preventDefault();
          open(event, "last");
          return;
        default:
          return;
      }
    }

    if (typeaheadKey) {
      event.preventDefault();
      pushTypeahead(buffer, key);
      const enabled = enabledOptions();
      const current = enabled.findIndex((option) => option.value === activeRef.current);
      const index = findTypeahead(buffer, typeaheadTexts(enabled), current);
      if (index >= 0) activate(enabled[index]);
      return;
    }
    switch (key) {
      case "ArrowDown":
        event.preventDefault();
        if (!event.altKey) move(1);
        return;
      case "ArrowUp":
        event.preventDefault();
        // A pick toggles and never closes: Alt+ArrowUp only closes (B.4).
        if (event.altKey) popover.requestClose(event, "activate");
        else move(-1);
        return;
      case "Home":
        event.preventDefault();
        activate(enabledOptions()[0]);
        return;
      case "End":
        event.preventDefault();
        activate(enabledOptions().at(-1));
        return;
      case "PageDown":
        event.preventDefault();
        move(PAGE);
        return;
      case "PageUp":
        event.preventDefault();
        move(-PAGE);
        return;
      case "Enter":
      case " ": {
        event.preventDefault();
        const current = activeEnabled();
        if (current !== null) toggle(current, event);
        return;
      }
      default:
        // Escape is the platform's (the auto popover's close watcher); Tab moves focus on and
        // the leave rule closes the listbox without toggling anything (B.8).
        return;
    }
  };
}

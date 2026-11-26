"use client";
import { flushSync } from "react-dom";
import { isPopoverOpen } from "../internal/overlay/popover-open.js";
import type { RefObject } from "react";
import type { PopoverRootValue } from "../internal/overlay/use-overlay-root.js";
import type { ActiveOption } from "./use-active-option.js";
import type { OptionRegistry } from "./use-option-registry.js";

export interface ComboboxKeyboardOptions {
  /** The Root's `disabled`, `loop` and `allowCustomValue`. */
  readonly disabled: boolean;
  readonly loop: boolean;
  readonly allowCustomValue: boolean;
  readonly popover: Pick<
    PopoverRootValue,
    "popupRef" | "requestOpen" | "requestClose" | "intended" | "committed"
  >;
  readonly options: Pick<OptionRegistry, "registry" | "orderedOptions">;
  readonly active: Pick<ActiveOption, "activeRef" | "setActive" | "pendingEdgeRef">;
  /** Accepts an option (design 5.2). */
  readonly accept: (optionValue: string, event: Event) => void;
  /** Free text as the value (design 5.3). Returns whether it dispatched. */
  readonly commitText: (event: Event, close: boolean) => boolean;
  /** With `multiple` (design 15.6): the keys that differ, and the chips. */
  readonly multiple: ComboboxMultipleKeys | undefined;
}

/** What the Input's keys need from a `multiple` Root (design 15.6, 15.9). */
export interface ComboboxMultipleKeys {
  /** The text (urgent). */
  readonly textRef: RefObject<string>;
  /** At least one value is selected (optimistic): there is a chip. */
  readonly hasChips: () => boolean;
  /** Backspace in the empty input: remove the last chip and announce it. */
  readonly removeLast: (event: Event) => void;
  /** The inline-start arrow at the caret's start: focus the last chip. `false`: none mounted. */
  readonly focusLastChip: () => boolean;
  /** `allowCustomValue`: add the text as a value (or nothing if it is one) and clear it. */
  readonly addText: (event: Event) => void;
  /** Clear unmatched text (`"dismiss"`). */
  readonly clearText: (event: Event) => void;
}

/** The caret is at the start of the input with nothing selected. */
function caretAtStart(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLInputElement)) return false;
  return target.selectionStart === 0 && target.selectionEnd === 0;
}

/** ArrowLeft, or ArrowRight when the input's computed direction is `rtl` (design 15.6). */
function isInlineStartArrow(event: KeyboardEvent): boolean {
  const target = event.target;
  const rtl =
    target instanceof Element &&
    target.ownerDocument.defaultView?.getComputedStyle(target).direction === "rtl";
  return event.key === (rtl ? "ArrowRight" : "ArrowLeft");
}

/**
 * The keyboard model of the Combobox Input (design/components/combobox.md 8), the counterpart of
 * `menu/use-menu-keyboard.ts`. A plain factory, not a hook (it calls none): the Root calls it on
 * every render. Returns the Input's `keydown` handler, which tells whether it handled the key.
 */
export function createComboboxKeyDown({
  disabled,
  loop,
  allowCustomValue,
  popover,
  options,
  active,
  accept,
  commitText,
  multiple,
}: ComboboxKeyboardOptions): (event: KeyboardEvent) => boolean {
  const { registry, orderedOptions } = options;
  const { activeRef, setActive, pendingEdgeRef } = active;

  const move = (direction: 1 | -1): void => {
    const enabled = orderedOptions().filter((option) => !option.disabled);
    if (enabled.length === 0) return;
    const last = enabled.length - 1;
    const index = enabled.findIndex((option) => option.value === activeRef.current);
    let next: number;
    if (direction === 1) next = index < 0 ? 0 : index >= last ? (loop ? 0 : last) : index + 1;
    else next = index < 0 ? last : index <= 0 ? (loop ? last : 0) : index - 1;
    const target = enabled[next]!;
    setActive(target.value);
    if (typeof target.element.scrollIntoView === "function") {
      target.element.scrollIntoView({ block: "nearest" });
    }
  };

  const activeEnabled = (): string | null => {
    const current = activeRef.current;
    if (current === null) return null;
    const entry = registry.get(current);
    return entry !== undefined && !entry.disabled ? current : null;
  };

  return (event: KeyboardEvent): boolean => {
    if (disabled || event.ctrlKey || event.metaKey) return false;
    // IME: the key belongs to the composition (Enter commits it, arrows pick a candidate).
    if (event.isComposing || event.keyCode === 229) return false;
    // What the user sees, not what is intended: right after Escape the platform has hidden the
    // popup but its `toggle` (and the fact it reports) is still queued, and an open that
    // is still committing shows nothing yet. Enter must submit and arrows must open in both.
    const isOpen = isPopoverOpen(popover.popupRef.current);
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (event.altKey) {
          if (!isOpen) popover.requestOpen(event, "activate");
        } else if (!isOpen) {
          pendingEdgeRef.current = "first";
          popover.requestOpen(event, "activate");
        } else {
          move(1);
        }
        return true;
      case "ArrowUp":
        event.preventDefault();
        if (event.altKey) {
          if (isOpen && multiple !== undefined) {
            // A pick toggles and does not close: Alt+ArrowUp only closes (design 15.6).
            popover.requestClose(event, "activate");
          } else if (isOpen) {
            const current = activeEnabled();
            if (current !== null) accept(current, event);
            else popover.requestClose(event, "activate");
          }
        } else if (!isOpen) {
          pendingEdgeRef.current = "last";
          popover.requestOpen(event, "activate");
        } else {
          move(-1);
        }
        return true;
      case "Enter": {
        if (multiple !== undefined) {
          if (isOpen) {
            event.preventDefault();
            const current = activeEnabled();
            if (current !== null) accept(current, event);
            else if (allowCustomValue && multiple.textRef.current !== "") multiple.addText(event);
            return true;
          }
          if (multiple.textRef.current === "") return false;
          // An open on its way (requested, not committed yet: a slow `openChangeAction`, or the
          // keystroke's own open still rendering): the user typed a search and is about to
          // pick, so Enter is prevented and the text is kept (design 15.6). Not after Escape:
          // there the committed state is still open until the `toggle` fact runs, and Enter
          // keeps the closed rules below (design 8).
          if (popover.intended() && !popover.committed) {
            event.preventDefault();
            return true;
          }
          if (allowCustomValue) {
            // The user is adding an item, not submitting the form (design 15.9).
            event.preventDefault();
            multiple.addText(event);
            return true;
          }
          // Unmatched text must not reach the submission (`required`, design 15.8): cleared in
          // one flush, then the key's default runs.
          flushSync(() => multiple.clearText(event));
          return false;
        }
        if (isOpen) {
          // An open listbox means the user is choosing: never submit from here.
          event.preventDefault();
          const current = activeEnabled();
          if (current !== null) accept(current, event);
          else if (allowCustomValue && !commitText(event, true)) {
            popover.requestClose(event, "activate");
          }
          return true;
        }
        // Closed: not prevented, so a form still submits. The key's default action (implicit
        // submission) must see the optimistic hidden value: Firefox submits before React's
        // scheduled flush of the optimistic render, so it is flushed here (design 5.3).
        if (allowCustomValue) flushSync(() => commitText(event, false));
        return false;
      }
      case "Backspace":
        // A held Backspace that emptied the text does not go on to eat chips (design 15.6).
        if (
          multiple !== undefined &&
          !event.repeat &&
          !event.altKey &&
          multiple.textRef.current === "" &&
          multiple.hasChips()
        ) {
          multiple.removeLast(event);
          return true;
        }
        return false;
      case "ArrowLeft":
      case "ArrowRight":
        if (
          multiple !== undefined &&
          !event.altKey &&
          !event.shiftKey &&
          isInlineStartArrow(event) &&
          caretAtStart(event.target) &&
          multiple.hasChips() &&
          multiple.focusLastChip()
        ) {
          event.preventDefault();
          if (activeRef.current !== null) setActive(null);
          return true;
        }
        if (activeRef.current !== null) setActive(null);
        return false;
      case "Home":
      case "End":
        // APG: the caret keys move visual focus to the input (not prevented: the caret moves).
        if (activeRef.current !== null) setActive(null);
        return false;
      default:
        return false;
    }
  };
}

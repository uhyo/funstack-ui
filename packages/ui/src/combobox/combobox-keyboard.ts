// The Input's keyboard model (design/components/combobox.md 5), over a small view of the Root.
// No "use client" directive: no hooks (conventions 7.1).
import { flushSync } from "react-dom";

export interface ComboboxKeyTarget {
  readonly disabled: boolean;
  readonly allowCustomValue: boolean;
  readonly loop: boolean;
  /**
   * What the user sees, not what is intended: right after Escape the platform has hidden the
   * popup but its `toggle` (and the library's notification) is still queued, and an open that
   * is still committing shows nothing yet. Enter must submit and arrows must open in both.
   */
  readonly isOpen: boolean;
  /** The active option's value. */
  readonly active: string | null;
  /** The enabled options in document order. */
  readonly enabledOptions: () => readonly { readonly value: string; readonly element: Element }[];
  /** The active option, if it is still enabled. */
  readonly activeEnabled: () => string | null;
  readonly setActive: (value: string | null) => void;
  /** Opens; `edge` (ArrowDown / ArrowUp) is the option to activate once the open has options. */
  readonly open: (event: Event, edge?: "first" | "last") => void;
  readonly close: (event: Event) => void;
  readonly accept: (value: string, event: Event) => void;
  /** Free text as the value (design 5.3). Returns whether it dispatched. */
  readonly commitText: (event: Event, close: boolean) => boolean;
}

/** Moves the active option to the next (`1`) or previous (`-1`) enabled one. */
function move(target: ComboboxKeyTarget, direction: 1 | -1): void {
  const enabled = target.enabledOptions();
  if (enabled.length === 0) return;
  const last = enabled.length - 1;
  const index = enabled.findIndex((option) => option.value === target.active);
  const loop = target.loop;
  let next: number;
  if (direction === 1) next = index < 0 ? 0 : index >= last ? (loop ? 0 : last) : index + 1;
  else next = index < 0 ? last : index <= 0 ? (loop ? last : 0) : index - 1;
  const option = enabled[next]!;
  target.setActive(option.value);
  if (typeof option.element.scrollIntoView === "function") {
    option.element.scrollIntoView({ block: "nearest" });
  }
}

/** The Input's `keydown`. Returns whether the combobox handled the key. */
export function comboboxKeyDown(event: KeyboardEvent, target: ComboboxKeyTarget): boolean {
  if (target.disabled || event.ctrlKey || event.metaKey) return false;
  // IME: the key belongs to the composition (Enter commits it, arrows pick a candidate).
  if (event.isComposing || event.keyCode === 229) return false;
  const isOpen = target.isOpen;
  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      if (event.altKey) {
        if (!isOpen) target.open(event);
      } else if (!isOpen) {
        target.open(event, "first");
      } else {
        move(target, 1);
      }
      return true;
    case "ArrowUp":
      event.preventDefault();
      if (event.altKey) {
        if (isOpen) {
          const active = target.activeEnabled();
          if (active !== null) target.accept(active, event);
          else target.close(event);
        }
      } else if (!isOpen) {
        target.open(event, "last");
      } else {
        move(target, -1);
      }
      return true;
    case "Enter": {
      if (isOpen) {
        // An open listbox means the user is choosing: never submit from here.
        event.preventDefault();
        const active = target.activeEnabled();
        if (active !== null) target.accept(active, event);
        else if (target.allowCustomValue && !target.commitText(event, true)) target.close(event);
        return true;
      }
      // Closed: not prevented, so a form still submits. The key's default action (implicit
      // submission) must see the optimistic hidden value: Firefox submits before React's
      // scheduled flush of the optimistic render, so it is flushed here (design 5.3).
      if (target.allowCustomValue) flushSync(() => target.commitText(event, false));
      return false;
    }
    case "Home":
    case "End":
    case "ArrowLeft":
    case "ArrowRight":
      // APG: the caret keys move visual focus to the input (not prevented: the caret moves).
      if (target.active !== null) target.setActive(null);
      return false;
    default:
      return false;
  }
}

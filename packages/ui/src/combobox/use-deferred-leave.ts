"use client";
import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { useLatest } from "../internal/use-latest.js";

export interface DeferredLeaveOptions {
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly popupRef: RefObject<HTMLElement | null>;
  /**
   * `Combobox.Chips` (`multiple`, design 15.6): a third region inside the combobox. Focus moving
   * between the input and a chip is not focus leaving.
   */
  readonly chipsRef: RefObject<HTMLElement | null>;
  /** Focus has left the input, the popup and the chips (design 5.4, 15.6). */
  readonly leave: (event: Event) => void;
}

export interface DeferredLeave {
  readonly focusIn: (event: FocusEvent) => void;
  readonly focusOut: (event: FocusEvent) => void;
}

/**
 * The Combobox Input's focus-leave decision (design 5.4), for `Combobox.Root`. A press blurs the
 * input at `mousedown`, but its outcome is known only at the `click`, which runs in the
 * `pointerup` task: a `<label for>` (Combobox.Label, Field.Label) refocuses the input there.
 * While the input is focused (and until a leave deferred to a release has been decided), the
 * presses on its document are tracked; a leave check made while one is down waits for the last
 * release. A window blur forgets the presses (a release it swallowed would otherwise hold the
 * check back), and so does focus arriving in the input.
 *
 * Returns the `focus` and `blur` handlers of the Input and of `Chips`: `focusIn` starts the
 * tracking, `focusOut` calls `leave` at once when focus moved to an element outside the input,
 * the popup and the chips, and
 * decides one task after the press is released (or one task later) when it moved nowhere.
 */
export function useDeferredLeave({
  inputRef,
  popupRef,
  chipsRef,
  leave,
}: DeferredLeaveOptions): DeferredLeave {
  const leaveRef = useLatest(leave);
  const inside = (node: Node | null): boolean => {
    if (node === null) return false;
    if (node === inputRef.current) return true;
    const popup = popupRef.current;
    if (popup !== null && popup.contains(node)) return true;
    const chips = chipsRef.current;
    return chips !== null && chips.contains(node);
  };

  const presses = useRef(new Set<number>());
  const afterPress = useRef<(() => void) | null>(null);
  const unwatchPresses = useRef<(() => void) | null>(null);
  const unwatch = (): void => {
    unwatchPresses.current?.();
    unwatchPresses.current = null;
    presses.current.clear();
    afterPress.current = null;
  };
  const watchPresses = (element: HTMLElement): void => {
    presses.current.clear();
    if (unwatchPresses.current !== null) return;
    const doc = element.ownerDocument;
    const win = doc.defaultView;
    const released = (): void => {
      const check = afterPress.current;
      if (check === null || presses.current.size > 0) return;
      unwatch();
      setTimeout(check, 0);
    };
    const down = (event: PointerEvent): void => {
      presses.current.add(event.pointerId);
    };
    const up = (event: PointerEvent): void => {
      presses.current.delete(event.pointerId);
      released();
    };
    const blur = (): void => {
      presses.current.clear();
      released();
    };
    doc.addEventListener("pointerdown", down, true);
    doc.addEventListener("pointerup", up, true);
    doc.addEventListener("pointercancel", up, true);
    win?.addEventListener("blur", blur);
    unwatchPresses.current = () => {
      doc.removeEventListener("pointerdown", down, true);
      doc.removeEventListener("pointerup", up, true);
      doc.removeEventListener("pointercancel", up, true);
      win?.removeEventListener("blur", blur);
    };
  };
  useEffect(() => {
    // Focused before the Root mounted (autofocus, typing before hydration): no `focus` follows.
    const input = inputRef.current;
    if (input !== null && input.ownerDocument.activeElement === input) watchPresses(input);
    return unwatch;
    // `inputRef` is the Root's own ref object: the effect runs once, at mount.
  }, [inputRef]);

  const focusIn = (event: FocusEvent): void => {
    watchPresses(event.currentTarget as HTMLElement);
  };

  const focusOut = (event: FocusEvent): void => {
    const input = inputRef.current;
    const next = event.relatedTarget;
    if (next instanceof Node) {
      if (inside(next)) return;
      unwatch();
      leave(event);
      return;
    }
    // No related target: the window lost focus (nothing to do), or a press landed on something
    // that takes no focus (a label, the page itself: focus moved to <body>). Decide one task
    // after the press is released (its click has run then), or one task later without a press.
    if (input === null) {
      unwatch();
      return;
    }
    const doc = input.ownerDocument;
    const check = () => {
      if (!doc.hasFocus()) return;
      if (inside(doc.activeElement)) return;
      if (input.isConnected) leaveRef.current(event);
    };
    if (presses.current.size > 0) {
      afterPress.current = check;
    } else {
      unwatch();
      setTimeout(check, 0);
    }
  };

  return { focusIn, focusOut };
}

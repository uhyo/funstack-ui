"use client";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { PopoverRootValue } from "../internal/use-overlay-root.js";
import type { OptionRegistry } from "./use-option-registry.js";

export interface ActiveOptionOptions {
  readonly popover: Pick<PopoverRootValue, "committed" | "intended">;
  readonly orderedOptions: OptionRegistry["orderedOptions"];
  /** The Root's `autoHighlight`. */
  readonly autoHighlight: boolean;
  /** The results shown are for an older text: never auto-highlighted. */
  readonly stale: boolean;
}

export interface ActiveOption {
  /** The value of the option `aria-activedescendant` points at, or `null` (urgent state). */
  readonly activeValue: string | null;
  /** The same, for handlers: written together with the state. */
  readonly activeRef: RefObject<string | null>;
  readonly setActive: (next: string | null) => void;
  /** The edge to activate once the open has options (ArrowDown / ArrowUp while closed). */
  readonly pendingEdgeRef: RefObject<"first" | "last" | null>;
  /**
   * `autoHighlight` (APG automatic selection) highlights once per open and once per edit, when
   * the results for it settle. Home / End / Left / Right clear the active option without
   * re-arming it, so the caret keys really return visual focus to the input.
   */
  readonly autoArmedRef: RefObject<boolean>;
}

/**
 * The active option of a combobox (design/components/combobox.md 2 and 6.5): urgent virtual
 * focus, revalidated against the mounted options in a layout effect after every commit.
 */
export function useActiveOption({
  popover,
  orderedOptions,
  autoHighlight,
  stale,
}: ActiveOptionOptions): ActiveOption {
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const setActive = useCallback((next: string | null) => {
    activeRef.current = next;
    setActiveValue(next);
  }, []);
  const pendingEdgeRef = useRef<"first" | "last" | null>(null);
  const autoArmedRef = useRef(true);

  // Revalidation (design 6.5): urgent, in a layout effect after every commit; never dispatches.
  useLayoutEffect(() => {
    const current = activeRef.current;
    if (!popover.committed) {
      // Keep the edge of an open that is on its way (the optimistic commit comes first).
      if (!popover.intended()) pendingEdgeRef.current = null;
      autoArmedRef.current = true;
      if (current !== null) setActive(null);
      return;
    }
    const enabled = orderedOptions().filter((option) => !option.disabled);
    let next = current;
    if (pendingEdgeRef.current !== null && enabled.length > 0) {
      next = (pendingEdgeRef.current === "first" ? enabled[0] : enabled.at(-1))!.value;
      pendingEdgeRef.current = null;
    } else if (next !== null && !enabled.some((option) => option.value === next)) {
      next = null;
    }
    if (next !== null) {
      // Something is active (keys, hover): nothing to highlight for these results.
      autoArmedRef.current = false;
    } else if (autoHighlight && autoArmedRef.current && !stale && enabled.length > 0) {
      // Only settled results: a stale list's first option is never auto-highlighted, so a fast
      // Enter commits the typed text or does nothing (design 6.5).
      next = enabled[0]!.value;
      autoArmedRef.current = false;
    }
    if (next !== current) setActive(next);
  });

  return { activeValue, activeRef, setActive, pendingEdgeRef, autoArmedRef };
}

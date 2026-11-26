"use client";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { OptionRegistry, OrderedOption } from "./use-option-registry.js";

/**
 * Where the active option goes once an open has options: the first or last enabled one
 * (ArrowDown / ArrowUp while closed), or what a resolver picks from the enabled options in
 * document order (MultiSelect: the first selected one, a typeahead match; `null`: none).
 */
export type PendingEdge = "first" | "last" | ((enabled: readonly OrderedOption[]) => string | null);

export interface ActiveOptionOptions {
  /** The Root's popover (`PopoverRootValue`): its committed open state and the intent. */
  readonly popover: { readonly committed: boolean; readonly intended: () => boolean };
  readonly orderedOptions: OptionRegistry["orderedOptions"];
  /** The Root's `autoHighlight`. */
  readonly autoHighlight: boolean;
  /** The results shown are for an older text: never auto-highlighted. */
  readonly stale: boolean;
  /**
   * The List is loading (a `Status` is mounted inside it): the pending edge waits until it
   * settles (MultiSelect, multi-select.md B.8). Default `false`: the edge is taken as soon as an
   * enabled option is mounted (Combobox).
   */
  readonly loading?: boolean;
}

export interface ActiveOption {
  /** The value of the option `aria-activedescendant` points at, or `null` (urgent state). */
  readonly activeValue: string | null;
  /** The same, for handlers: written together with the state. */
  readonly activeRef: RefObject<string | null>;
  readonly setActive: (next: string | null) => void;
  /** The edge to activate once the open has options (ArrowDown / ArrowUp while closed). */
  readonly pendingEdgeRef: RefObject<PendingEdge | null>;
  /**
   * `autoHighlight` (APG automatic selection) highlights once per open and once per edit, when
   * the results for it settle. Home / End / Left / Right clear the active option without
   * re-arming it, so the caret keys really return visual focus to the input.
   */
  readonly autoArmedRef: RefObject<boolean>;
}

/**
 * The active option of a listbox with virtual focus, Combobox or MultiSelect
 * (design/components/combobox.md 2 and 6.5; multi-select.md B.8): urgent virtual focus,
 * revalidated against the mounted options in a layout effect after every commit.
 */
export function useActiveOption({
  popover,
  orderedOptions,
  autoHighlight,
  stale,
  loading = false,
}: ActiveOptionOptions): ActiveOption {
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const setActive = useCallback((next: string | null) => {
    activeRef.current = next;
    setActiveValue(next);
  }, []);
  const pendingEdgeRef = useRef<PendingEdge | null>(null);
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
    const edge = pendingEdgeRef.current;
    if (edge !== null && enabled.length > 0 && !loading) {
      next =
        typeof edge === "function"
          ? edge(enabled)
          : (edge === "first" ? enabled[0] : enabled.at(-1))!.value;
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

"use client";
import { useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { arraysEqual, firstDuplicate, sortByOrder } from "./value-set.js";
import type { ValueSet } from "./value-set.js";

/** What a multi-value group reads from its Items' DOM: at least their values in document order. */
export interface ItemLayout {
  readonly order: readonly string[];
}

export interface UseItemOrderOptions<L extends ItemLayout> {
  /** The optimistic set the state's `value` is built from. */
  readonly optimistic: ValueSet;
  /** Before the first read (the server render and the first client render). */
  readonly initial: L;
  /** Reads the Items' layout from the DOM (layout phase). */
  readonly read: () => L;
  /** Something else that renders from the layout changed (default: nothing else does). */
  readonly changed?: ((prev: L, next: L) => boolean) | undefined;
  /**
   * Dev only, once: two Items share a value. Pass `isDev && ((value) => ...)` with the calling
   * module's own `isDev`, so the text folds away in production.
   */
  readonly duplicateMessage: false | ((value: string) => string);
}

export interface ItemOrder<L extends ItemLayout> {
  /** The layout as of the Root's last commit. */
  readonly layout: L;
  /** `optimistic` in the Items' document order (values with no Item last): the state's `value`. */
  readonly renderedValue: string[];
}

/**
 * The Items' document order, kept in state for the Root state's `value` (CheckboxGroup,
 * ToggleGroup). Render cannot read the DOM, so the order is refreshed after a commit of the Root,
 * only when what renders from it would change (a value given out of document order, Items
 * reordered or added). The first render, and the server, use the value's own order.
 *
 * A deps-less layout effect runs only when the Root itself committed: Items moved by a child that
 * re-renders alone are picked up at the Root's next render. The comparison ends the chain: the
 * re-render it causes renders exactly the value just compared against.
 */
export function useItemOrder<L extends ItemLayout>(options: UseItemOrderOptions<L>): ItemOrder<L> {
  const { optimistic, initial } = options;
  const [layout, setLayout] = useState<L>(initial);
  const renderedValue = sortByOrder(optimistic, layout.order);
  const warnedDuplicate = useRef(false);
  const sync = useEffectEvent(() => {
    const next = options.read();
    const valueChanged = !arraysEqual(sortByOrder(optimistic, next.order), renderedValue);
    if (valueChanged || options.changed?.(layout, next) === true) setLayout(next);

    const { duplicateMessage } = options;
    if (duplicateMessage === false || warnedDuplicate.current) return;
    const duplicate = firstDuplicate(next.order);
    if (duplicate !== undefined) {
      warnedDuplicate.current = true;
      console.error(duplicateMessage(duplicate));
    }
  });
  useLayoutEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- a DOM read render cannot do
    sync();
  });
  return { layout, renderedValue };
}

"use client";
import { useStepButtonElement } from "./number-field-increment.js";
import type { NumberFieldDecrementProps } from "./number-field-increment.js";

export type { NumberFieldDecrementProps } from "./number-field-increment.js";

/**
 * Steps the value down: `button[type=button][tabindex=-1]` with `aria-controls` → the input and
 * the default `aria-label` `"Decrease"`; one step at the press, then repeated while held, one
 * commit at the release. Natively `disabled` when the next step would change nothing.
 *
 * Owned keys: `type`, `tabIndex`, `aria-controls`, `disabled`, `onPointerDown`, `onClick`,
 * `onContextMenu`, `data-pending`, `data-disabled`.
 */
export function NumberFieldDecrement(props: NumberFieldDecrementProps) {
  return useStepButtonElement("decrement", "NumberField.Decrement", props);
}

NumberFieldDecrement.displayName = "NumberFieldDecrement";

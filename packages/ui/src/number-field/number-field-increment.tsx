"use client";
import { useStepButtonElement } from "./use-step-button.js";
import type { NumberFieldIncrementProps } from "./use-step-button.js";

export type {
  NumberFieldButtonState,
  NumberFieldIncrementProps,
  NumberFieldDecrementProps,
} from "./use-step-button.js";

/**
 * Steps the value up: `button[type=button][tabindex=-1]` with `aria-controls` → the input and the
 * default `aria-label` `"Increase"`; one step at the press, then repeated while held, one commit
 * at the release. Natively `disabled` when the next step would change nothing (`aria-disabled`
 * with a link or component `render`).
 *
 * Owned keys: `type`, `tabIndex`, `aria-controls`, `disabled`, `aria-disabled` (link or component
 * `render`), `onPointerDown`, `onClick`, `onContextMenu`, `data-pending`, `data-disabled`.
 */
export function NumberFieldIncrement(props: NumberFieldIncrementProps) {
  return useStepButtonElement("increment", "NumberField.Increment", props);
}

NumberFieldIncrement.displayName = "NumberFieldIncrement";

"use client";
import type { ChangeEvent, ComponentPropsWithRef } from "react";
import { dataAttr } from "./data-attr.js";
import type { DataAttributes } from "./render-element.js";
import { guardCheckableChange } from "./use-native-checked.js";

export interface GroupMemberPropsOptions {
  readonly type: "radio" | "checkbox";
  /** Dispatch-guard name (`"RadioGroup.Item"`). */
  readonly component: string;
  /** The group's shared `name` and `form`. */
  readonly name: string;
  readonly form: string | undefined;
  readonly value: string;
  readonly required: boolean;
  /** Optimistic. */
  readonly checked: boolean;
  readonly pending: boolean;
  /** Own `disabled` prop or the Root's: `data-disabled` and the click guard. */
  readonly effectiveDisabled: boolean;
  /** The member's own `disabled` prop only: the Root's reaches it through `<fieldset disabled>`. */
  readonly ownDisabled: boolean;
  /** CheckboxGroup inside a Field: the group's `aria-invalid` (the fieldset cannot carry it). */
  readonly invalid?: "true" | "false" | undefined;
  /** The user checked (radio) or toggled (checkbox) the input. */
  readonly activate: (event: Event) => void;
}

/**
 * The owned layer (conventions 1.2) of a group Item's `<input>`: `type`, the group's `name` /
 * `form`, `value`, `checked` (the optimistic state), `defaultChecked` (never rendered), a
 * checkbox's `aria-checked` (removed), `disabled`, `required`, the state `data-*` attributes,
 * and the guarded `onChange`.
 */
export function groupMemberProps(
  options: GroupMemberPropsOptions,
): Partial<ComponentPropsWithRef<"input">> & DataAttributes {
  const { type, component, checked, pending, effectiveDisabled, invalid, activate } = options;
  return {
    type,
    name: options.name,
    value: options.value,
    checked,
    defaultChecked: undefined,
    ...(type === "checkbox" && { "aria-checked": undefined }),
    // Owned (Switch precedent) so that native disabledness, `data-disabled` and the click guard
    // agree. Only the Item's own prop: `Root disabled` reaches the input through the fieldset.
    disabled: options.ownDisabled,
    form: options.form,
    required: options.required,
    "data-checked": dataAttr(checked),
    "data-pending": dataAttr(pending),
    "data-disabled": dataAttr(effectiveDisabled),
    ...(invalid !== undefined && { "aria-invalid": invalid }),
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      // A natively disabled input fires no click; this covers `render` elements that do not
      // honour `disabled`.
      if (effectiveDisabled) return;
      const nativeEvent = event.nativeEvent;
      guardCheckableChange(nativeEvent, () => activate(nativeEvent), component);
    },
  };
}

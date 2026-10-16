"use client";
import { ViewTransition } from "react";
import type { ChangeEvent, ComponentPropsWithRef, CSSProperties, ViewTransitionClass } from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { guardCheckableChange, useNativeChecked } from "../internal/use-native-checked.js";
import { useRender } from "../internal/use-render.js";
import { useRadioGroupContext } from "./radio-group-context.js";

export interface RadioGroupItemState {
  readonly value: string;
  /** Optimistic: true as soon as the user checks this radio, before the action settles. */
  readonly checked: boolean;
  /** The Root is pending and this radio is the optimistic target. */
  readonly pending: boolean;
  /** Disabled by its own prop or by `Root disabled`. */
  readonly disabled: boolean;
}

export interface RadioGroupItemProps extends Omit<
  ComponentPropsWithRef<"input">,
  | "type"
  | "name"
  | "value"
  | "checked"
  | "defaultChecked"
  | "defaultValue"
  | "form"
  | "required"
  | "onChange"
  | "className"
  | "style"
  | "children"
> {
  /** The value this radio checks. Must be unique within the Root. Submitted as the form value. */
  value: string;
  /** Native `disabled`: unfocusable, skipped by arrow keys, never dispatches. */
  disabled?: boolean;
  /**
   * Forwarded to the Item's `<ViewTransition default>`. Default `"none"`. Fires only on the commit
   * that settles the action (or rolls it back), never on the optimistic check; animate the check
   * itself with CSS on `:checked`.
   */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, RadioGroupItemState>;
  style?: StateValue<CSSProperties | undefined, RadioGroupItemState>;
  /** Replace the rendered element. Must keep an `<input>`; the library sets `type="radio"`. */
  render?: RenderProp<ComponentPropsWithRef<"input">, RadioGroupItemState>;
}

/**
 * One `<input type="radio">` of the group. Its DOM `checked` is the optimistic value
 * (`checked={optimistic === value}`): react-dom restores a controlled input to its props after
 * every event, and only the sync-lane optimistic value survives that restore.
 *
 * Owned keys (conventions 1.2): `type`, `name`, `value`, `checked`, `defaultChecked` (never
 * rendered), `form`, `required`, `data-checked`, `data-pending`, `data-disabled`, `onChange`.
 */
export function RadioGroupItem({
  value,
  disabled: disabledProp = false,
  transition,
  className,
  style,
  render,
  ...rest
}: RadioGroupItemProps) {
  const ctx = useRadioGroupContext("RadioGroup.Item");
  const checked = ctx.optimistic === value;
  const pending = ctx.pending && checked;
  const disabled = ctx.disabled || disabledProp;

  // Group mode: element check and re-apply only; the Root reports the residual paths once.
  const inputRef = useNativeChecked({
    type: "radio",
    component: "RadioGroup.Item",
    checked,
    group: true,
    defaultChecked: ctx.defaultValue === undefined ? undefined : ctx.defaultValue === value,
  });

  const state: RadioGroupItemState = { value, checked, pending, disabled };

  const element = useRender<ComponentPropsWithRef<"input">, RadioGroupItemState>({
    defaultElement: "input",
    render,
    state,
    className,
    style,
    children: undefined,
    ref: inputRef,
    // Pass-through layer: a `render` element's own props win over these. `Root disabled` reaches
    // the radio through the fieldset, so only the Item's own prop is rendered.
    props: { ...rest, disabled: disabledProp },
    libraryProps: {
      type: "radio",
      name: ctx.name,
      value,
      checked,
      defaultChecked: undefined,
      form: ctx.form,
      required: ctx.required,
      "data-checked": dataAttr(checked),
      "data-pending": dataAttr(pending),
      "data-disabled": dataAttr(disabled),
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        // A natively disabled radio fires no click; this covers `render` elements that do not
        // honour `disabled`.
        if (disabled) return;
        const nativeEvent = event.nativeEvent;
        guardCheckableChange(nativeEvent, () => ctx.select(value, nativeEvent), "RadioGroup.Item");
      },
    },
  });

  return <ViewTransition default={transition ?? "none"}>{element}</ViewTransition>;
}

RadioGroupItem.displayName = "RadioGroupItem";

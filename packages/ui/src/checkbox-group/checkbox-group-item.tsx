"use client";
import { useLayoutEffect } from "react";
import type { ChangeEvent, ComponentPropsWithRef, CSSProperties, ViewTransitionClass } from "react";
import { useTransitionBoundary } from "../internal/transition-boundary.js";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { guardCheckableChange, useNativeChecked } from "../internal/use-native-checked.js";
import { useRender } from "../internal/use-render.js";
import { useCheckboxGroupContext } from "./checkbox-group-context.js";
import { syncPresence } from "../internal/sync-presence.js";

export interface CheckboxGroupItemState {
  readonly value: string;
  /** Optimistic: true as soon as the user checks this box, before the action settles. */
  readonly checked: boolean;
  /** The Root is pending and this box's optimistic state differs from its committed state. */
  readonly pending: boolean;
  /** Disabled by its own prop or by `Root disabled`. */
  readonly disabled: boolean;
}

export interface CheckboxGroupItemProps extends Omit<
  ComponentPropsWithRef<"input">,
  | "type"
  | "name"
  | "value"
  | "checked"
  | "defaultChecked"
  | "defaultValue"
  | "form"
  | "required"
  | "aria-checked"
  | "onChange"
  | "className"
  | "style"
  | "children"
> {
  /** The value this box contributes when checked. Must be unique within the Root. */
  value: string;
  /**
   * Native `disabled`: unfocusable, never dispatches, barred from constraint validation. A
   * `Parent` leaves a disabled Item's value alone and derives its state without it; a checked
   * disabled Item does not satisfy the group's `required`.
   */
  disabled?: boolean;
  /**
   * Forwarded to the Item's `<ViewTransition default>`. Default: no boundary. Fires only on the
   * commit that settles the action (or rolls it back), never on the optimistic check; animate the
   * check itself with CSS on `:checked`.
   *
   * Static (conventions 5.1): setting or unsetting it remounts the element, and any value, `"none"`
   * included, makes a mount inside a transition start a document view transition.
   */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, CheckboxGroupItemState>;
  style?: StateValue<CSSProperties | undefined, CheckboxGroupItemState>;
  /** Replace the rendered element. Must keep an `<input>`; the library sets `type="checkbox"`. */
  render?: RenderProp<ComponentPropsWithRef<"input">, CheckboxGroupItemState>;
}

/**
 * One `<input type="checkbox">` of the group, checked while its `value` is in the group's set.
 * Its DOM `checked` is the optimistic state (`checked={optimistic.has(value)}`): react-dom
 * restores a controlled input to its props after every event, and only the sync-lane optimistic
 * value survives that restore.
 *
 * Owned keys (conventions 1.2; a `render` element's value is overridden): `type`, `name`,
 * `value`, `checked`, `defaultChecked` (never rendered), `disabled`, `form`, `required`
 * (computed by the Root from its `required` prop), `aria-checked` (removed), `data-checked`,
 * `data-pending`, `data-disabled`; inside a `Field.Root` also `aria-invalid` (the Field's).
 * `onChange` is merged: a `render` element's own handler runs
 * first, then the library's. `role` passes through.
 */
export function CheckboxGroupItem({
  value,
  disabled: disabledProp = false,
  transition,
  className,
  style,
  render,
  ...rest
}: CheckboxGroupItemProps) {
  const ctx = useCheckboxGroupContext("CheckboxGroup.Item");
  const checked = ctx.optimistic.has(value);
  const pending = ctx.pending && checked !== ctx.committed.has(value);
  const disabled = ctx.disabled || disabledProp;
  const required = ctx.required;

  // The Root needs every Item's own `disabled` for the Parents and `required` (design 6.2, 7).
  const { registerItem } = ctx;
  useLayoutEffect(() => registerItem(value, disabledProp), [registerItem, value, disabledProp]);

  // Group mode: element check and re-apply only; the Root reports the residual paths once.
  const inputRef = useNativeChecked({
    type: "checkbox",
    component: "CheckboxGroup.Item",
    checked,
    group: true,
    onItemMounted: (el) => {
      // Hydration keeps server attributes that differ from the client render (React only warns).
      // An Item hydrating after its Root can render a different state than the server did (a
      // click on an already hydrated box), and stale attributes would stay until the next change.
      if (el !== null) {
        syncPresence(el, "data-checked", checked);
        syncPresence(el, "data-pending", pending);
        syncPresence(el, "data-disabled", disabled);
        syncPresence(el, "required", required);
      }
      ctx.onItemMounted(el);
    },
    defaultChecked: ctx.defaultValue === undefined ? undefined : ctx.defaultValue.has(value),
  });

  const state: CheckboxGroupItemState = { value, checked, pending, disabled };

  const element = useRender<ComponentPropsWithRef<"input">, CheckboxGroupItemState>({
    defaultElement: "input",
    render,
    state,
    className,
    style,
    children: undefined,
    ref: inputRef,
    // Pass-through layer: a `render` element's own props win over these.
    props: rest,
    libraryProps: {
      type: "checkbox",
      name: ctx.name,
      value,
      checked,
      defaultChecked: undefined,
      "aria-checked": undefined,
      // Owned (Switch precedent) so that native disabledness, `data-disabled` and the click guard
      // agree. Only the Item's own prop: `Root disabled` reaches the box through the fieldset.
      disabled: disabledProp,
      form: ctx.form,
      required,
      "data-checked": dataAttr(checked),
      "data-pending": dataAttr(pending),
      "data-disabled": dataAttr(disabled),
      // Inside a Field (owned there): the group's invalid state, since the fieldset cannot carry it.
      ...(ctx.fieldInvalid === undefined ? {} : { "aria-invalid": ctx.fieldInvalid }),
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        // A natively disabled box fires no click; this covers `render` elements that do not
        // honour `disabled`.
        if (disabled) return;
        const nativeEvent = event.nativeEvent;
        guardCheckableChange(
          nativeEvent,
          () => ctx.toggle(value, !checked, nativeEvent),
          "CheckboxGroup.Item",
        );
      },
    },
  });

  return useTransitionBoundary("CheckboxGroup.Item", transition, element);
}

CheckboxGroupItem.displayName = "CheckboxGroupItem";

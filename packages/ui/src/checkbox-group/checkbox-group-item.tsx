"use client";
import { useLayoutEffect } from "react";
import type { ComponentPropsWithRef, CSSProperties } from "react";
import { groupMemberProps } from "../internal/form/group-member.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useNativeChecked } from "../internal/form/use-native-checked.js";
import { useRender } from "../internal/use-render.js";
import { useCheckboxGroupContext } from "./checkbox-group-context.js";
import { syncPresences } from "../internal/form/sync-presence.js";

/**
 * State of `CheckboxGroup.Item`, passed to the function forms of `className`, `style` and `render`.
 */
export interface CheckboxGroupItemState {
  /** The Item's `value` prop. */
  readonly value: string;
  /** Optimistic: true as soon as the user checks this box, before the action settles. */
  readonly checked: boolean;
  /** The Root is pending and this box's optimistic state differs from its committed state. */
  readonly pending: boolean;
  /** Disabled by its own prop or by `Root disabled`. */
  readonly disabled: boolean;
}

/**
 * Props of `CheckboxGroup.Item`.
 *
 * @see https://ui.funstack.work/components/checkbox-group
 */
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
  | "readOnly"
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
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, CheckboxGroupItemState>;
  /** Inline style, or a function of the part's state that returns one. */
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
 *
 * @see https://ui.funstack.work/components/checkbox-group
 */
export function CheckboxGroupItem({
  value,
  disabled: disabledProp = false,
  className,
  style,
  render,
  ...rest
}: CheckboxGroupItemProps) {
  const ctx = useCheckboxGroupContext("CheckboxGroup.Item");
  const checked = ctx.optimistic.has(value);
  const pending = ctx.state.pending && checked !== ctx.committed.has(value);
  const disabled = ctx.state.disabled || disabledProp;
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
        syncPresences(el, {
          "data-checked": checked,
          "data-pending": pending,
          "data-disabled": disabled,
          required,
        });
      }
      ctx.onItemMounted(el);
    },
    defaultChecked: ctx.defaultValue === undefined ? undefined : ctx.defaultValue.has(value),
  });

  const state: CheckboxGroupItemState = { value, checked, pending, disabled };

  return useRender<ComponentPropsWithRef<"input">, CheckboxGroupItemState>({
    defaultElement: "input",
    render,
    state,
    className,
    style,
    children: undefined,
    ref: inputRef,
    // Pass-through layer: a `render` element's own props win over these.
    props: rest,
    libraryProps: groupMemberProps({
      type: "checkbox",
      component: "CheckboxGroup.Item",
      name: ctx.name,
      form: ctx.form,
      value,
      required,
      checked,
      pending,
      effectiveDisabled: disabled,
      ownDisabled: disabledProp,
      // Inside a Field (owned there): the group's invalid state, since the fieldset cannot carry it.
      invalid: ctx.fieldInvalid,
      activate: (event) => ctx.toggle(value, !checked, event),
    }),
  });
}

CheckboxGroupItem.displayName = "CheckboxGroupItem";

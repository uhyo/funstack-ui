"use client";
import type { ComponentPropsWithRef, CSSProperties, ViewTransitionClass } from "react";
import { groupMemberProps } from "../internal/group-member.js";
import { useTransitionBoundary } from "../internal/transition-boundary.js";
import { syncPresences } from "../internal/sync-presence.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useNativeChecked } from "../internal/use-native-checked.js";
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
   * Forwarded to the Item's `<ViewTransition default>`. Default: no boundary. Fires only on the commit
   * that settles the action (or rolls it back), never on the optimistic check; animate the check
   * itself with CSS on `:checked`.
   *
   * Static: setting or unsetting it remounts the element. Any value, `"none"` included, makes a
   * mount or `<Activity>` reveal inside a transition start a document view transition (a ~250 ms
   * page cross-fade that the next transition waits for).
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
 * Owned keys (conventions 1.2; a `render` element's value is overridden): `type`, `name`,
 * `value`, `checked`, `defaultChecked` (never rendered), `disabled`, `form`, `required`,
 * `data-checked`, `data-pending`, `data-disabled`. `onChange` is merged: a `render` element's own
 * handler runs first, then the library's.
 *
 * Form reset in controlled mode: React sets an input's `defaultChecked` once, from its initial
 * `checked`. An Item added on the client while the Root's `value` equals its value gets
 * `defaultChecked` too, so two radios may carry it and a reset does not necessarily return to
 * the group's mount-time value (see `RadioGroup.Root` `value`).
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
  const checked = ctx.state.value === value;
  const pending = ctx.state.pending && checked;
  const disabled = ctx.state.disabled || disabledProp;

  // Group mode: element check and re-apply only; the Root reports the residual paths once. The
  // hook calls `onItemMounted` at mount so that an Item mounting after its Root (a Suspense
  // boundary that hydrates later) still gets the group reconciled.
  const inputRef = useNativeChecked({
    type: "radio",
    component: "RadioGroup.Item",
    checked,
    group: true,
    onItemMounted: (el) => {
      // Hydration keeps server attributes that differ from the client render (React only warns).
      // An Item hydrating after its Root (partial hydration, Root JSDoc) can render a different
      // `checked` than the server did, e.g. after a click on an already hydrated radio, and a
      // stale `data-checked` would then stay until the prop changes again.
      if (el !== null) {
        syncPresences(el, {
          "data-checked": checked,
          "data-pending": pending,
          "data-disabled": disabled,
        });
      }
      ctx.onItemMounted(el);
    },
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
    // Pass-through layer: a `render` element's own props win over these.
    props: rest,
    libraryProps: groupMemberProps({
      type: "radio",
      component: "RadioGroup.Item",
      name: ctx.name,
      form: ctx.form,
      value,
      required: ctx.required,
      checked,
      pending,
      disabled,
      ownDisabled: disabledProp,
      activate: (event) => ctx.select(value, event),
    }),
  });

  return useTransitionBoundary("RadioGroup.Item", transition, element);
}

RadioGroupItem.displayName = "RadioGroupItem";

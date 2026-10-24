"use client";
import type { ChangeEvent, ComponentPropsWithRef, Ref } from "react";
import { createActionDetails } from "./action-details.js";
import { dataAttr } from "./data-attr.js";
import type { DataAttributes } from "./render-element.js";
import type { ActionDetails, ChangeAction, ChangeReason } from "./types.js";
import { useControllableAction } from "./use-controllable-action.js";
import { fieldInputProps, useFieldControl, useFieldValueChange } from "./use-field-control.js";
import { useMergedRefs } from "./use-merged-refs.js";
import { guardCheckableChange, useNativeChecked } from "./use-native-checked.js";

/** The details shape `Checkbox` and `Switch` share (each declares its own public name). */
export interface CheckableChangeDetails extends ActionDetails {
  readonly reason: ChangeReason;
}

export interface UseCheckableInputOptions {
  /** Warning tag and dispatch-guard name. */
  readonly component: "Checkbox" | "Switch";
  readonly checked: boolean | undefined;
  readonly defaultChecked: boolean | undefined;
  readonly checkedChangeAction: ChangeAction<boolean, CheckableChangeDetails> | undefined;
  /** The `disabled` prop. */
  readonly disabled: boolean | undefined;
  /** The pass-through props, for the Field's "own or the Field's" `name` / `required` / `id`. */
  readonly rest: Pick<ComponentPropsWithRef<"input">, "name" | "required" | "id">;
  /** View Transition types of a dispatch of `next`. */
  readonly transitionTypes: (next: boolean) => readonly string[];
  /** Switch only: the owned `role`. */
  readonly role?: "switch" | undefined;
  /** Checkbox only: the `indeterminate` prop. `undefined` for a control with no mixed state. */
  readonly indeterminate?: boolean | undefined;
}

export interface CheckableInput {
  readonly optimistic: boolean;
  readonly pending: boolean;
  /** Own `disabled` or the Field's. */
  readonly disabled: boolean;
  /** `indeterminate && !pending`. */
  readonly shownIndeterminate: boolean;
  readonly ref: Ref<HTMLInputElement> | undefined;
  /** The owned layer (conventions 1.2) of the input. */
  readonly libraryProps: Partial<ComponentPropsWithRef<"input">> & DataAttributes;
}

/**
 * The single-checkbox machinery `Checkbox` and `Switch` share: the Field wiring, the
 * controllable action, the native `checked` re-apply and reconciliation (`useNativeChecked`),
 * and the input's owned layer. The components keep their props, state, `useRender` call and
 * transition boundary.
 */
export function useCheckableInput(options: UseCheckableInputOptions): CheckableInput {
  const {
    component,
    checked,
    defaultChecked,
    checkedChangeAction,
    disabled: disabledProp,
    rest,
    transitionTypes,
    role,
    indeterminate,
  } = options;
  // Inside a Field.Root (design/components/field-form.md 7.2) the Field owns the id and the ARIA
  // wiring, and `name` / `required` / `disabled` default from it.
  const field = useFieldControl({
    labelable: true,
    name: rest.name,
    disabled: disabledProp,
    required: rest.required,
    id: rest.id,
    component,
  });
  const disabled = field.disabled;

  const { optimistic, pending, dispatch, latestInFlight } = useControllableAction<
    boolean,
    CheckableChangeDetails
  >({
    controlled: checked,
    defaultValue: defaultChecked,
    initialValue: false,
    action: checkedChangeAction,
    transitionTypes,
    warn: { component, prop: "checked" },
  });
  // Inside a Field: a value React writes with no event (a rejected action rolling back, a
  // controlled change) re-reads validity and `validate` after the commit.
  useFieldValueChange(optimistic);

  // Suspended while pending (conventions 4.1): the browser clears the property on the click, and
  // the parent may not have recomputed yet. Restored on settle if the parent still says mixed.
  const mixed = indeterminate !== undefined;
  const shownIndeterminate = indeterminate === true && !pending;

  const inputRef = useNativeChecked({
    type: "checkbox",
    component,
    checked: optimistic,
    // Uncontrolled: the latest prop is the reset target. Controlled: React's mount-time value.
    defaultChecked: checked === undefined ? (defaultChecked ?? false) : undefined,
    indeterminate: mixed ? shownIndeterminate : undefined,
    latestInFlight,
    onPlatformChange: (next, event) =>
      dispatch(next, createActionDetails(event, { reason: "platform" })),
  });

  const ref = useMergedRefs<HTMLInputElement>(inputRef, field.ref);

  const libraryProps = {
    ...fieldInputProps(field),
    type: "checkbox",
    ...(role !== undefined && { role }),
    // The DOM state is the optimistic state (conventions 3.2): react-dom restores a controlled
    // input to its props after every event, and only the sync-lane optimistic value survives.
    checked: optimistic,
    defaultChecked: undefined,
    // Not a DOM attribute; `useNativeChecked` sets the property. Owned so a `render` element's
    // own `indeterminate` prop (which react-dom would warn about) is stripped.
    ...(mixed && { indeterminate: undefined }),
    "aria-checked": undefined,
    // Owned so that native disabledness, `data-disabled` and the click guard always agree: a
    // `render` element cannot re-enable (`disabled={false}`) or disable the input on its own.
    disabled,
    "data-checked": dataAttr(optimistic),
    ...(mixed && { "data-indeterminate": dataAttr(shownIndeterminate) }),
    "data-pending": dataAttr(pending),
    "data-disabled": dataAttr(disabled),
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      // A natively disabled input fires no click; this covers `render` elements that do not
      // honour `disabled`.
      if (disabled) return;
      const nativeEvent = event.nativeEvent;
      // `indeterminate` plays no part: the platform's rule is "flip checked, clear mixed".
      guardCheckableChange(
        nativeEvent,
        () => dispatch(!optimistic, createActionDetails(nativeEvent, { reason: "activate" })),
        component,
      );
    },
  };

  return { optimistic, pending, disabled, shownIndeterminate, ref, libraryProps };
}

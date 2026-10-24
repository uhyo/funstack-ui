"use client";
import type { ChangeEvent, ComponentPropsWithRef, CSSProperties, ViewTransitionClass } from "react";
import { useTransitionBoundary } from "../internal/transition-boundary.js";
import { createActionDetails } from "../internal/action-details.js";
import { dataAttr } from "../internal/data-attr.js";
import { transitionTypes } from "../internal/transition-types.js";
import type {
  ActionDetails,
  ChangeAction,
  ChangeReason,
  RenderProp,
  StateValue,
} from "../internal/types.js";
import { useControllableAction } from "../internal/use-controllable-action.js";
import {
  fieldInputProps,
  useFieldControl,
  useFieldValueChange,
} from "../internal/use-field-control.js";
import { useMergedRefs } from "../internal/use-merged-refs.js";
import { guardCheckableChange, useNativeChecked } from "../internal/use-native-checked.js";
import { useRender } from "../internal/use-render.js";

export interface CheckboxState {
  /** Optimistic checked state: what the user sees, including an in-flight change. */
  readonly checked: boolean;
  /**
   * The `indeterminate` prop, suspended while an action is in flight: `false` whenever `pending`
   * is true, so that the attribute, the DOM property and `:indeterminate` always agree.
   */
  readonly indeterminate: boolean;
  /** An action dispatched by this Checkbox is in flight (including the resulting render). */
  readonly pending: boolean;
  /** The `disabled` prop (or the enclosing `Field.Root`'s). */
  readonly disabled: boolean;
}

/** Details passed as the second argument of `checkedChangeAction`. */
export interface CheckboxCheckedChangeDetails extends ActionDetails {
  /**
   * `"activate"`: the user toggled the box (click, Space, label click); `event` is the native
   * `click` event. `"platform"`: the browser changed the value itself: a form reset (`event` is
   * the `reset` event) or a click before hydration / Firefox form-state restoration found on
   * mount (`event` is `undefined`).
   */
  readonly reason: ChangeReason;
}

export interface CheckboxProps extends Omit<
  ComponentPropsWithRef<"input">,
  | "type"
  | "checked"
  | "defaultChecked"
  | "onChange"
  | "aria-checked"
  | "className"
  | "style"
  | "children"
> {
  /** Controlled checked state. `undefined` means uncontrolled. */
  checked?: boolean;
  /**
   * Initial checked state in uncontrolled mode (default `false`). Also the value a form reset
   * returns to: the latest prop value is mirrored into the input's `defaultChecked`.
   */
  defaultChecked?: boolean;
  /**
   * Controlled-only mixed state (APG tri-state checkbox), derived by the parent from other state;
   * there is no `defaultIndeterminate` and no action. Rendered as `el.indeterminate`,
   * `data-indeterminate` and `:indeterminate`, except while an action is pending. Clicking a
   * mixed box dispatches `checked: true` (for the usual unchecked + mixed representation). Does
   * not affect what the form submits.
   */
  indeterminate?: boolean;
  /**
   * Called with the next checked state on every change. Runs inside the Checkbox's transition;
   * may be sync or async (also a Server Function). Rejections reach the nearest Error Boundary.
   * Also called with `details.reason === "platform"` for a form reset or a pre-hydration click.
   *
   * A `setState` placed after your own `await` is not a Transition update; wrap it in
   * `startTransition` (React limitation). `details.event.preventDefault()` is not a veto and is
   * unsupported here; use controlled mode to veto a change.
   */
  checkedChangeAction?: ChangeAction<boolean, CheckboxCheckedChangeDetails>;
  /** Renders a natively disabled input; never dispatches. Default `false`. */
  disabled?: boolean;
  /** Submitted as the input's value when checked. Default `"on"` (platform). */
  value?: string;
  /**
   * Forwarded as `default` to the Checkbox's `<ViewTransition>`. Default: no boundary. Animates the
   * commit that ends an action, not the optimistic flip; animate the flip with CSS on `:checked`.
   *
   * Static (conventions 5.1): setting or unsetting it remounts the element, and any value, `"none"`
   * included, makes a mount inside a transition start a document view transition.
   */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, CheckboxState>;
  style?: StateValue<CSSProperties | undefined, CheckboxState>;
  /**
   * Replace the rendered element (element form) or take over rendering (function form). Must keep
   * an `<input type="checkbox">`.
   */
  render?: RenderProp<ComponentPropsWithRef<"input">, CheckboxState>;
}

/**
 * A checkbox (WAI-ARIA "Checkbox" pattern, dual- and mixed-state). Renders
 * `<input type="checkbox">` whose DOM `checked` is the optimistic state; the input carries
 * `data-pending` while `checkedChangeAction` is in flight and takes part in forms natively.
 *
 * Owned keys (a `render` element's value is overridden): `type`, `checked`, `defaultChecked`,
 * `indeterminate` (stripped), `aria-checked` (always removed), `disabled`, `data-checked`,
 * `data-indeterminate`, `data-pending`, `data-disabled`; inside a `Field.Root` also `id`,
 * `name`, `required`, `aria-invalid`, `aria-describedby` (token-merged) and `data-invalid`, and
 * `disabled` / `name` / `required` default from the Field. `role` passes through. Event handlers
 * are merged rather than owned: a `render` element's own `onChange` (or `onClick`) runs first,
 * then the library's; an `onClick` that calls `preventDefault()` cancels the change (nothing is
 * dispatched).
 */
export function Checkbox({
  checked,
  defaultChecked,
  indeterminate = false,
  checkedChangeAction,
  disabled: disabledProp,
  transition,
  className,
  style,
  render,
  ...rest
}: CheckboxProps) {
  // Inside a Field.Root (design/components/field-form.md 7.2) the Field owns the id and the ARIA
  // wiring, and `name` / `required` / `disabled` default from it.
  const field = useFieldControl({
    labelable: true,
    name: rest.name,
    disabled: disabledProp,
    required: rest.required,
    id: rest.id,
    component: "Checkbox",
  });
  const disabled = field.disabled;

  const { optimistic, pending, dispatch, latestInFlight } = useControllableAction<
    boolean,
    CheckboxCheckedChangeDetails
  >({
    controlled: checked,
    defaultValue: defaultChecked,
    initialValue: false,
    action: checkedChangeAction,
    transitionTypes: (next) => transitionTypes("checkbox", next ? "check" : "uncheck"),
    warn: { component: "Checkbox", prop: "checked" },
  });
  // Inside a Field: a value React writes with no event (a rejected action rolling back, a
  // controlled change) re-reads validity and `validate` after the commit.
  useFieldValueChange(optimistic);

  // Suspended while pending (conventions 4.1): the browser clears the property on the click, and
  // the parent may not have recomputed yet. Restored on settle if the parent still says mixed.
  const shownIndeterminate = indeterminate && !pending;

  const inputRef = useNativeChecked({
    type: "checkbox",
    component: "Checkbox",
    checked: optimistic,
    // Uncontrolled: the latest prop is the reset target. Controlled: React's mount-time value.
    defaultChecked: checked === undefined ? (defaultChecked ?? false) : undefined,
    indeterminate: shownIndeterminate,
    latestInFlight,
    onPlatformChange: (next, event) =>
      dispatch(next, createActionDetails(event, { reason: "platform" })),
  });

  const state: CheckboxState = {
    checked: optimistic,
    indeterminate: shownIndeterminate,
    pending,
    disabled,
  };

  const ref = useMergedRefs<HTMLInputElement>(inputRef, field.ref);

  const element = useRender<ComponentPropsWithRef<"input">, CheckboxState>({
    defaultElement: "input",
    render,
    state,
    className,
    style,
    children: undefined,
    ref,
    // Pass-through layer: a `render` element's own props win over these (`role` included).
    props: rest,
    // Library-controlled layer (owned keys, conventions 1.2).
    libraryProps: {
      ...fieldInputProps(field),
      type: "checkbox",
      // The DOM state is the optimistic state (conventions 3.2).
      checked: optimistic,
      defaultChecked: undefined,
      // Not a DOM attribute; the hook sets the property. Owned so a `render` element's own
      // `indeterminate` prop (which react-dom would warn about) is stripped.
      ...{ indeterminate: undefined },
      "aria-checked": undefined,
      // Owned so that native disabledness, `data-disabled` and the click guard always agree: a
      // `render` element cannot re-enable (`disabled={false}`) or disable the input on its own.
      disabled,
      "data-checked": dataAttr(optimistic),
      "data-indeterminate": dataAttr(shownIndeterminate),
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
          "Checkbox",
        );
      },
    },
  });

  return useTransitionBoundary("Checkbox", transition, element);
}

Checkbox.displayName = "Checkbox";

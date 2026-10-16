"use client";
import { ViewTransition } from "react";
import type { ChangeEvent, ComponentPropsWithRef, CSSProperties, ViewTransitionClass } from "react";
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
import { guardCheckableChange, useNativeChecked } from "../internal/use-native-checked.js";
import { useRender } from "../internal/use-render.js";

export interface SwitchState {
  /** Optimistic checked state: what the user sees, including an in-flight change. */
  readonly checked: boolean;
  /** An action dispatched by this Switch is in flight (including the resulting render). */
  readonly pending: boolean;
  /** The `disabled` prop. */
  readonly disabled: boolean;
}

/** Details passed as the second argument of `checkedChangeAction`. */
export interface SwitchCheckedChangeDetails extends ActionDetails {
  /**
   * `"activate"`: the user toggled the switch (click, Space, label click); `event` is the native
   * `click` event. `"platform"`: the browser changed the value itself: a form reset (`event` is
   * the `reset` event) or a click before hydration / Firefox form-state restoration found on
   * mount (`event` is `undefined`).
   */
  readonly reason: ChangeReason;
}

export interface SwitchProps extends Omit<
  ComponentPropsWithRef<"input">,
  | "type"
  | "role"
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
   * Called with the next checked state on every change. Runs inside the Switch's transition; may
   * be sync or async (also a Server Function). Rejections reach the nearest Error Boundary.
   * Also called with `details.reason === "platform"` for a form reset or a pre-hydration click.
   *
   * A `setState` placed after your own `await` is not a Transition update; wrap it in
   * `startTransition` (React limitation). `details.event.preventDefault()` is not a veto and is
   * unsupported here; use controlled mode to veto a change.
   */
  checkedChangeAction?: ChangeAction<boolean, SwitchCheckedChangeDetails>;
  /** Renders a natively disabled input; never dispatches. Default `false`. */
  disabled?: boolean;
  /** Submitted as the input's value when checked. Default `"on"` (platform). */
  value?: string;
  /**
   * Forwarded as `default` to the Switch's `<ViewTransition>`. Default `"none"`. Animates the
   * commit that ends an action, not the optimistic flip; animate the flip with CSS on `:checked`.
   */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, SwitchState>;
  style?: StateValue<CSSProperties | undefined, SwitchState>;
  /**
   * Replace the rendered element (element form) or take over rendering (function form). Must keep
   * an `<input type="checkbox">`.
   */
  render?: RenderProp<ComponentPropsWithRef<"input">, SwitchState>;
}

/**
 * An on/off switch (WAI-ARIA "Switch" pattern, HTML checkbox input variant). Renders
 * `<input type="checkbox" role="switch">` whose DOM `checked` is the optimistic state; the input
 * carries `data-pending` while `checkedChangeAction` is in flight and takes part in forms natively.
 *
 * Owned keys (a `render` element cannot set them): `type`, `role`, `checked`, `defaultChecked`,
 * `aria-checked` (always removed), `onChange`, `data-checked`, `data-pending`, `data-disabled`.
 */
export function Switch({
  checked,
  defaultChecked,
  checkedChangeAction,
  disabled = false,
  transition,
  className,
  style,
  render,
  ...rest
}: SwitchProps) {
  const { optimistic, pending, dispatch, latestInFlight } = useControllableAction<
    boolean,
    SwitchCheckedChangeDetails
  >({
    controlled: checked,
    defaultValue: defaultChecked,
    initialValue: false,
    action: checkedChangeAction,
    transitionTypes: (next) => transitionTypes("switch", next ? "on" : "off"),
    warn: { component: "Switch", prop: "checked" },
  });

  const inputRef = useNativeChecked({
    type: "checkbox",
    component: "Switch",
    checked: optimistic,
    // Uncontrolled: the latest prop is the reset target. Controlled: React's mount-time value.
    defaultChecked: checked === undefined ? (defaultChecked ?? false) : undefined,
    latestInFlight,
    onPlatformChange: (next, event) =>
      dispatch(next, createActionDetails(event, { reason: "platform" })),
  });

  const state: SwitchState = { checked: optimistic, pending, disabled };

  const element = useRender<ComponentPropsWithRef<"input">, SwitchState>({
    defaultElement: "input",
    render,
    state,
    className,
    style,
    children: undefined,
    ref: inputRef,
    // Pass-through layer: a `render` element's own props win over these.
    props: { ...rest, disabled },
    // Library-controlled layer (owned keys, conventions 1.2).
    libraryProps: {
      type: "checkbox",
      role: "switch",
      // The DOM state is the optimistic state (conventions 3.2): react-dom restores a controlled
      // input to its props after every event, and only the sync-lane optimistic value survives.
      checked: optimistic,
      defaultChecked: undefined,
      "aria-checked": undefined,
      "data-checked": dataAttr(optimistic),
      "data-pending": dataAttr(pending),
      "data-disabled": dataAttr(disabled),
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        // A natively disabled input fires no click; this covers `render` elements that do not
        // honour `disabled`.
        if (disabled) return;
        const nativeEvent = event.nativeEvent;
        guardCheckableChange(
          nativeEvent,
          () => dispatch(!optimistic, createActionDetails(nativeEvent, { reason: "activate" })),
          "Switch",
        );
      },
    },
  });

  return <ViewTransition default={transition ?? "none"}>{element}</ViewTransition>;
}

Switch.displayName = "Switch";

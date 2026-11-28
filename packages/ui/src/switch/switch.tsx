"use client";
import type { ComponentPropsWithRef, CSSProperties } from "react";
import { transitionTypes } from "../internal/transition-types.js";
import type {
  ActionDetails,
  ChangeAction,
  ChangeReason,
  RenderProp,
  StateValue,
} from "../internal/types.js";
import { useCheckableInput } from "../internal/form/use-checkable-input.js";
import type { ElementCheck } from "../internal/use-element-check.js";
import { useMergedRefs } from "../internal/use-merged-refs.js";
import { CONTROL_NAME, useNameWarning } from "../internal/use-name-warning.js";
import { useRender } from "../internal/use-render.js";

const isDev = process.env.NODE_ENV !== "production";

/** State of `Switch`, passed to the function forms of `className`, `style` and `render`. */
export interface SwitchState {
  /** Optimistic checked state: what the user sees, including an in-flight change. */
  readonly checked: boolean;
  /** An action dispatched by this Switch is in flight (including the resulting render). */
  readonly pending: boolean;
  /** The `disabled` prop (or the enclosing `Field.Root`'s). */
  readonly disabled: boolean;
  /** Inside a `Field.Root`: an error is shown for the field (`data-invalid`). `false` outside. */
  readonly invalid: boolean;
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

/**
 * Props of `Switch`.
 *
 * @see https://ui.funstack.work/components/switch
 */
export interface SwitchProps extends Omit<
  ComponentPropsWithRef<"input">,
  | "type"
  | "role"
  | "checked"
  | "defaultChecked"
  | "onChange"
  | "aria-checked"
  | "readOnly"
  | "className"
  | "style"
  | "children"
> {
  /** Controlled checked state. `undefined` means uncontrolled. */
  checked?: boolean;
  /**
   * Initial checked state in uncontrolled mode. Also the value a form reset
   * returns to: the latest prop value is mirrored into the input's `defaultChecked`.
   *
   * @defaultValue `false`
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
  /**
   * Renders a natively disabled input; never dispatches.
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
  /**
   * Submitted as the input's value when checked.
   *
   * @defaultValue `"on"` (platform)
   */
  value?: string;

  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, SwitchState>;
  /** Inline style, or a function of the part's state that returns one. */
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
 * Animate the flip with CSS on `:checked`; there is no `transition` prop (a value control whose
 * attributes are all optimistic, conventions 5.1). Every dispatch carries the View Transition
 * types `fsui-switch` and `fsui-switch-check` / `fsui-switch-uncheck` for your own
 * `<ViewTransition>`. `readOnly` is not accepted: it does not apply to a checkbox input.
 *
 * Owned keys (a `render` element's value is overridden): `type`, `role`, `checked`,
 * `defaultChecked`, `aria-checked` (always removed), `disabled`, `data-checked`, `data-pending`,
 * `data-disabled`; inside a `Field.Root` also `id`, `name`, `required`, `aria-invalid`,
 * `aria-describedby` (token-merged) and `data-invalid`, and `disabled` / `name` / `required`
 * default from the Field. Event handlers are merged rather than owned: a `render` element's own
 * `onChange` (or `onClick`) runs first, then the library's; an `onClick` that calls
 * `preventDefault()` cancels the change (nothing is dispatched).
 *
 * @see https://ui.funstack.work/components/switch
 */
export function Switch({
  checked,
  defaultChecked,
  checkedChangeAction,
  disabled,
  className,
  style,
  render,
  ...rest
}: SwitchProps) {
  const input = useCheckableInput({
    component: "Switch",
    checked,
    defaultChecked,
    checkedChangeAction,
    disabled,
    own: rest,
    transitionTypes: (next) => transitionTypes("switch", next ? "check" : "uncheck"),
    role: "switch",
  });

  const state: SwitchState = {
    checked: input.optimistic,
    pending: input.pending,
    disabled: input.disabled,
    invalid: input.invalid,
  };

  // Development check (conventions 9.5): a switch needs a name, from a `<label for>`, a wrapping
  // `<label>` (a `Field.Label` included), `aria-label` or `aria-labelledby`.
  const checkName: ElementCheck<HTMLInputElement> | undefined = useNameWarning(
    isDev &&
      "Switch: the switch has no accessible name. Wrap it in a <label>, associate a <label for>, " +
        "use Field.Label, or give it aria-label / aria-labelledby.",
    CONTROL_NAME,
  );
  const ref = useMergedRefs<HTMLInputElement>(input.ref, checkName);

  return useRender<ComponentPropsWithRef<"input">, SwitchState>({
    defaultElement: "input",
    render,
    state,
    className,
    style,
    children: undefined,
    ref,
    // Pass-through layer: a `render` element's own props win over these.
    props: rest,
    libraryProps: input.libraryProps,
  });
}

Switch.displayName = "Switch";

"use client";
import { useMemo, useRef, useState } from "react";
import type { ChangeEvent, ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
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
import { useNativeSelectValue } from "../internal/use-native-select-value.js";
import { useRender } from "../internal/use-render.js";
import { SelectContext } from "./select-context.js";
import type { SelectContextValue } from "./select-context.js";
import { useSelectPartRef } from "./select-dom.js";

/** Details passed as the second argument of `valueChangeAction`. */
export interface SelectValueChangeDetails extends ActionDetails {
  /**
   * `"activate"`: the user picked an option (pointer, keyboard, typeahead, or browser autofill,
   * which the library cannot tell from a pick); `details.event` is the native `change` event.
   * `"platform"`: the browser changed the value without a pick the library saw: a form reset
   * (`details.event` is the `reset` event), or a pick before hydration / Firefox form-state
   * restoration reconciled at mount (`details.event` is `undefined`).
   */
  readonly reason: ChangeReason;
}

/**
 * State of `Select.Root`, `Select.Trigger`, `Select.Value`, `Select.Group`, `Select.GroupLabel`,
 * `Select.Separator`, passed to the function forms of `className`, `style`, `children` and
 * `render`.
 */
export interface SelectRootState {
  /** Optimistic value. Content rendered from it must not suspend. */
  readonly value: string;
  /** An action dispatched through this Select is in flight. */
  readonly pending: boolean;
  /** The `disabled` prop. */
  readonly disabled: boolean;
}

/**
 * Props of `Select.Root`.
 *
 * @see https://ui.funstack.work/components/select
 */
export interface SelectRootProps extends Omit<
  ComponentPropsWithRef<"select">,
  | "value"
  | "defaultValue"
  | "onChange"
  | "multiple"
  | "size"
  | "disabled"
  | "className"
  | "style"
  | "children"
> {
  /** Controlled value. `undefined` means uncontrolled. Use `""` for the placeholder option. */
  value?: string;
  /**
   * Initial value in uncontrolled mode, and the value a form reset returns to (the latest prop is
   * mirrored into the options' `defaultSelected`). When omitted, the browser's choice (an option
   * whose value is `""`, else the first enabled option) is adopted at mount, without a dispatch,
   * and is what a form reset returns to. Until a pick (or a platform change) sets the value,
   * options that mount later without the adopted one (a Suspense fallback) adopt again.
   *
   * @defaultValue the browser's choice
   */
  defaultValue?: string;
  /**
   * Runs inside the Root's transition whenever the selected option changes. May be sync or async
   * (also a Server Function); rejections reach the nearest Error Boundary and roll the selection
   * back.
   *
   * In engines whose closed select changes the value on every arrow press (Firefox, Safari with
   * native appearance), every press dispatches; the latest dispatch wins. A `setState` placed
   * after your own `await` is not a Transition update; wrap it in `startTransition` (React
   * limitation). Controlled mode is the way to veto a change.
   */
  valueChangeAction?: ChangeAction<string, SelectValueChangeDetails>;
  /**
   * Native `disabled`. Never set by the library while pending.
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, SelectRootState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, SelectRootState>;
  /**
   * The options and the Trigger. The function form receives the optimistic value; must not suspend.
   */
  children?: StateValue<ReactNode, SelectRootState>;
  /** Replace the rendered element. Must keep a `<select>`. */
  render?: RenderProp<ComponentPropsWithRef<"select">, SelectRootState>;
}

/**
 * The `<select>` itself: owns the value, the transition, the form-reset listener, the mount
 * reconciliation and the re-apply of late options (design/components/select.md 15.2). Renders
 * `value={optimistic}`: react-dom restores a controlled select to its props after every event,
 * and only the sync-lane optimistic value survives that restore.
 *
 * Owned keys (conventions 1.2): `value`, `disabled`, `data-pending`, `data-disabled`, `onChange`;
 * inside a `Field.Root` also `id`, `name`, `required`, `aria-invalid`, `aria-describedby`
 * (token-merged) and `data-invalid`, and `disabled` / `name` / `required` default from the Field.
 *
 * @see https://ui.funstack.work/components/select
 */
export function SelectRoot({
  value,
  defaultValue,
  valueChangeAction,
  disabled: disabledProp,
  className,
  style,
  children,
  render,
  ...rest
}: SelectRootProps) {
  const { ref: libraryRef, node: selectRef } = useSelectPartRef<HTMLSelectElement>(
    "Select.Root",
    "select",
  );
  // Inside a Field.Root (design/components/field-form.md 7.2) the Field owns the id and the ARIA
  // wiring, and `name` / `required` / `disabled` default from it.
  const field = useFieldControl({
    labelable: true,
    name: rest.name,
    disabled: disabledProp,
    required: rest.required,
    id: rest.id,
    component: "Select.Root",
  });
  const disabled = field.disabled;
  const rootRef = useMergedRefs<HTMLSelectElement>(libraryRef, field.ref);

  const { optimistic, pending, dispatch, latestInFlight, adopt } = useControllableAction<
    string,
    SelectValueChangeDetails
  >({
    controlled: value,
    defaultValue,
    initialValue: "",
    action: valueChangeAction,
    transitionTypes: () => transitionTypes("select"),
    warn: { component: "Select.Root", prop: "value" },
  });
  // Inside a Field: a value React writes with no event (a rejected action rolling back, a
  // controlled change) re-reads validity and `validate` after the commit.
  useFieldValueChange(optimistic);
  // Deliberately no warning when neither `value` nor `defaultValue` is given: the browser's
  // first-option default is adopted (design decisions 3 and 4).

  // Controlled: the mount-time value is the reset target (conventions 3.8 rule 6). Neither
  // `value` nor `defaultValue`: the value adopted at mount, chosen inside the hook.
  const [mountValue] = useState(value);
  const resetTarget = value === undefined ? defaultValue : (mountValue ?? value);

  // Any dispatch, a pick or a platform change, ends the adoption of the browser's default.
  const established = useRef(false);
  const dispatchChange = (next: string, details: SelectValueChangeDetails) => {
    established.current = true;
    dispatch(next, details);
  };

  const { optionMounted } = useNativeSelectValue({
    ref: selectRef,
    optimistic,
    latestInFlight,
    resetTarget,
    adoptDefault:
      value === undefined && defaultValue === undefined
        ? { adopt, established: () => established.current }
        : undefined,
    onPlatformChange: (next, event) =>
      dispatchChange(next, createActionDetails(event, { reason: "platform" })),
  });

  // Memoised: every member is a state value, a prop or a stable callback.
  const context = useMemo<SelectContextValue>(
    () => ({ optimistic, pending, disabled, groupDisabled: false, optionMounted }),
    [optimistic, pending, disabled, optionMounted],
  );
  const state: SelectRootState = { value: optimistic, pending, disabled };

  const element = useRender<ComponentPropsWithRef<"select">, SelectRootState>({
    defaultElement: "select",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: {
      ...fieldInputProps(field),
      value: optimistic,
      disabled,
      "data-pending": dataAttr(pending),
      "data-disabled": dataAttr(disabled),
      onChange: (event: ChangeEvent<HTMLSelectElement>) => {
        // A natively disabled select fires no change; this covers `render` elements.
        if (disabled) return;
        const next = event.currentTarget.value;
        // No-op rule against the optimistic value (conventions 2.3, design 4.2).
        if (next === optimistic) return;
        dispatchChange(next, createActionDetails(event.nativeEvent, { reason: "activate" }));
      },
    },
    ref: rootRef,
  });

  return <SelectContext value={context}>{element}</SelectContext>;
}

SelectRoot.displayName = "SelectRoot";

"use client";
import { useMemo, useRef } from "react";
import type { ChangeEvent, ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { createActionDetails } from "../internal/action/action-details.js";
import { dataAttr } from "../internal/data-attr.js";
import { transitionTypes } from "../internal/transition-types.js";
import type {
  ActionDetails,
  ChangeAction,
  ChangeReason,
  RenderProp,
  StateValue,
} from "../internal/types.js";
import { useControllableAction } from "../internal/action/use-controllable-action.js";
import {
  fieldInputProps,
  useFieldControl,
  useFieldValueChange,
} from "../internal/form/use-field-control.js";
import { useResetTarget } from "../internal/form/use-form-reset.js";
import { useNextValidity } from "../internal/form/use-next-validity.js";
import { nativeValid } from "../internal/form/validity.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useMergedRefs } from "../internal/use-merged-refs.js";
import type { ElementCheck } from "../internal/use-element-check.js";
import { CONTROL_NAME, useNameWarning } from "../internal/use-name-warning.js";
import { useNativeSelectValue } from "../internal/form/use-native-select-value.js";
import { useRender } from "../internal/use-render.js";
import { SelectContext } from "./select-context.js";
import type { SelectContextValue } from "./select-context.js";
import { useSelectPartRef } from "./select-dom.js";

const isDev = process.env.NODE_ENV !== "production";

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
  /**
   * The control would be valid holding this value: its native constraints (`required` with the
   * empty option) and, inside a Field, `validate`. Not a server error. Information only: the
   * change is dispatched either way (conventions 2.2).
   */
  readonly valid: boolean;
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
  /** The `disabled` prop (or the enclosing `Field.Root`'s). */
  readonly disabled: boolean;
  /** The `readOnly` prop (or the enclosing `Field.Root`'s): `data-readonly`. */
  readonly readOnly: boolean;
  /** Inside a `Field.Root`: an error is shown for the field (`data-invalid`). `false` outside. */
  readonly invalid: boolean;
}

/** State of `Select.Trigger`: the Root's (conventions 9.4). */
export type SelectTriggerState = SelectRootState;
/** State of `Select.Value`: the Root's. */
export type SelectValueState = SelectRootState;
/** State of `Select.Group`: the Root's. */
export type SelectGroupState = SelectRootState;
/** State of `Select.GroupLabel`: the Root's. */
export type SelectGroupLabelState = SelectRootState;
/** State of `Select.Separator`: the Root's. */
export type SelectSeparatorState = SelectRootState;

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
  | "aria-readonly"
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
  /**
   * The selected option stays selected: the select is focusable, its picker opens and its value
   * is submitted, but every other option renders native `disabled` (with `data-disabled`), so no
   * pick, arrow or typeahead can change it, in every engine and before hydration, and nothing
   * dispatches. Renders `aria-readonly="true"` and `data-readonly`; native `required` is
   * withheld. Also `true` when the enclosing `Field.Root` is read-only.
   *
   * @defaultValue `false`
   */
  readOnly?: boolean;
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
 * Owned keys (conventions 1.2): `value`, `disabled`, `aria-readonly`, `data-pending`,
 * `data-disabled`, `data-readonly`, `onChange`; `required` while read-only (withheld); inside a `Field.Root` also `id`, `name`, `required`, `aria-invalid`, `aria-describedby`
 * (token-merged) and `data-invalid`, and `disabled` / `name` / `required` default from the Field.
 *
 * @see https://ui.funstack.work/components/select
 */
export function SelectRoot({
  value,
  defaultValue,
  valueChangeAction,
  disabled: disabledProp,
  readOnly: readOnlyProp,
  className,
  style,
  children,
  render,
  ...restWithMultiple
}: SelectRootProps) {
  // `multiple` is a type error and is not passed on: a list of values is MultiSelect
  // (design/components/select.md 13, multi-select.md A.3). The name stays free for the native
  // multi drop-down.
  const { multiple, ...rest } = restWithMultiple as typeof restWithMultiple & {
    multiple?: unknown;
  };
  useDevWarning(
    multiple !== undefined && multiple !== false,
    isDev &&
      "Select.Root: `multiple` is not supported; it is ignored. Select is a native single " +
        "<select>. For several values use MultiSelect (`@funstack/ui/multi-select`), or " +
        "CheckboxGroup for a short list shown in the page.",
  );
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
    readOnly: readOnlyProp,
    id: rest.id,
    component: "Select.Root",
  });
  const disabled = field.disabled;
  const readOnly = field.readOnly;
  const invalid = field.state?.invalid ?? false;
  // Development check (conventions 9.5): a `<select>` needs a name, from a `<label for>`, a
  // wrapping `<label>` (a `Field.Label` included), `aria-label` or `aria-labelledby`.
  const checkName: ElementCheck<HTMLSelectElement> | undefined = useNameWarning(
    isDev &&
      "Select.Root: the <select> has no accessible name. Associate a <label for>, use " +
        "Field.Label, or give it aria-label / aria-labelledby.",
    CONTROL_NAME,
  );
  const rootRef = useMergedRefs<HTMLSelectElement>(libraryRef, field.ref, checkName);

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
  const resetTarget = useResetTarget(value, defaultValue) ?? value;

  // Any dispatch, a pick or a platform change, ends the adoption of the browser's default.
  const established = useRef(false);
  // `details.valid` (field-form.md 7.5): every dispatch runs when the `<select>` already holds
  // the requested value (a `change`, a reset, a pick before hydration).
  const nextValidity = useNextValidity();
  const dispatchChange = (next: string, event: Event | undefined, reason: ChangeReason) => {
    established.current = true;
    const el = selectRef.current;
    const valid = nextValidity(el === null || nativeValid(el), null);
    dispatch(next, createActionDetails(event, { reason, valid }));
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
    onPlatformChange: (next, event) => dispatchChange(next, event, "platform"),
    readOnly,
  });

  // Memoised: every member is a state value, a prop or a stable callback.
  const context = useMemo<SelectContextValue>(
    () => ({
      optimistic,
      pending,
      disabled,
      readOnly,
      invalid,
      groupDisabled: false,
      optionMounted,
    }),
    [optimistic, pending, disabled, readOnly, invalid, optionMounted],
  );
  const state: SelectRootState = { value: optimistic, pending, disabled, readOnly, invalid };

  const element = useRender<ComponentPropsWithRef<"select">, SelectRootState>({
    defaultElement: "select",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: {
      // Read-only withholds native `required` (conventions 3.6.1 rule 5).
      ...fieldInputProps(field, true),
      value: optimistic,
      disabled,
      // The `combobox` role has the read-only state (3.6.1 rule 9).
      "aria-readonly": readOnly ? "true" : undefined,
      "data-pending": dataAttr(pending),
      "data-disabled": dataAttr(disabled),
      "data-readonly": dataAttr(readOnly),
      onChange: (event: ChangeEvent<HTMLSelectElement>) => {
        // A natively disabled select fires no change; this covers `render` elements. Read-only:
        // the other options are disabled, so no pick arrives; a stray one is not a change, and
        // react-dom restores the controlled value after the event.
        if (disabled || readOnly) return;
        const next = event.currentTarget.value;
        // No-op rule against the optimistic value (conventions 2.3, design 4.2).
        if (next === optimistic) return;
        dispatchChange(next, event.nativeEvent, "activate");
      },
    },
    ref: rootRef,
  });

  return <SelectContext value={context}>{element}</SelectContext>;
}

SelectRoot.displayName = "SelectRoot";

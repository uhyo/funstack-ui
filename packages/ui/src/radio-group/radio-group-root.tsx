"use client";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
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
import { intendedValue, useControllableAction } from "../internal/use-controllable-action.js";
import { useFieldValueChange } from "../internal/use-field-control.js";
import { useFieldsetGroup } from "../internal/use-fieldset-group.js";
import { useNativeGroupReconciliation } from "../internal/use-native-group-reconciliation.js";
import { useRender } from "../internal/use-render.js";
import { RadioGroupContext } from "./radio-group-context.js";
import type { RadioGroupContextValue } from "./radio-group-context.js";

const isDev = process.env.NODE_ENV !== "production";

/** Details passed as the second argument of `valueChangeAction`. */
export interface RadioGroupValueChangeDetails extends ActionDetails {
  /**
   * `"activate"`: the user checked a radio (click, Space, label click, or an arrow key, all of
   * which arrive as a native `click`). `"platform"`: the browser changed the checked radio
   * itself: a form reset (`details.event` is the `reset` event), or a click before hydration /
   * Firefox form-state restoration found at mount (`details.event` is `undefined`).
   */
  readonly reason: ChangeReason;
}

/**
 * State of `RadioGroup.Root`, `RadioGroup.Label`, passed to the function forms of `className`,
 * `style`, `children` and `render`.
 */
export interface RadioGroupRootState {
  /** Optimistic checked value, or `null`. Content rendered from it must not suspend. */
  readonly value: string | null;
  /** An action dispatched through this group is in flight. */
  readonly pending: boolean;
  /** The `disabled` prop (or the enclosing `Field.Root`'s). */
  readonly disabled: boolean;
}

/**
 * Props of `RadioGroup.Root`.
 *
 * @see https://ui.funstack.work/components/radio-group
 */
export interface RadioGroupRootProps extends Omit<
  ComponentPropsWithRef<"fieldset">,
  | "className"
  | "style"
  | "children"
  | "defaultValue"
  | "defaultChecked"
  | "name"
  | "disabled"
  | "form"
> {
  /**
   * Controlled checked value. `null` checks nothing; `undefined` means uncontrolled.
   *
   * A form reset returns each radio to the `checked` it had when *that radio* mounted (React sets
   * `defaultChecked` once, from the initial `checked`). An Item added on the client while `value`
   * equals its value therefore also gets `defaultChecked`, so two radios may carry it and the
   * reset target is not necessarily the group's mount-time value. The reset is offered to
   * `valueChangeAction` as usual; for a stable target remount the group with a `key` or use
   * `defaultValue`, whose latest value every Item mirrors.
   */
  value?: string | null;
  /**
   * Initial value in uncontrolled mode. Also the value a
   * form reset returns to: the latest prop value is mirrored into the radios' `defaultChecked`.
   *
   * @defaultValue `null` (nothing checked)
   */
  defaultValue?: string | null;
  /**
   * Runs inside the Root's transition whenever the checked radio changes. May be sync or async
   * (also a Server Function); rejections reach the nearest Error Boundary and roll the selection
   * back.
   *
   * `next` is a string for every user interaction. It is `null` only with
   * `details.reason === "platform"`, when a form reset returned the group to "nothing checked".
   * Every arrow key press dispatches; the latest dispatch wins. A `setState` placed after your
   * own `await` is not a Transition update; wrap it in `startTransition` (React limitation).
   * `details.event.preventDefault()` is not a veto; use controlled mode to veto a change.
   */
  valueChangeAction?: ChangeAction<string | null, RadioGroupValueChangeDetails>;
  /**
   * The `name` shared by every radio in the group (form data key). Pass a real name when the group
   * is inside a `<form>` you submit. Must be unique within the form: react-dom throws if a
   * non-React radio shares it.
   *
   * @defaultValue a `useId()` value
   */
  name?: string;
  /** The `form` attribute, applied to the fieldset and to every radio. */
  form?: string;
  /**
   * Marks every radio `required`, which makes the group required (one checked radio satisfies it),
   * and renders `aria-required="true"` on the fieldset so the radiogroup itself is exposed as
   * required.
   *
   * @defaultValue `false`
   */
  required?: boolean;
  /**
   * Renders `<fieldset disabled>`: every radio is disabled, unfocusable and skipped by arrows.
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, RadioGroupRootState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, RadioGroupRootState>;
  /** The Label and Items. The function form receives the optimistic value; must not suspend. */
  children?: StateValue<ReactNode, RadioGroupRootState>;
  /** Replace the rendered element. Must keep a `<fieldset>`. */
  render?: RenderProp<ComponentPropsWithRef<"fieldset">, RadioGroupRootState>;
}

/**
 * Value of the group's checked radio as the DOM shows it (`prop: "checked"`) or as a form reset
 * leaves it (`prop: "defaultChecked"`), or `null`. Only radios of this group's `name` count, so a
 * nested group is ignored.
 */
function readGroup(
  fieldset: HTMLFieldSetElement | null,
  name: string,
  prop: "checked" | "defaultChecked",
): string | null {
  if (fieldset === null) return null;
  for (const radio of fieldset.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
    if (radio.name === name && radio[prop]) return radio.value;
  }
  return null;
}

/**
 * `<fieldset role="radiogroup">` that owns the group's state, the transition, the shared `name`,
 * the form-reset listener and the mount reconciliation (design/components/radio-group.md 13.3).
 * Carries `data-pending` while `valueChangeAction` is in flight.
 *
 * Owned keys (conventions 1.2): `role`, `aria-required`, `disabled`, `form`, `data-pending`,
 * `data-disabled`; inside a `Field.Root` also `aria-labelledby` (→ `Field.Label`, token-merged),
 * `aria-describedby` (token-merged), `aria-invalid` and `data-invalid`, and `name` / `required` /
 * `disabled` default from the Field.
 *
 * Keep every Item in the same Suspense boundary as its Root when server rendering. Partial
 * hydration of a group (a boundary between Root and Items that stays dehydrated while the user
 * interacts) is not supported by React: clicking a hydrated radio while same-`name` siblings are
 * still dehydrated makes react-dom throw "Mixing React and non-React radio inputs with the same
 * `name` is not supported". Development warns when Items hydrate after their Root.
 *
 * @see https://ui.funstack.work/components/radio-group
 */
export function RadioGroupRoot({
  value,
  defaultValue,
  valueChangeAction,
  name: nameProp,
  form,
  required: requiredProp,
  disabled: disabledProp,
  className,
  style,
  children,
  render,
  ...rest
}: RadioGroupRootProps) {
  const { field, name, required, disabled, fieldsetRef, rootRef } = useFieldsetGroup({
    component: "RadioGroup.Root",
    name: nameProp,
    disabled: disabledProp,
    required: requiredProp,
  });

  const { optimistic, pending, dispatch, latestInFlight } = useControllableAction<
    string | null,
    RadioGroupValueChangeDetails
  >({
    controlled: value,
    defaultValue,
    initialValue: null,
    action: valueChangeAction,
    transitionTypes: () => transitionTypes("radio-group"),
    warn: { component: "RadioGroup.Root", prop: "value" },
  });
  // Inside a Field: a value React writes with no event (a rejected action rolling back, a
  // controlled change) re-reads validity and `validate` after the commit.
  useFieldValueChange(optimistic);
  // Deliberately no warning when neither `value` nor `defaultValue` is given: an unchecked group
  // is the HTML default (design decision 2).

  const base = (): string | null => intendedValue(latestInFlight, optimistic);

  // The residual browser paths (design section 5): one dispatch per group, from here. Items that
  // mount after the Root report through `onItemMounted` so the group is reconciled again.
  const { onItemMounted } = useNativeGroupReconciliation<string | null>({
    element: fieldsetRef,
    readCurrent: () => readGroup(fieldsetRef.current, name, "checked"),
    readDefault: () => readGroup(fieldsetRef.current, name, "defaultChecked"),
    base,
    onPlatformChange: (next, event) =>
      dispatch(next, createActionDetails(event, { reason: "platform" })),
  });

  // Dev-only partial-hydration detection. The radios present in the fieldset when the Root
  // mounts are either mounted in the Root's commit or still dehydrated server HTML. An Item that
  // mounts later on one of those elements hydrated after the Root (an Item created on the client
  // gets a new element). Items of the Root's own commit run their mount effect before this one,
  // while the snapshot is still `null`; StrictMode's re-run finds it reset by the cleanup.
  const serverRadios = useRef<ReadonlySet<Element> | null>(null);
  const warnedPartialHydration = useRef(false);
  useLayoutEffect(() => {
    if (!isDev) return;
    const el = fieldsetRef.current;
    serverRadios.current = new Set(el === null ? [] : el.querySelectorAll('input[type="radio"]'));
    return () => {
      serverRadios.current = null;
    };
  }, [fieldsetRef]);
  const onItemMountedWithCheck = useCallback(
    (element?: Element | null) => {
      if (
        isDev &&
        !warnedPartialHydration.current &&
        element != null &&
        serverRadios.current?.has(element) === true
      ) {
        warnedPartialHydration.current = true;
        console.error(
          `RadioGroup.Item: an Item hydrated after its RadioGroup.Root (a Suspense boundary ` +
            `between them). Partial hydration of a radio group is not supported by React: ` +
            `clicking a hydrated radio while same-name radios are still dehydrated makes ` +
            `react-dom throw "Mixing React and non-React radio inputs with the same name is not ` +
            `supported". Keep every Item in the same Suspense boundary as its Root.`,
        );
      }
      onItemMounted(element);
    },
    [onItemMounted],
  );

  // Memoised: `dispatch` and `onItemMountedWithCheck` are stable, so this changes only with
  // the state and the props below.
  const contextDefault = value === undefined ? (defaultValue ?? null) : undefined;
  const state = useMemo<RadioGroupRootState>(
    () => ({ value: optimistic, pending, disabled }),
    [optimistic, pending, disabled],
  );
  const context = useMemo<RadioGroupContextValue>(
    () => ({
      name,
      form,
      required,
      state,
      defaultValue: contextDefault,
      onItemMounted: onItemMountedWithCheck,
      select: (next, event) => {
        // No-op rule against the optimistic value (conventions 2.3 item 7, design 4.2).
        if (next === optimistic) return;
        dispatch(next, createActionDetails(event, { reason: "activate" }));
      },
    }),
    [name, form, required, state, optimistic, contextDefault, onItemMountedWithCheck, dispatch],
  );

  const element = useRender<ComponentPropsWithRef<"fieldset">, RadioGroupRootState>({
    defaultElement: "fieldset",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: {
      ...field.attributes,
      role: "radiogroup",
      "aria-required": required ? "true" : undefined,
      disabled,
      form,
      "data-pending": dataAttr(pending),
      "data-disabled": dataAttr(disabled),
    },
    ref: rootRef,
  });

  return <RadioGroupContext value={context}>{element}</RadioGroupContext>;
}

RadioGroupRoot.displayName = "RadioGroupRoot";

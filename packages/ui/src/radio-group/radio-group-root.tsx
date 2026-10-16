"use client";
import { useCallback, useId, useRef } from "react";
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
import { useControllableAction } from "../internal/use-controllable-action.js";
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

export interface RadioGroupRootState {
  /** Optimistic checked value, or `null`. Content rendered from it must not suspend. */
  readonly value: string | null;
  /** An action dispatched through this group is in flight. */
  readonly pending: boolean;
  /** The `disabled` prop. */
  readonly disabled: boolean;
}

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
  /** Controlled checked value. `null` checks nothing; `undefined` means uncontrolled. */
  value?: string | null;
  /**
   * Initial value in uncontrolled mode. Defaults to `null` (nothing checked). Also the value a
   * form reset returns to: the latest prop value is mirrored into the radios' `defaultChecked`.
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
   * The `name` shared by every radio in the group (form data key). Defaults to a `useId()` value;
   * pass a real name when the group is inside a `<form>` you submit. Must be unique within the
   * form: react-dom throws if a non-React radio shares it.
   */
  name?: string;
  /** The `form` attribute, applied to the fieldset and to every radio. */
  form?: string;
  /** Marks every radio `required`, which makes the group required (one checked radio satisfies it). */
  required?: boolean;
  /** Renders `<fieldset disabled>`: every radio is disabled, unfocusable and skipped by arrows. */
  disabled?: boolean;
  className?: StateValue<string | undefined, RadioGroupRootState>;
  style?: StateValue<CSSProperties | undefined, RadioGroupRootState>;
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
 * Owned keys (conventions 1.2): `role`, `disabled`, `form`, `data-pending`, `data-disabled`.
 */
export function RadioGroupRoot({
  value,
  defaultValue,
  valueChangeAction,
  name: nameProp,
  form,
  required = false,
  disabled = false,
  className,
  style,
  children,
  render,
  ...rest
}: RadioGroupRootProps) {
  const fallbackName = useId();
  const name = nameProp ?? fallbackName;
  const fieldsetRef = useRef<HTMLFieldSetElement | null>(null);
  const warnedElement = useRef(false);

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
  // Deliberately no warning when neither `value` nor `defaultValue` is given: an unchecked group
  // is the HTML default (design decision 2).

  /** What the user intends: the latest in-flight dispatch, else optimistic (conventions 3.8 rule 1). */
  const base = (): string | null => {
    const inFlight = latestInFlight();
    // Not `?.next ?? optimistic`: an in-flight reset to `null` is a real intent.
    return inFlight === null ? optimistic : inFlight.next;
  };

  // The residual browser paths (design section 5): one dispatch per group, from here.
  useNativeGroupReconciliation<string | null>({
    element: fieldsetRef,
    readCurrent: () => readGroup(fieldsetRef.current, name, "checked"),
    readDefault: () => readGroup(fieldsetRef.current, name, "defaultChecked"),
    base,
    onPlatformChange: (next, event) =>
      dispatch(next, createActionDetails(event, { reason: "platform" })),
  });

  const libraryRef = useCallback((el: HTMLFieldSetElement) => {
    fieldsetRef.current = el;
    if (isDev && !warnedElement.current && el.tagName !== "FIELDSET") {
      warnedElement.current = true;
      console.error(
        `RadioGroup.Root: expected to render a <fieldset> element but got ` +
          `<${el.tagName.toLowerCase()}>. The platform semantics (legend naming, disabled ` +
          `inheritance, form reset) need a real <fieldset>.`,
      );
    }
    return () => {
      fieldsetRef.current = null;
    };
  }, []);

  const context: RadioGroupContextValue = {
    name,
    form,
    required,
    optimistic,
    pending,
    disabled,
    defaultValue: value === undefined ? (defaultValue ?? null) : undefined,
    select: (next, event) => {
      // No-op rule against the optimistic value (conventions 2.3 item 7, design 4.2).
      if (next === optimistic) return;
      dispatch(next, createActionDetails(event, { reason: "activate" }));
    },
  };

  const state: RadioGroupRootState = { value: optimistic, pending, disabled };

  const element = useRender<ComponentPropsWithRef<"fieldset">, RadioGroupRootState>({
    defaultElement: "fieldset",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: {
      role: "radiogroup",
      disabled,
      form,
      "data-pending": dataAttr(pending),
      "data-disabled": dataAttr(disabled),
    },
    ref: libraryRef,
  });

  return <RadioGroupContext value={context}>{element}</RadioGroupContext>;
}

RadioGroupRoot.displayName = "RadioGroupRoot";

"use client";
import {
  use,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode, RefObject } from "react";
import { useFormStatus } from "react-dom";
import { dataAttr } from "../internal/data-attr.js";
import { FieldContext, FormContext } from "../internal/field-context.js";
import type {
  FieldContextValue,
  FieldControlRegistration,
  FieldState,
  FormFieldRegistration,
} from "../internal/field-context.js";
import { collectInvalid } from "../internal/focus-first-invalid.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useFormOwnerEvent } from "../internal/use-form-owner-event.js";
import { useLatest } from "../internal/use-latest.js";
import { useRender } from "../internal/use-render.js";
import {
  arraysEqual,
  focusTargetOf,
  normaliseErrorValue,
  snapshotValidity,
  supportsUserInvalid,
  VALID,
  validityElementOf,
  validityEquals,
} from "../internal/validity.js";
import type { FieldErrorValue, FieldValidity, ValidatableElement } from "../internal/validity.js";

export type { FieldState } from "../internal/field-context.js";
export type { FieldValidity } from "../internal/validity.js";

const isDev = process.env.NODE_ENV !== "production";

/**
 * A custom constraint: receives the field's submitted value (`formData.get(name)` as a string,
 * `""` when absent) and the whole form's `FormData`. Return a message (or several) for an error,
 * `null` / `undefined` / `""` for none.
 */
export type FieldValidate = (value: string, formData: FormData) => FieldErrorValue;

export interface FieldRootProps extends Omit<
  ComponentPropsWithRef<"div">,
  "className" | "style" | "children"
> {
  /** Form field name: the control's default `name`, the key in `Form.Root errors`, and the entry `validate` reads. */
  name?: string;
  /** Disables the control (native `disabled`) and marks every part `data-disabled`. */
  disabled?: boolean;
  /** Makes the control `required` (native) and marks every part `data-required`. */
  required?: boolean;
  /**
   * A custom constraint, written into the control with `setCustomValidity`. Sync. Receives the
   * field's submitted value (`formData.get(name)` as a string, `""` when absent) and the whole
   * form's `FormData`, so a cross-field rule can read the other field. Runs at mount, on every
   * `input` / `change` in the form (and a FUNSTACK control's value change), on blur, after a
   * reset, on a submission attempt, and in every commit in which this prop changed identity, so
   * a rule that reads outside state (a list that loads, a sibling value in React state) updates
   * on render. An inline function therefore re-runs on every render of the Field; wrap it in
   * `useCallback` to re-run only when its inputs change. Return a string
   * or strings for an error, `null` / `undefined` / `""` for none. Shown when the platform's
   * `:user-invalid` heuristic says so, like a native constraint. Not serialisable: a Field with
   * `validate` is rendered from a client component.
   */
  validate?: FieldValidate;
  className?: StateValue<string | undefined, FieldState>;
  style?: StateValue<CSSProperties | undefined, FieldState>;
  children?: StateValue<ReactNode, FieldState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, FieldState>;
}

/** The urgent mirror of browser-owned validity (design 2.4). */
interface Mirror {
  readonly userInvalid: boolean;
  readonly validity: FieldValidity;
  readonly messages: readonly string[];
}

const NONE: readonly string[] = Object.freeze([]);
const INITIAL_MIRROR: Mirror = { userInvalid: false, validity: VALID, messages: NONE };

function mirrorEquals(a: Mirror, b: Mirror): boolean {
  return (
    a.userInvalid === b.userInvalid &&
    validityEquals(a.validity, b.validity) &&
    arraysEqual(a.messages, b.messages)
  );
}

/** `FormData` entries as comparable strings; a `File` counts as unchanged (design 3.2 item 2). */
function entryStrings(entries: readonly FormDataEntryValue[]): string[] {
  return entries.map((entry) => (typeof entry === "string" ? entry : "\u0000file"));
}

interface RefreshOptions {
  /** The user edited the control: the server message is dropped from the slot at once. */
  readonly dismiss?: boolean;
  /** After a form reset: the user-validity flag is clear again. */
  readonly reset?: boolean;
}

/**
 * The field: a `div` that owns the ids, the urgent validity mirror, the custom-validity slot
 * (`validate` and the server error), the control registration and the native listeners
 * (design/components/field-form.md 2, 14). `data-pending` is the enclosing form's submission
 * (`useFormStatus`), the one part that folds the form channel into its own state, because a
 * Field has no action of its own.
 *
 * Owned keys (conventions 1.2): `data-invalid`, `data-disabled`, `data-required`, `data-pending`.
 */
export function FieldRoot({
  name,
  disabled = false,
  required = false,
  validate,
  className,
  style,
  children,
  render,
  ...rest
}: FieldRootProps) {
  const parent = use(FieldContext);
  const form = use(FormContext);
  useDevWarning(
    parent !== null,
    "Field.Root: nested inside another Field.Root. A control registers with the nearest Field " +
      "only; give each control its own, sibling Field.",
  );
  useDevWarning(
    validate !== undefined && name === undefined,
    "Field.Root: `validate` without `name`. `validate` receives `formData.get(name)`, which is " +
      'always "" without a name.',
  );

  const id = useId();
  const ids = useMemo(
    () => ({
      control: `${id}-control`,
      label: `${id}-label`,
      description: `${id}-description`,
      error: `${id}-error`,
    }),
    [id],
  );

  const { pending: formPending } = useFormStatus();

  // --- Registration -------------------------------------------------------------------------

  const controlRef = useRef<FieldControlRegistration | null>(null);
  const [control, setControl] = useState<FieldControlRegistration | null>(null);
  const warnedTwoControls = useRef(false);
  const registerControl = useCallback((registration: FieldControlRegistration) => {
    const current = controlRef.current;
    if (current !== null && current.element !== registration.element) {
      if (isDev && !warnedTwoControls.current) {
        warnedTwoControls.current = true;
        console.error(
          "Field.Root: two form controls registered in one Field. The first one is the " +
            "Field's control; give each control its own Field.Root.",
        );
      }
      return () => {};
    }
    controlRef.current = registration;
    setControl(registration);
    return () => {
      if (controlRef.current !== registration) return;
      controlRef.current = null;
      setControl(null);
    };
  }, []);

  const errorCount = useRef(0);
  const registerError = useCallback(() => {
    errorCount.current += 1;
    if (isDev && errorCount.current === 2) {
      console.error(
        "Field.Error: two Field.Error parts in one Field.Root. Render one; its function " +
          "`children` receives `validity` for per-constraint wording.",
      );
    }
    return () => {
      errorCount.current -= 1;
    };
  }, []);

  // --- Server errors: shown, dismissed, re-armed, suppressed (design 3.4) -------------------

  const errors = form?.errors;
  const serverMessages = useMemo(
    () => normaliseErrorValue(name === undefined ? undefined : errors?.[name]),
    [errors, name],
  );
  const serverKey = serverMessages.join("\n");
  /** The user edited the control since the last settled submission. */
  const [dismissed, setDismissed] = useState(false);
  /**
   * The errors shown now answer a value the user had already changed during their flight
   * (intercepted path). Fixed from one settle to the next, so a hidden stale error stays hidden
   * while the next submission is in flight (the `errors` prop still holds that result).
   */
  const [suppressed, setSuppressed] = useState(false);
  /** The user changed the value during the flight in progress: becomes `suppressed` at its settle. */
  const [suppressNext, setSuppressNext] = useState(false);
  // The settle edge of the enclosing form, seen in the render that commits the result (the
  // action's result and `useFormStatus`'s NotPending land together), so the next submission's
  // errors are shown in that same commit, before the Form's settle effect focuses them.
  const [previousFormPending, setPreviousFormPending] = useState(formPending);
  if (previousFormPending !== formPending) {
    setPreviousFormPending(formPending);
    if (formPending) {
      setSuppressNext(false);
    } else {
      setDismissed(false);
      setSuppressed(suppressNext);
      setSuppressNext(false);
    }
  }
  const serverShown = serverMessages.length > 0 && !dismissed && !suppressed;

  // --- The mirror -----------------------------------------------------------------------------

  const [mirror, setMirror] = useState<Mirror>(INITIAL_MIRROR);
  /** The last mirror written: `refresh` compares against it, so an unchanged read renders nothing. */
  const mirrorRef = useRef<Mirror>(INITIAL_MIRROR);
  /** jsdom fallback for `:user-invalid` (design 2.2): `invalid` fired, cleared by a reset. */
  const attempted = useRef(false);
  /** The element the slot was last written on (a group's first member can change). */
  const slotElement = useRef<ValidatableElement | null>(null);

  const latest = useLatest({ name, validate, serverMessages, serverShown, formPending, form });

  /** Re-reads the slot and the mirror; returns the messages the Field shows for the control. */
  const refresh = useCallback(
    (options: RefreshOptions = {}): readonly string[] => {
      const registration = controlRef.current;
      if (registration === null) return NONE;
      const el = validityElementOf(registration.element);
      if (el === null) return NONE;
      const { name, validate, serverMessages, serverShown, formPending, form } = latest.current;

      const owner = el.form;
      const formData = owner === null ? new FormData() : new FormData(owner);
      const entry = name === undefined ? null : formData.get(name);
      const value = typeof entry === "string" ? entry : "";
      const custom = validate === undefined ? NONE : normaliseErrorValue(validate(value, formData));

      // The slot (design 2.1): the server message while shown, else `validate`'s.
      const showServer = serverShown && options.dismiss !== true;
      if (slotElement.current !== null && slotElement.current !== el) {
        slotElement.current.setCustomValidity("");
      }
      slotElement.current = el;
      el.setCustomValidity(showServer ? serverMessages.join("\n") : custom.join("\n"));

      if (options.reset === true) attempted.current = false;
      const userInvalid = supportsUserInvalid()
        ? el.matches(":user-invalid")
        : attempted.current && !el.validity.valid;
      const validity = snapshotValidity(el.validity);
      const messages = validity.valid
        ? NONE
        : validity.customError && !showServer && custom.length > 0
          ? custom
          : el.validationMessage === ""
            ? NONE
            : [el.validationMessage];
      const next: Mirror = { userInvalid, validity, messages };
      // Only a change schedules a render (a `focusout` with nothing new causes none).
      if (!mirrorEquals(mirrorRef.current, next)) {
        mirrorRef.current = next;
        setMirror(next);
      }

      // Stale-value suppression (design 3.2 item 2): while the Form's own submission is in
      // flight, an error is about the value it sent; compare with what the field holds now.
      const submitted = formPending && name !== undefined ? (form?.submittedData() ?? null) : null;
      if (submitted !== null && name !== undefined) {
        setSuppressNext(
          !arraysEqual(entryStrings(formData.getAll(name)), entryStrings(submitted.getAll(name))),
        );
      }
      return showServer ? serverMessages : messages;
    },
    [latest],
  );

  // The slot follows the server error and `validate` (and is written once the control is known).
  // Keyed on `validate`'s identity (design 2.1): a rule reading outside state updates in the
  // commit that changed it. An inline function re-runs on every render (documented: `useCallback`
  // avoids it); the form's own values are covered by the listeners below.
  useLayoutEffect(() => {
    refresh();
  }, [refresh, control, serverShown, serverKey, validate]);

  // Clear the slot when the control goes away (it may be reused outside the Field).
  useLayoutEffect(
    () => () => {
      slotElement.current?.setCustomValidity("");
      slotElement.current = null;
    },
    [],
  );

  // The control's own events (capture, so a group's members are seen on its fieldset).
  const element = control?.element ?? null;
  useLayoutEffect(() => {
    if (element === null) return;
    const onEdit = () => {
      setDismissed(true);
      refresh({ dismiss: true });
    };
    const onBlur = () => refresh();
    const onInvalid = (event: Event) => {
      const target = event.target as ValidatableElement;
      // A submission attempt sets user validity before validating; `checkValidity()` and
      // `reportValidity()` do not (design 2.5). The fallback cannot tell them apart.
      const attempt = supportsUserInvalid() ? target.matches(":user-invalid") : true;
      if (!supportsUserInvalid()) attempted.current = true;
      if (attempt && errorCount.current > 0) {
        event.preventDefault();
        const messages = refresh();
        collectInvalid(focusTargetOf(element), messages.join(" "));
        return;
      }
      refresh();
    };
    element.addEventListener("input", onEdit, true);
    element.addEventListener("change", onEdit, true);
    element.addEventListener("focusout", onBlur, true);
    element.addEventListener("invalid", onInvalid, true);
    return () => {
      element.removeEventListener("input", onEdit, true);
      element.removeEventListener("change", onEdit, true);
      element.removeEventListener("focusout", onBlur, true);
      element.removeEventListener("invalid", onInvalid, true);
    };
  }, [element, refresh]);

  // The form owner's events: another field's edit re-runs `validate` (cross-field rules); a reset
  // clears the user-validity flag, re-read when the controls hold their reset values.
  const ownerRef = useMemo<RefObject<Element | null>>(
    () => ({
      get current() {
        return controlRef.current?.element ?? null;
      },
      set current(_ignored) {},
    }),
    [],
  );
  const onOwnerEdit = (event: Event) => {
    const target = event.target;
    if (target instanceof Node && controlRef.current?.element.contains(target) === true) return;
    refresh();
  };
  useFormOwnerEvent(ownerRef, "input", onOwnerEdit);
  useFormOwnerEvent(ownerRef, "change", onOwnerEdit);
  // A new submission sends the current values: nothing differs from it yet (a queued second
  // submit arrives while the status stays pending, so the pending edge alone would miss it).
  useFormOwnerEvent(ownerRef, "submit", () => {
    setSuppressNext(false);
  });
  useFormOwnerEvent(ownerRef, "reset", (event) => {
    queueMicrotask(() => {
      if (event.defaultPrevented) return;
      refresh({ reset: true });
    });
  });

  // Registration with the Form, for the first-error focus after a settle (design 3.5) and the
  // refresh of the other Fields on a change no DOM event carried.
  const registerField = form?.registerField;
  const formRegistration = useRef<FormFieldRegistration | null>(null);
  useLayoutEffect(() => {
    if (registerField === undefined) return;
    const registration: FormFieldRegistration = {
      getFocusTarget: () => focusTargetOf(controlRef.current?.element ?? null),
      showsServerError: () => latest.current.serverShown,
      serverMessages: () => latest.current.serverMessages,
      refresh: () => {
        refresh();
      },
    };
    formRegistration.current = registration;
    const unregister = registerField(registration);
    return () => {
      unregister();
      if (formRegistration.current === registration) formRegistration.current = null;
    };
  }, [registerField, latest, refresh]);

  const notifyChange = useCallback(
    (edit: boolean) => {
      if (edit) setDismissed(true);
      refresh(edit ? { dismiss: true } : {});
      latest.current.form?.refreshFields(formRegistration.current);
    },
    [refresh, latest],
  );

  // Development: a Field around something that is not a form control (Toggle, Menu, ...).
  useEffect(() => {
    if (!isDev || controlRef.current !== null) return;
    console.error(
      "Field.Root: no form control registered. Render a Field.Control or a FUNSTACK form " +
        "control (Checkbox, Switch, RadioGroup, CheckboxGroup, Select, Combobox) inside it.",
    );
  }, []);

  const invalid = mirror.userInvalid || serverShown;
  const messages = serverShown ? serverMessages : mirror.userInvalid ? mirror.messages : NONE;
  const validity = mirror.validity;
  const stateDisabled = disabled || (control?.disabled ?? false);
  const stateRequired = required || (control?.required ?? false);
  // Memoised: the context value (and so every part) changes only with the state.
  const memoState = useMemo<FieldState>(
    () => ({
      invalid,
      messages,
      validity,
      disabled: stateDisabled,
      required: stateRequired,
      pending: formPending,
    }),
    [invalid, messages, validity, stateDisabled, stateRequired, formPending],
  );

  const labelable = control?.labelable ?? true;
  const context = useMemo<FieldContextValue>(
    () => ({
      ids,
      name,
      disabled,
      required,
      state: memoState,
      labelable,
      registerControl,
      registerError,
      notifyChange,
    }),
    [
      ids,
      name,
      disabled,
      required,
      memoState,
      labelable,
      registerControl,
      registerError,
      notifyChange,
    ],
  );

  const element$ = useRender<ComponentPropsWithRef<"div">, FieldState>({
    defaultElement: "div",
    render,
    state: memoState,
    className,
    style,
    children,
    props: rest,
    libraryProps: fieldDataAttributes(memoState),
  });

  return <FieldContext value={context}>{element$}</FieldContext>;
}

FieldRoot.displayName = "FieldRoot";

/** The four state attributes every Field part renders (design 6.1). */
export function fieldDataAttributes(state: FieldState) {
  return {
    "data-invalid": dataAttr(state.invalid),
    "data-disabled": dataAttr(state.disabled),
    "data-required": dataAttr(state.required),
    "data-pending": dataAttr(state.pending),
  };
}

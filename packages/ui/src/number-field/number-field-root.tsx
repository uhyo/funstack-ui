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
import { announce as speak } from "../internal/announce.js";
import { dataAttr } from "../internal/data-attr.js";
import { consumeEscape, isComposingKey, isEscapeRequest } from "../internal/escape-key.js";
import { FieldContext } from "../internal/form/field-context.js";
import { mergeTokenLists } from "../internal/merge-props.js";
import { transitionTypes } from "../internal/transition-types.js";
import type {
  ActionDetails,
  ChangeAction,
  ChangeReason,
  RenderProp,
  StateValue,
} from "../internal/types.js";
import { resolveFieldDefaults, useFieldValueChange } from "../internal/form/use-field-control.js";
import type { FormAssociatedElement } from "../internal/form/use-form-owner-event.js";
import { useLatest } from "../internal/use-latest.js";
import { syncValueTracker } from "../internal/form/sync-value-tracker.js";
import { useResetTarget } from "../internal/form/use-form-reset.js";
import { useNextValidity } from "../internal/form/use-next-validity.js";
import { nativeValid } from "../internal/form/validity.js";
import { useRegisterCount } from "../internal/use-register-count.js";
import { useNativeGroupReconciliation } from "../internal/form/use-native-group-reconciliation.js";
import { useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { useStepCommit } from "../internal/action/use-step-commit.js";
import { keyStep, stepValue } from "./number-field-arithmetic.js";
import type { StepBounds } from "./number-field-arithmetic.js";
import { NumberFieldContext } from "./number-field-context.js";
import type {
  NumberFieldContextValue,
  NumberFieldSource,
  StepDirection,
} from "./number-field-context.js";
import { createNumberFormatter, formatKey } from "./number-field-format.js";
import type { NumberFormatter } from "./number-field-format.js";
import { useNumberFieldDevWarnings } from "./use-number-field-dev-warnings.js";

/** Details passed as the second argument of `valueChangeAction` (a step). */
export interface NumberFieldValueChangeDetails extends ActionDetails {
  /**
   * `"activate"`: the user typed, pressed a key, a button or turned the wheel (`details.event` is
   * the `focusout` / Enter `keydown` of a typed value, the `keydown` of a key, the `pointerdown` /
   * `pointerup` of a button (`undefined` for the repeats of a held button and for a hold that
   * ended at its bound), the `wheel` event). `"platform"`: a form reset (the `reset`
   * event) or text typed before hydration (`undefined`). `"dismiss"`: the commit action rejected
   * and the field reverted to the committed value (uncontrolled; `valueChangeAction` only).
   */
  readonly reason: ChangeReason;
  /** What produced the value: typed text, a button, a key, the wheel; `null` for "platform" and "dismiss". */
  readonly source: NumberFieldSource | null;
  /**
   * The field would be valid holding this value: its native constraints (`required`, `min`,
   * `max`, `step`) and, inside a Field, `validate`. Not a server error. Information only: the
   * action is called either way (conventions 2.2). Uncontrolled, an invalid typed value is not
   * written: the text stays a draft and the saved value stays (conventions 3.3.1).
   */
  readonly valid: boolean;
}

/**
 * Details passed as the second argument of `valueCommitAction`: a type of its own, as Slider's
 * (conventions 9.4). Never `"dismiss"`.
 */
export interface NumberFieldValueCommitDetails extends ActionDetails {
  /**
   * `"activate"`: the user committed a gesture (a typed value's blur or Enter, a hold's release,
   * a key press, a wheel event). `"platform"`: a form reset (the `reset` event) or text typed
   * before hydration (`undefined`).
   */
  readonly reason: ChangeReason;
  /** What produced the value: typed text, a button, a key, the wheel; `null` for "platform". */
  readonly source: NumberFieldSource | null;
  /**
   * The field would be valid holding this value: its native constraints (`required`, `min`,
   * `max`, `step`) and, inside a Field, `validate`. Not a server error. Information only: the
   * action is called either way (conventions 2.2). Uncontrolled, an invalid typed value is not
   * written: the text stays a draft and the saved value stays (conventions 3.3.1).
   */
  readonly valid: boolean;
}

/** The state every NumberField part's function props receive (one object, Field's precedent). */
export interface NumberFieldState {
  /** The shown value: the gesture's value while one is open or in flight, else the optimistic value; `null` when empty. */
  readonly value: number | null;
  /** The shown text: the draft while the user is editing, else `value` formatted. */
  readonly text: string;
  /** A step or commit dispatched through this NumberField is in flight. */
  readonly pending: boolean;
  /** The `disabled` prop, or the enclosing Field's. */
  readonly disabled: boolean;
  /** The `readOnly` prop. */
  readonly readOnly: boolean;
  /** The `required` prop, or the enclosing Field's. */
  readonly required: boolean;
  /**
   * Inside a `Field.Root`: an error is shown for the field (`data-invalid` on the Root and the
   * Input). `false` outside.
   */
  readonly invalid: boolean;
}

/** State of `NumberField.Root` (conventions 9.4). */
export type NumberFieldRootState = NumberFieldState;
/** State of `NumberField.Input`. */
export type NumberFieldInputState = NumberFieldState;
/** State of `NumberField.Label`. */
export type NumberFieldLabelState = NumberFieldState;

/**
 * Props of `NumberField.Root`.
 *
 * @see https://ui.funstack.work/components/number-field
 */
export interface NumberFieldRootProps extends Omit<
  ComponentPropsWithRef<"div">,
  "defaultValue" | "role" | "className" | "style" | "children"
> {
  /** Controlled value; `null` is empty, `undefined` uncontrolled. */
  value?: number | null;
  /**
   * Initial value in uncontrolled mode, and its form-reset target (latest).
   *
   * @defaultValue `null` (empty)
   */
  defaultValue?: number | null;
  /**
   * Runs inside the Root's step transition on every step: the parse of typed text at commit,
   * each key press, each tick of a hold, each wheel event, each platform change, and the revert
   * after a rejected commit (`reason: "dismiss"`, uncontrolled). Keep it cheap: adopt the value
   * (`setValue(next)` in the sync prefix is a transition update), start a deferred render.
   */
  valueChangeAction?: ChangeAction<number | null, NumberFieldValueChangeDetails>;
  /**
   * Runs inside the Root's commit transition once per gesture: a typed text's blur or Enter, a
   * hold's release, each key press, each wheel event, a form reset, text typed before hydration.
   * Where the save goes; uncontrolled state is committed when it resolves and reverts when it
   * rejects. May be a Server Function.
   */
  valueCommitAction?: ChangeAction<number | null, NumberFieldValueCommitDetails>;
  /** Native `min` on the hidden input (a constraint) and the lower bound of stepping. */
  min?: number;
  /** Native `max` on the hidden input (a constraint) and the upper bound of stepping. */
  max?: number;
  /**
   * Native `step` and the stepping grid from `min` (else `0`).
   *
   * @defaultValue `1`, or `0.01` when `format.style` is `"percent"`
   */
  step?: number;
  /**
   * The step of PageUp / PageDown and Shift+Arrow.
   *
   * @defaultValue `10 × step`
   */
  largeStep?: number;
  /**
   * `Intl.NumberFormatOptions` for the text: `style` `"decimal"` (default), `"percent"`,
   * `"currency"` (with `currency`), `"unit"` (with `unit`); fraction digits, grouping, sign
   * display. `notation: "compact"` is a dev warning (unparsable).
   */
  format?: Intl.NumberFormatOptions;
  /**
   * BCP 47 tag(s). Pass the page's `lang`; a dev warning fires when
   * `document.documentElement.lang` disagrees and this prop is absent.
   *
   * @defaultValue the runtime's locale (`Intl.NumberFormat().resolvedOptions().locale`)
   */
  locale?: string | readonly string[];
  /**
   * Step with the mouse wheel while the input is focused.
   *
   * @defaultValue `false`
   */
  stepOnWheel?: boolean;
  /**
   * Native `name` on the hidden input.
   *
   * @defaultValue the Field's `name` inside a `Field.Root`
   */
  name?: string;
  /** Native `form` on the hidden input. */
  form?: string;
  /**
   * Disables both inputs and the buttons; inherited by every part.
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
  /**
   * Native `readonly` on both inputs; no stepping (buttons disabled, keys and wheel inert).
   *
   * @defaultValue `false`
   */
  readOnly?: boolean;
  /**
   * Native `required` on the hidden input (empty is `valueMissing`); or the Field's.
   *
   * @defaultValue `false`
   */
  required?: boolean;
  /**
   * What is announced (`ariaNotify()`) after a key press, a wheel event, a click activation and a
   * hold's release. Return `null` to announce nothing.
   *
   * @defaultValue `(_, state) => state.text`
   */
  announce?: (value: number | null, state: NumberFieldState) => string | null;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, NumberFieldState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, NumberFieldState>;
  /** The parts. The function form receives the state. */
  children?: StateValue<ReactNode, NumberFieldState>;
  /** Replace the default `<div>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"div">, NumberFieldState>;
}

const STEP_TYPES = transitionTypes("number-field", "change");
const COMMIT_TYPES = transitionTypes("number-field", "commit");

/** A finite number, or `null` (`NaN` / `Infinity` are treated as empty). */
function sanitize(value: number | null | undefined): number | null | undefined {
  if (value === undefined || value === null) return value;
  return Number.isFinite(value) ? value : null;
}

/** The `details` fields of both actions. */
interface NumberFieldDetailsFields {
  readonly reason: ChangeReason;
  readonly source: NumberFieldSource | null;
  readonly valid: boolean;
}

function identity(value: number | null): number | null {
  return value;
}

/**
 * A typed draft that was invalid at its commit and stays a draft (uncontrolled, conventions
 * 3.3.1): its text and the number the hidden input holds for it. One object per invalid commit,
 * so a rejection drops only the draft it was dispatched for.
 */
interface KeptDraft {
  readonly text: string;
  readonly value: number | null;
}

/** The hidden input's value for `value`. */
function hiddenText(value: number | null): string {
  return value === null ? "" : String(value);
}

/**
 * Mount reconciliation's read of the visible input (design 4.5): the value the hydrated text
 * means. The client's own formatting of `current` is `current`. Focused text is still being typed
 * (even a partial `12,` or `-`): handed to `adoptDraft`, never overwritten under the caret; the
 * blur commits or reverts it by the ordinary rule. Otherwise the parsed text, or, for another
 * locale's formatting of the same value or text that is no number, `current` with the client's
 * text written back (react-dom kept the hydrated DOM value).
 */
function readVisible(
  visible: HTMLInputElement | null,
  current: number | null,
  formatter: NumberFormatter,
  adoptDraft: (text: string) => void,
): number | null {
  if (visible === null) return current;
  const domText = visible.value;
  if (domText === formatter.format(current)) return current;
  if (visible.ownerDocument.activeElement === visible) {
    adoptDraft(domText);
    return current;
  }
  const parsed = formatter.parse(domText);
  if (parsed === undefined || Object.is(parsed, current)) {
    visible.value = formatter.format(current);
    return current;
  }
  return parsed;
}

/**
 * Owns the number field's state (design/components/number-field.md 2): the committed value
 * through `useControllableAction` with `valueCommitAction` (once per gesture), each step through
 * its own transition (`valueChangeAction`), the urgent draft text, the urgent value of the open
 * gesture (`live`), the press-and-hold, the formatter and parser, the announcements, mount
 * reconciliation and form reset (through the hidden input the Input renders).
 *
 * Owned keys (conventions 1.2): `role="group"`, `data-pending`, `data-disabled`, `data-invalid`
 * (inside a Field). The group has no name of its own (design 1); a consumer's `aria-label` or
 * `aria-labelledby` passes through. The label names the Increment and Decrement buttons instead
 * (design 8.4).
 *
 * @see https://ui.funstack.work/components/number-field
 */
export function NumberFieldRoot(props: NumberFieldRootProps) {
  const {
    value: valueProp,
    defaultValue: defaultValueProp,
    valueChangeAction,
    valueCommitAction,
    min,
    max,
    step: stepProp,
    largeStep: largeStepProp,
    format,
    locale,
    stepOnWheel = false,
    name: nameProp,
    form,
    disabled: disabledProp = false,
    readOnly: readOnlyProp = false,
    required: requiredProp = false,
    announce,
    className,
    style,
    children,
    render,
    ...rest
  } = props;

  const value = sanitize(valueProp);
  const defaultValue = sanitize(defaultValueProp);

  // --- Format, bounds -----------------------------------------------------------------------

  const key = formatKey(format);
  const localeKey = locale === undefined ? "" : JSON.stringify(locale);
  // Memoised on the content of `format` and `locale`, not their identity (an inline object).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const formatter = useMemo(() => createNumberFormatter(locale, format), [localeKey, key]);
  const defaultStep = formatter.percent ? 0.01 : 1;
  const stepValid = stepProp === undefined || (Number.isFinite(stepProp) && stepProp > 0);
  const stepSize = stepProp !== undefined && stepValid ? stepProp : defaultStep;
  const largeStepValid =
    largeStepProp === undefined || (Number.isFinite(largeStepProp) && largeStepProp > 0);
  const largeStep = largeStepProp !== undefined && largeStepValid ? largeStepProp : 10 * stepSize;
  const bounds = useMemo<StepBounds>(
    () => ({
      min: Number.isFinite(min) ? min : undefined,
      max: Number.isFinite(max) ? max : undefined,
      step: stepSize,
    }),
    [min, max, stepSize],
  );

  // --- Field ----------------------------------------------------------------------------------

  // NumberField.Input registers the control (design 7.1); the Root only resolves the defaults.
  const fieldContext = use(FieldContext);
  const { disabled, required, readOnly, name } = resolveFieldDefaults(fieldContext, {
    name: nameProp,
    disabled: disabledProp,
    required: requiredProp,
    readOnly: readOnlyProp,
  });
  const fieldInvalid = fieldContext === null ? undefined : fieldContext.state.invalid;

  const id = useId();
  const inputId = fieldContext?.ids.control ?? `${id}-input`;
  const labelId = `${id}-label`;

  // --- State (design 2) -----------------------------------------------------------------------

  const [draft, setDraft] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);
  const [kept, setKept] = useState<KeptDraft | null>(null);
  const keptRef = useRef<KeptDraft | null>(null);
  const [hold, setHold] = useState<StepDirection | null>(null);
  /** The value the next tick of a hold steps from. */
  const holdBase = useRef<number | null>(null);
  const holdRef = useRef<StepDirection | null>(null);
  const visibleRef = useRef<HTMLInputElement | null>(null);
  const hiddenRef = useRef<HTMLInputElement | null>(null);

  const nextValidity = useNextValidity();

  /** Ends a kept draft (conventions 3.3.1): the hidden input returns to the shown value. */
  const dropKept = useCallback(() => {
    if (keptRef.current === null) return;
    keptRef.current = null;
    setKept(null);
  }, []);

  const clearDraft = useCallback(() => {
    if (draftRef.current === null) return;
    draftRef.current = null;
    setDraft(null);
    dropKept();
  }, [dropKept]);

  /**
   * Writes `next` into the hidden input, then mirrors its validity onto the visible input, which
   * is invalid exactly when the hidden one is (6.2).
   */
  const syncHidden = useCallback((next: number | null) => {
    const hidden = hiddenRef.current;
    if (hidden !== null) {
      const text = hiddenText(next);
      if (hidden.value !== text) hidden.value = text;
    }
    const visible = visibleRef.current;
    if (hidden === null || visible === null) return;
    const message = hidden.validationMessage;
    if (visible.validationMessage !== message) visible.setCustomValidity(message);
  }, []);

  // The step and commit core (design 2.4), shared with Slider.
  const {
    shown,
    shownRef,
    optimistic,
    pending,
    pendingSource,
    step,
    commit,
    commitStateless,
    openGesture,
    captureGesture,
    takeEdit,
  } = useStepCommit<
    number | null,
    number | null,
    NumberFieldSource | null,
    NumberFieldDetailsFields
  >({
    controlled: value,
    defaultValue,
    initialValue: null,
    stepAction: valueChangeAction,
    commitAction: valueCommitAction,
    stepTypes: STEP_TYPES,
    commitTypes: COMMIT_TYPES,
    warn: { component: "NumberField.Root", prop: "value" },
    toShown: identity,
    fromShown: identity,
    equals: Object.is,
    // `details.valid` (field-form.md 7.5): every step, the typed-text commit included, writes the
    // hidden input in `onStep` before its dispatch, and the hidden input still holds the value
    // when the gesture's commit follows; the native half is read there (a script-set value is
    // checked against `min`, `max`, `step` and `required`).
    details: (reason, source) => {
      const hidden = hiddenRef.current;
      return { reason, source, valid: nextValidity(hidden === null || nativeValid(hidden), null) };
    },
    captured: hold !== null,
    // What the text can show is what the form posts (5.4): a step finer than the format's
    // digits is rounded like a typed value.
    normalize: (next) => (next === null ? next : formatter.round(next)),
    // A step clears the draft and writes the hidden input synchronously (section 6).
    onStep: (next) => {
      clearDraft();
      syncHidden(next);
    },
    // `announceValue` is declared below; this runs in an event, long after the render.
    onCommit: (next, source, reason) => {
      if (reason === "activate" && source !== "input" && source !== null) announceValue(next);
    },
  });

  const text = draft ?? formatter.format(shown);
  // The value a button press steps from (4.3 step 3): the parsed draft while one is open.
  const parsedDraft = draft === null ? undefined : formatter.parse(draft);
  const stepBase = parsedDraft === undefined ? shown : parsedDraft;

  const invalid = fieldInvalid === true;
  const state = useMemo<NumberFieldState>(
    () => ({ value: shown, text, pending, disabled, readOnly, required, invalid }),
    [shown, text, pending, disabled, readOnly, required, invalid],
  );

  // A step, a key and a typed commit fire no `input` / `change` on the element the Field hears
  // for the value (the hidden input is written by script): tell it at the commit (design 7.2).
  // A kept draft writes the hidden input with no committed value either (conventions 3.3.1).
  useFieldValueChange(kept ?? optimistic, takeEdit);

  const latest = useLatest({
    uncontrolled: value === undefined,
    formatter,
    bounds,
    largeStep,
    disabled,
    readOnly,
    announce,
    state,
  });

  // --- Announcements (design 8.3) ---------------------------------------------------------------

  const announceValue = useCallback(
    (next: number | null) => {
      const visible = visibleRef.current;
      if (visible === null) return;
      const { announce: compose, formatter: f, state: s } = latest.current;
      const nextState: NumberFieldState = { ...s, value: next, text: f.format(next) };
      const message = compose === undefined ? nextState.text : compose(next, nextState);
      if (message !== null) speak(visible, message);
    },
    [latest],
  );

  /** The value a key or a button steps from: the parsed draft if one is open, else the shown value. */
  const resolveBase = useCallback((): number | null => {
    const open = draftRef.current;
    if (open !== null) {
      const parsed = latest.current.formatter.parse(open);
      clearDraft();
      if (parsed !== undefined) return parsed;
    }
    return shownRef.current;
  }, [clearDraft, latest, shownRef]);

  /** A one-step gesture: a key press, a wheel event, a click activation. */
  const oneStep = useCallback(
    (compute: (base: number | null) => number | null, source: NumberFieldSource, event: Event) => {
      const base = resolveBase();
      openGesture();
      step(compute(base), source, "activate", event);
      commit(source, "activate", event);
    },
    [commit, openGesture, resolveBase, step],
  );

  // --- Typing (design 4.1) ----------------------------------------------------------------------

  const typed = useCallback(
    (next: string) => {
      draftRef.current = next;
      setDraft(next);
      // An edit makes a kept draft an ordinary one again (conventions 3.3.1 rule 4).
      dropKept();
    },
    [dropKept],
  );

  const commitDraft = useCallback(
    (event: Event) => {
      const open = draftRef.current;
      if (open === null) return;
      const { uncontrolled, formatter: f, disabled: off, readOnly: ro } = latest.current;
      if (off || ro) {
        clearDraft();
        return;
      }
      const parsed = f.parse(open);
      // Unparsable: revert to the committed value's text, no dispatch, no error.
      if (parsed === undefined || Object.is(parsed, shownRef.current)) {
        clearDraft();
        return;
      }
      // An invalid typed value stays a draft, uncontrolled (conventions 3.3.1; design 4.1). The
      // hidden input is written first, so `details.valid` reads it (field-form.md 7.5).
      const next = parsed === null ? parsed : f.round(parsed);
      if (uncontrolled && !Object.is(next, shownRef.current)) {
        syncHidden(next);
        const hidden = hiddenRef.current;
        const valid = nextValidity(hidden === null || nativeValid(hidden), null);
        if (!valid) {
          // Rule 5: a kept draft that has not changed (an edit drops it) is not dispatched again.
          if (keptRef.current !== null) return;
          const token: KeptDraft = { text: open, value: next };
          keptRef.current = token;
          setKept(token);
          commitStateless(next, "input", "activate", event, () => {
            // Rule 6: a rejection drops the draft it was dispatched for, not a newer one, and the
            // hidden input returns to the shown value at once (the `"dismiss"` notice reads it).
            if (keptRef.current !== token) return false;
            clearDraft();
            syncHidden(shownRef.current);
            return true;
          });
          return;
        }
      }
      openGesture();
      step(parsed, "input", "activate", event);
      commit("input", "activate", event);
    },
    [
      clearDraft,
      commit,
      commitStateless,
      hiddenRef,
      latest,
      nextValidity,
      openGesture,
      shownRef,
      step,
      syncHidden,
    ],
  );

  // `disabled` or `readOnly` turning on ends a kept draft (conventions 3.3.1 rule 4); an open
  // draft is dropped by its commit (4.1).
  useLayoutEffect(() => {
    if ((disabled || readOnly) && keptRef.current !== null) clearDraft();
  }, [disabled, readOnly, clearDraft]);

  // --- Keyboard and wheel (design 4.2, 4.4) ----------------------------------------------------

  const keyDown = useCallback(
    (event: KeyboardEvent) => {
      const { disabled: off, readOnly: ro, bounds: b, largeStep: large } = latest.current;
      // WebKit fires `compositionend` before the confirming keydown, which then has
      // `isComposing === false` and `keyCode === 229` (Combobox's guard).
      if (off || ro || isComposingKey(event)) return;
      if (event.key === "Enter") {
        commitDraft(event);
        return;
      }
      if (event.key === "Escape") {
        // An edited draft is reverted and the key consumed (design 4.2, conventions 15): the
        // comparison is on the text the user sees.
        const open = draftRef.current;
        if (!isEscapeRequest(event) || open === null) return;
        if (open === latest.current.formatter.format(shownRef.current)) return;
        clearDraft();
        consumeEscape(event);
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const compute = keyStep(event.key, event.shiftKey, b, large);
      if (compute === null) return;
      event.preventDefault();
      oneStep(compute, "keyboard", event);
    },
    [clearDraft, commitDraft, latest, oneStep, shownRef],
  );

  const wheel = useCallback(
    (event: WheelEvent) => {
      const { disabled: off, readOnly: ro, bounds: b } = latest.current;
      const visible = visibleRef.current;
      if (off || ro || visible === null || event.deltaY === 0) return;
      // Only while the input is focused; unfocused, the page scrolls.
      if (visible.ownerDocument.activeElement !== visible) return;
      event.preventDefault();
      const n = event.deltaY < 0 ? 1 : -1;
      oneStep((v) => stepValue(v, n, b), "wheel", event);
    },
    [latest, oneStep],
  );

  // --- Buttons (design 4.3) ---------------------------------------------------------------------

  const endHold = useCallback(
    (direction: StepDirection, event: Event | undefined) => {
      if (holdRef.current !== direction) return;
      holdRef.current = null;
      setHold(null);
      commit(direction, "activate", event);
    },
    [commit],
  );

  const tickHold = useCallback(
    (direction: StepDirection, event: Event | undefined): boolean => {
      if (holdRef.current !== direction) return false;
      const { bounds: b } = latest.current;
      const n = direction === "increment" ? 1 : -1;
      const next = stepValue(holdBase.current, n, b);
      holdBase.current = next;
      step(next, direction, "activate", event);
      // At the bound: end the hold now, before the button re-renders disabled (a disabled
      // element may not deliver the release).
      if (stepValue(next, n, b) === next) {
        endHold(direction, event);
        return false;
      }
      return true;
    },
    [endHold, latest, step],
  );

  const beginHold = useCallback(
    (direction: StepDirection, event: Event): boolean => {
      const { disabled: off, readOnly: ro } = latest.current;
      if (off || ro || holdRef.current !== null) return false;
      const base = resolveBase();
      // A capture alone holds `live` on screen: start it from what is shown.
      captureGesture();
      holdBase.current = base;
      holdRef.current = direction;
      setHold(direction);
      return tickHold(direction, event);
    },
    [captureGesture, latest, resolveBase, tickHold],
  );

  const activate = useCallback(
    (direction: StepDirection, event: Event) => {
      const { disabled: off, readOnly: ro, bounds: b } = latest.current;
      if (off || ro || holdRef.current !== null) return;
      const n = direction === "increment" ? 1 : -1;
      oneStep((v) => stepValue(v, n, b), direction, event);
    },
    [latest, oneStep],
  );

  // --- Labels ---------------------------------------------------------------------------------

  const { count: labelCount, register: registerLabel } = useRegisterCount();
  // The label the step buttons append to their names (design 8.4): `NumberField.Label` while one
  // is mounted, then a Field's label.
  const buttonLabelIds = mergeTokenLists(
    labelCount > 0 ? labelId : undefined,
    fieldContext?.referencedIds.label,
  );

  // --- Residual browser paths: mount reconciliation and form reset (design 4.5, 6.4) ----------

  const resetTarget = useResetTarget(value, defaultValue) ?? null;
  const resetTargetText = hiddenText(resetTarget);

  const { onItemMounted } = useNativeGroupReconciliation<number | null>({
    element: hiddenRef as RefObject<FormAssociatedElement | null>,
    readCurrent: () =>
      readVisible(visibleRef.current, shownRef.current, formatter, (text) => {
        draftRef.current = text;
        setDraft(text);
      }),
    readDefault: () => {
      // The reset algorithm wrote the text past react-dom's value tracker (rule 6).
      syncValueTracker(visibleRef.current);
      // A reset clears an open draft whatever the target.
      clearDraft();
      return resetTarget;
    },
    base: () => shownRef.current,
    onPlatformChange: (next, event) => {
      openGesture();
      step(next, null, "platform", event);
      commit(null, "platform", event);
    },
    // Read-only (internal-hooks 3.8 rule 10): text restored by the browser is put back.
    readOnly,
    restore: () => {
      clearDraft();
      const visible = visibleRef.current;
      const text = formatter.format(shownRef.current);
      if (visible !== null && visible.value !== text) visible.value = text;
    },
    onResetEvent: () => {
      // react-dom rewrites a controlled text input's `defaultValue` after every update; the
      // visible text's reset target is written right before the reset algorithm reads it.
      const visible = visibleRef.current;
      if (visible !== null) visible.defaultValue = formatter.format(resetTarget);
    },
  });

  // --- Development warnings -------------------------------------------------------------------

  useNumberFieldDevWarnings({
    value: valueProp,
    defaultValue: defaultValueProp,
    min,
    max,
    bounds,
    stepValid,
    largeStepValid,
    formatter,
    locale,
  });

  // An unmount mid-hold leaves nothing behind (the buttons detach their own listeners).
  useEffect(
    () => () => {
      holdRef.current = null;
    },
    [],
  );

  // --- Render ---------------------------------------------------------------------------------

  const context = useMemo<NumberFieldContextValue>(
    () => ({
      state,
      bounds,
      stepBase,
      pendingSource: pending ? pendingSource : null,
      inputId,
      labelId,
      buttonLabelIds,
      name,
      form,
      allowsFractions: formatter.allowsFractions || !Number.isInteger(stepSize),
      stepOnWheel,
      resetTargetText,
      fieldInvalid,
      visibleRef,
      hiddenRef,
      typed,
      commitDraft,
      keyDown,
      wheel,
      beginHold,
      tickHold,
      endHold,
      activate,
      syncHidden,
      hiddenValue: kept === null ? shown : kept.value,
      registerLabel,
      onItemMounted,
    }),
    [
      state,
      bounds,
      stepBase,
      pending,
      pendingSource,
      inputId,
      labelId,
      buttonLabelIds,
      name,
      form,
      formatter,
      stepSize,
      stepOnWheel,
      resetTargetText,
      fieldInvalid,
      typed,
      commitDraft,
      keyDown,
      wheel,
      beginHold,
      tickHold,
      endHold,
      activate,
      syncHidden,
      kept,
      shown,
      registerLabel,
      onItemMounted,
    ],
  );

  const libraryProps: Partial<ComponentPropsWithRef<"div">> & DataAttributes = {
    role: "group",
    ...(fieldContext !== null ? { "data-invalid": dataAttr(fieldInvalid === true) } : {}),
    "data-pending": dataAttr(pending),
    "data-disabled": dataAttr(disabled),
    "data-readonly": dataAttr(readOnly),
  };

  const element = useRender<ComponentPropsWithRef<"div">, NumberFieldState>({
    defaultElement: "div",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps,
  });

  return <NumberFieldContext value={context}>{element}</NumberFieldContext>;
}

NumberFieldRoot.displayName = "NumberFieldRoot";

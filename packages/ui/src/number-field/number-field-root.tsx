"use client";
import {
  addTransitionType,
  use,
  useCallback,
  useEffect,
  useId,
  useInsertionEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode, RefObject } from "react";
import { createActionDetails } from "../internal/action-details.js";
import { announce as speak } from "../internal/announce.js";
import { dataAttr } from "../internal/data-attr.js";
import { FieldContext } from "../internal/field-context.js";
import { mergeTokenLists } from "../internal/merge-props.js";
import { transitionTypes } from "../internal/transition-types.js";
import type {
  ActionDetails,
  ChangeAction,
  ChangeReason,
  RenderProp,
  StateValue,
} from "../internal/types.js";
import { useActionTrigger } from "../internal/use-action-trigger.js";
import { useControllableAction } from "../internal/use-controllable-action.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useFieldValueChange } from "../internal/use-field-control.js";
import type { FormAssociatedElement } from "../internal/use-form-reset.js";
import { useLatest } from "../internal/use-latest.js";
import { useNativeGroupReconciliation } from "../internal/use-native-group-reconciliation.js";
import { useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { boundValue, stepBy, stepValue } from "./number-field-arithmetic.js";
import type { StepBounds } from "./number-field-arithmetic.js";
import { NumberFieldContext } from "./number-field-context.js";
import type {
  NumberFieldContextValue,
  NumberFieldSource,
  StepDirection,
} from "./number-field-context.js";
import { createNumberFormatter, formatKey } from "./number-field-format.js";

/** Details passed as the second argument of both NumberField actions. */
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
  readonly source: "input" | "increment" | "decrement" | "keyboard" | "wheel" | null;
}

/** The state every NumberField part's function props receive (one object, Field's precedent). */
export interface NumberFieldState {
  /** The shown value: the gesture's value while one is open or in flight, else the optimistic value; `null` when empty. */
  readonly value: number | null;
  /** The shown text: the draft while the user is editing, else `value` formatted. */
  readonly text: string;
  /** A step or commit dispatched through this NumberField is in flight. */
  readonly pending: boolean;
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly required: boolean;
}

export interface NumberFieldRootProps extends Omit<
  ComponentPropsWithRef<"div">,
  "defaultValue" | "role" | "className" | "style" | "children"
> {
  /** Controlled value; `null` is empty, `undefined` uncontrolled. */
  value?: number | null;
  /** Initial value in uncontrolled mode, and its form-reset target (latest). Default `null` (empty). */
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
  valueCommitAction?: ChangeAction<number | null, NumberFieldValueChangeDetails>;
  /** Native `min` on the hidden input (a constraint) and the lower bound of stepping. */
  min?: number;
  /** Native `max` on the hidden input (a constraint) and the upper bound of stepping. */
  max?: number;
  /** Native `step` and the stepping grid from `min` (else `0`). Default `1`, or `0.01` when `format.style` is `"percent"`. */
  step?: number;
  /** PageUp / PageDown and Shift+Arrow. Default `10 × step`. */
  largeStep?: number;
  /**
   * `Intl.NumberFormatOptions` for the text: `style` `"decimal"` (default), `"percent"`,
   * `"currency"` (with `currency`), `"unit"` (with `unit`); fraction digits, grouping, sign
   * display. `notation: "compact"` is a dev warning (unparsable).
   */
  format?: Intl.NumberFormatOptions;
  /**
   * BCP 47 tag(s). Default: the runtime's locale (`Intl.NumberFormat().resolvedOptions().locale`).
   * Pass the page's `lang`; a dev warning fires when `document.documentElement.lang` disagrees
   * and this prop is absent.
   */
  locale?: string | readonly string[];
  /** Step with the mouse wheel while the input is focused. Default `false`. */
  stepOnWheel?: boolean;
  /** Native `name` on the hidden input; defaults to the Field's `name` inside a `Field.Root`. */
  name?: string;
  /** Native `form` on the hidden input. */
  form?: string;
  /** Disables both inputs and the buttons; inherited by every part. */
  disabled?: boolean;
  /** Native `readonly` on both inputs; no stepping (buttons disabled, keys and wheel inert). */
  readOnly?: boolean;
  /** Native `required` on the hidden input (empty is `valueMissing`); or the Field's. */
  required?: boolean;
  /**
   * What is announced (`ariaNotify()`, else a live region) after a key press, a wheel event, a
   * click activation and a hold's release. Default: `(_, state) => state.text`. Return `null` to
   * announce nothing.
   */
  announce?: (value: number | null, state: NumberFieldState) => string | null;
  className?: StateValue<string | undefined, NumberFieldState>;
  style?: StateValue<CSSProperties | undefined, NumberFieldState>;
  children?: StateValue<ReactNode, NumberFieldState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, NumberFieldState>;
}

const isDev = process.env.NODE_ENV !== "production";

const STEP_TYPES = transitionTypes("number-field", "change");
const COMMIT_TYPES = transitionTypes("number-field", "commit");

/** A finite number, or `null` (`NaN` / `Infinity` are treated as empty). */
function sanitize(value: number | null | undefined): number | null | undefined {
  if (value === undefined || value === null) return value;
  return Number.isFinite(value) ? value : null;
}

/** The hidden input's value for `value`. */
export function hiddenText(value: number | null): string {
  return value === null ? "" : String(value);
}

function languageOf(tag: string): string {
  return tag.split("-")[0]?.toLowerCase() ?? "";
}

/**
 * Owns the number field's state (design/components/number-field.md 2): the committed value
 * through `useControllableAction` with `valueCommitAction` (once per gesture), each step through
 * its own transition (`valueChangeAction`), the urgent draft text, the urgent value of the open
 * gesture (`live`), the press-and-hold, the formatter and parser, the announcements, mount
 * reconciliation and form reset (through the hidden input the Input renders).
 *
 * Owned keys (conventions 1.2): `role="group"`, `aria-labelledby` (token-merged: the consumer's,
 * then `NumberField.Label`'s id while one is mounted, then a Field's label id), `data-pending`,
 * `data-disabled`, `data-invalid` (inside a Field).
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
    readOnly = false,
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

  const fieldContext = use(FieldContext);
  const disabled = disabledProp || (fieldContext?.disabled ?? false);
  const required = requiredProp || (fieldContext?.required ?? false);
  const name = nameProp ?? fieldContext?.name;
  const fieldInvalid = fieldContext === null ? undefined : fieldContext.state.invalid;

  const id = useId();
  const inputId = fieldContext?.ids.control ?? `${id}-input`;
  const labelId = `${id}-label`;

  // --- State (design 2) -----------------------------------------------------------------------

  const [draft, setDraft] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);
  /** The value the open gesture has reached (`null` inside: an empty value). */
  const [live, setLive] = useState<{ readonly value: number | null } | null>(null);
  const [hold, setHold] = useState<StepDirection | null>(null);
  const [stepHeld, setStepHeld] = useState(false);
  const [pendingSource, setPendingSource] = useState<NumberFieldSource>(null);

  const liveRef = useRef<number | null>(null);
  /** The shown value when the open gesture began; `null` when no gesture is open. */
  const gestureStart = useRef<{ readonly value: number | null } | null>(null);
  /** The value the next tick of a hold steps from. */
  const holdBase = useRef<number | null>(null);
  const holdRef = useRef<StepDirection | null>(null);
  const commitSeq = useRef(0);
  const lastReason = useRef<ChangeReason | null>(null);
  const shownRef = useRef<number | null>(null);
  const visibleRef = useRef<HTMLInputElement | null>(null);
  const hiddenRef = useRef<HTMLInputElement | null>(null);

  const clearDraft = useCallback(() => {
    if (draftRef.current === null) return;
    draftRef.current = null;
    setDraft(null);
  }, []);

  /** The visible input is invalid exactly when the hidden one is (6.2). */
  const mirror = useCallback(() => {
    const hidden = hiddenRef.current;
    const visible = visibleRef.current;
    if (hidden === null || visible === null) return;
    const message = hidden.validationMessage;
    if (visible.validationMessage !== message) visible.setCustomValidity(message);
  }, []);

  const writeHidden = useCallback(
    (next: number | null) => {
      const hidden = hiddenRef.current;
      if (hidden !== null) {
        const text = hiddenText(next);
        if (hidden.value !== text) hidden.value = text;
      }
      mirror();
    },
    [mirror],
  );

  const { pending: stepPending, run: runStep } = useActionTrigger();

  const runCommit = async (
    next: number | null,
    details: NumberFieldValueChangeDetails,
  ): Promise<void> => {
    const seq = ++commitSeq.current;
    try {
      await valueCommitAction?.(next, details);
    } catch (error) {
      // Design 2.4: in uncontrolled mode, tell the preview channel about the rollback, for the
      // latest commit only. Yield once to leave the commit's transition (conventions 2.6).
      if (valueProp === undefined && seq === commitSeq.current) {
        await undefined;
        // `step` and `committedRef` are declared below; this runs long after the render.
        step(committedRef.current, null, "dismiss", undefined);
      }
      throw error;
    }
  };

  const commitState = useControllableAction<number | null, NumberFieldValueChangeDetails>({
    controlled: value,
    defaultValue,
    initialValue: null,
    action: runCommit,
    transitionTypes: () => COMMIT_TYPES,
    warn: { component: "NumberField.Root", prop: "value" },
  });
  const { optimistic, committed, dispatch } = commitState;
  const committedRef = useLatest(committed);

  const held = hold !== null || stepHeld || stepPending || commitState.pending;
  const shown = held && live !== null ? live.value : optimistic;
  const pending = stepPending || commitState.pending;
  const text = draft ?? formatter.format(shown);
  // The value a button press steps from (4.3 step 3): the parsed draft while one is open.
  const parsedDraft = draft === null ? undefined : formatter.parse(draft);
  const stepBase = parsedDraft === undefined ? shown : parsedDraft;
  useInsertionEffect(() => {
    shownRef.current = shown;
  });

  const state = useMemo<NumberFieldState>(
    () => ({ value: shown, text, pending, disabled, readOnly, required }),
    [shown, text, pending, disabled, readOnly, required],
  );

  // A step, a key and a typed commit fire no `input` / `change` on the element the Field hears
  // for the value (the hidden input is written by script): tell it at the commit (design 7.2).
  useFieldValueChange(optimistic, () => {
    const edit = lastReason.current === "activate";
    lastReason.current = null;
    return edit;
  });

  const latest = useLatest({
    valueChangeAction,
    runStep,
    formatter,
    bounds,
    largeStep,
    disabled,
    readOnly,
    announce,
    state,
  });

  // --- Step and commit (design 2.4) -----------------------------------------------------------

  const step = useCallback(
    (
      next: number | null,
      source: NumberFieldSource,
      reason: ChangeReason,
      event: Event | undefined,
    ): boolean => {
      // What the text can show is what the form posts (5.4): a step finer than the format's
      // digits is rounded like a typed value.
      const { formatter: f } = latest.current;
      if (next !== null) next = f.round(next);
      // No-op against what the user sees (conventions 2.3 item 8).
      if (Object.is(next, shownRef.current)) return false;
      liveRef.current = next;
      shownRef.current = next;
      lastReason.current = reason;
      setLive({ value: next });
      clearDraft();
      setPendingSource(source);
      writeHidden(next);
      // A revert has no commit after it: the optimistic value already shows the committed one.
      if (reason !== "dismiss") setStepHeld(true);
      const { valueChangeAction: action, runStep: run } = latest.current;
      // Without a step action nothing runs and no transition starts (Slider M2).
      if (action === undefined) return true;
      run(() => {
        for (const type of STEP_TYPES) addTransitionType(type);
        return action(next, createActionDetails(event, { reason, source }));
      });
      return true;
    },
    [clearDraft, latest, writeHidden],
  );

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

  const commit = useCallback(
    (source: NumberFieldSource, reason: ChangeReason, event: Event | undefined): boolean => {
      const start = gestureStart.current;
      gestureStart.current = null;
      // The commit's own pending state holds `live` from here (set in this same batch).
      setStepHeld(false);
      const next = liveRef.current;
      // Nothing changed since the gesture began (a hold that returned to its start).
      if (start === null || Object.is(next, start.value)) return false;
      lastReason.current = reason;
      setPendingSource(source);
      dispatch(next, createActionDetails(event, { reason, source }));
      if (reason === "activate" && source !== "input" && source !== null) announceValue(next);
      return true;
    },
    [announceValue, dispatch],
  );

  /** Opens a gesture at the shown value. */
  const openGesture = useCallback(() => {
    gestureStart.current = { value: shownRef.current };
    liveRef.current = shownRef.current;
  }, []);

  /** The value a key or a button steps from: the parsed draft if one is open, else the shown value. */
  const resolveBase = useCallback((): number | null => {
    const open = draftRef.current;
    if (open !== null) {
      const parsed = latest.current.formatter.parse(open);
      clearDraft();
      if (parsed !== undefined) return parsed;
    }
    return shownRef.current;
  }, [clearDraft, latest]);

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

  const typed = useCallback((next: string) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  const commitDraft = useCallback(
    (event: Event) => {
      const open = draftRef.current;
      if (open === null) return;
      const { formatter: f, disabled: off, readOnly: ro } = latest.current;
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
      openGesture();
      step(parsed, "input", "activate", event);
      commit("input", "activate", event);
    },
    [clearDraft, commit, latest, openGesture, step],
  );

  // --- Keyboard and wheel (design 4.2, 4.4) ----------------------------------------------------

  const keyDown = useCallback(
    (event: KeyboardEvent) => {
      const { disabled: off, readOnly: ro, bounds: b, largeStep: large } = latest.current;
      // WebKit fires `compositionend` before the confirming keydown, which then has
      // `isComposing === false` and `keyCode === 229` (Combobox's guard).
      if (off || ro || event.isComposing || event.keyCode === 229) return;
      if (event.key === "Enter") {
        commitDraft(event);
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      let compute: ((base: number | null) => number | null) | null = null;
      switch (event.key) {
        case "ArrowUp":
          compute = event.shiftKey ? (v) => stepBy(v, large, b) : (v) => stepValue(v, 1, b);
          break;
        case "ArrowDown":
          compute = event.shiftKey ? (v) => stepBy(v, -large, b) : (v) => stepValue(v, -1, b);
          break;
        case "PageUp":
          compute = (v) => stepBy(v, large, b);
          break;
        case "PageDown":
          compute = (v) => stepBy(v, -large, b);
          break;
        case "Home": {
          // Shift+Home / Shift+End are text selection.
          if (event.shiftKey) break;
          const target = boundValue("min", b);
          if (target !== undefined) compute = () => target;
          break;
        }
        case "End": {
          if (event.shiftKey) break;
          const target = boundValue("max", b);
          if (target !== undefined) compute = () => target;
          break;
        }
        default:
          break;
      }
      if (compute === null) return;
      event.preventDefault();
      oneStep(compute, "keyboard", event);
    },
    [commitDraft, latest, oneStep],
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
      openGesture();
      // A capture alone holds `live` on screen: start it from what is shown.
      setLive({ value: shownRef.current });
      holdBase.current = base;
      holdRef.current = direction;
      setHold(direction);
      return tickHold(direction, event);
    },
    [latest, openGesture, resolveBase, tickHold],
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

  const [labelCount, setLabelCount] = useState(0);
  const registerLabel = useCallback(() => {
    setLabelCount((count) => count + 1);
    return () => setLabelCount((count) => count - 1);
  }, []);

  // --- Residual browser paths: mount reconciliation and form reset (design 4.5, 6.4) ----------

  const [mountValue] = useState(value);
  const resetTarget = (): number | null =>
    valueProp !== undefined ? (mountValue ?? null) : (defaultValue ?? null);
  const resetTargetText = hiddenText(resetTarget());

  const { onItemMounted } = useNativeGroupReconciliation<number | null>({
    element: hiddenRef as RefObject<FormAssociatedElement | null>,
    readCurrent: () => {
      const visible = visibleRef.current;
      const current = shownRef.current;
      if (visible === null) return current;
      const domText = visible.value;
      if (domText === formatter.format(current)) return current;
      if (visible.ownerDocument.activeElement === visible) {
        // Still typing (even a partial `12,` or `-`): adopted as the draft, never overwritten
        // under the caret. The blur commits it, or reverts it by the ordinary rule.
        draftRef.current = domText;
        setDraft(domText);
        return current;
      }
      const parsed = formatter.parse(domText);
      if (parsed === undefined || Object.is(parsed, current)) {
        // Another locale's formatting of the same value, or text that is no number: show the
        // client's text (react-dom kept the hydrated DOM value).
        visible.value = formatter.format(current);
        return current;
      }
      return parsed;
    },
    readDefault: () => {
      // A reset clears an open draft whatever the target.
      clearDraft();
      return resetTarget();
    },
    base: () => shownRef.current,
    onPlatformChange: (next, event) => {
      openGesture();
      step(next, null, "platform", event);
      commit(null, "platform", event);
    },
    onResetEvent: () => {
      // react-dom rewrites a controlled text input's `defaultValue` after every update; the
      // visible text's reset target is written right before the reset algorithm reads it.
      const visible = visibleRef.current;
      if (visible !== null) visible.defaultValue = formatter.format(resetTarget());
    },
  });

  // --- Development warnings -------------------------------------------------------------------

  useDevWarning(
    (valueProp !== undefined && valueProp !== null && !Number.isFinite(valueProp)) ||
      (defaultValueProp !== undefined &&
        defaultValueProp !== null &&
        !Number.isFinite(defaultValueProp)),
    "NumberField.Root: `value` / `defaultValue` must be a finite number or `null`; " +
      `got ${String(valueProp ?? defaultValueProp)}, treated as empty.`,
  );
  useDevWarning(
    bounds.min !== undefined && bounds.max !== undefined && bounds.min > bounds.max,
    `NumberField.Root: \`min\` (${String(min)}) is greater than \`max\` (${String(max)}).`,
  );
  useDevWarning(
    !stepValid || !largeStepValid,
    "NumberField.Root: `step` and `largeStep` must be positive numbers; using the defaults.",
  );
  useDevWarning(formatter.warning !== null, `NumberField.Root: ${formatter.warning ?? ""}`);
  const warnedLang = useRef(false);
  useEffect(() => {
    if (!isDev || warnedLang.current || locale !== undefined) return;
    const lang = document.documentElement.lang;
    if (lang === "" || languageOf(lang) === languageOf(formatter.locale)) return;
    warnedLang.current = true;
    console.error(
      `NumberField.Root: the page is \`lang="${lang}"\` but NumberField formats as ` +
        `\`${formatter.locale}\` (the runtime's locale); pass \`locale\`.`,
    );
  }, [locale, formatter]);

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
      mirror,
      registerLabel,
      onInputMounted: onItemMounted,
    }),
    [
      state,
      bounds,
      stepBase,
      pending,
      pendingSource,
      inputId,
      labelId,
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
      mirror,
      registerLabel,
      onItemMounted,
    ],
  );

  const labelledBy = mergeTokenLists(labelCount > 0 ? labelId : undefined, fieldContext?.ids.label);
  const libraryProps: Partial<ComponentPropsWithRef<"div">> & DataAttributes = {
    role: "group",
    ...(labelledBy !== "" ? { "aria-labelledby": labelledBy } : {}),
    ...(fieldContext !== null ? { "data-invalid": dataAttr(fieldInvalid === true) } : {}),
    "data-pending": dataAttr(pending),
    "data-disabled": dataAttr(disabled),
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

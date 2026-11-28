"use client";
import {
  addTransitionType,
  use,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ChangeEvent,
  ComponentPropsWithRef,
  CSSProperties,
  ReactNode,
  RefObject,
} from "react";
import { createActionDetails } from "../internal/action/action-details.js";
import { callAction } from "../internal/action/call-action.js";
import { callUrgentHandler } from "../internal/action/call-urgent-handler.js";
import { useActionTrigger } from "../internal/action/use-action-trigger.js";
import { dataAttr } from "../internal/data-attr.js";
import { FieldContext } from "../internal/form/field-context.js";
import { resolveFieldDefaults, useFieldValueChange } from "../internal/form/use-field-control.js";
import { syncValueTracker } from "../internal/form/sync-value-tracker.js";
import { useFormReset, useResetTarget } from "../internal/form/use-form-reset.js";
import { useNextValidity } from "../internal/form/use-next-validity.js";
import { setEntries } from "../internal/form/validity.js";
import type { FormAssociatedElement } from "../internal/form/use-form-owner-event.js";
import { resolveStateValue } from "../internal/render-element.js";
import { transitionTypes } from "../internal/transition-types.js";
import type {
  Action,
  Rejectable,
  ActionDetails,
  ChangeReason,
  RenderProp,
  StateValue,
  UrgentChangeHandler,
} from "../internal/types.js";
import { useDevWarning, useModeWarnings } from "../internal/use-dev-warning.js";
import { useLatest } from "../internal/use-latest.js";
import { useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { OTPFieldContext } from "./otp-field-context.js";
import type { OTPFieldContextValue } from "./otp-field-context.js";
import { activeRange, applyEdit, filterChars, normalizeCode } from "./otp-field-filter.js";
import type { EditBefore, OTPFieldCharset } from "./otp-field-filter.js";

const isDev = process.env.NODE_ENV !== "production";

/** Details passed as the second argument of `onValueChange`. */
export interface OTPFieldValueChangeDetails extends ActionDetails {
  /**
   * `"activate"`: the user edited the text (`details.event` is the `input` event, or the
   * `compositionend` that ended a composition). `"platform"`: a form reset (the `reset` event),
   * text adopted at hydration or a WebOTP fill (`undefined`).
   */
  readonly reason: ChangeReason;
}

/** Details passed as the second argument of `completeAction`. */
export interface OTPFieldCompleteDetails extends ActionDetails {
  /**
   * `"activate"`: an edit completed the code (typing, paste, keyboard autofill; `details.event`
   * is the `input` event). `"platform"`: a WebOTP fill (`details.event` is `undefined`).
   */
  readonly reason: ChangeReason;
  /**
   * The field would be valid holding this code. A complete code always satisfies the native
   * constraints, so only the enclosing Field's `validate` can make it `false`. Not a server
   * error. Information only: the action runs either way (conventions 2.2).
   */
  readonly valid: boolean;
}

/** The state the Root's and the Input's function props receive. */
export interface OTPFieldState {
  /** The text shown, already filtered: at most `length` characters of `charset`. */
  readonly value: string;
  /** The number of characters in a complete code. */
  readonly length: number;
  /** `value.length === length`. */
  readonly complete: boolean;
  /** A `completeAction` is in flight. */
  readonly pending: boolean;
  /** The `disabled` prop, or the enclosing Field's. */
  readonly disabled: boolean;
  /** The `readOnly` prop. */
  readonly readOnly: boolean;
  /** Inside a `Field.Root`: an error is shown for the field. `false` outside. */
  readonly invalid: boolean;
  /** The `required` prop, or the enclosing Field's. */
  readonly required: boolean;
}

/** State of `OTPField.Root` (conventions 9.4). */
export type OTPFieldRootState = OTPFieldState;
/** State of `OTPField.Input`. */
export type OTPFieldInputState = OTPFieldState;

/**
 * Props of `OTPField.Root`.
 *
 * @see https://ui.funstack.work/components/otp-field
 */
export interface OTPFieldRootProps extends Omit<
  ComponentPropsWithRef<"div">,
  "className" | "style" | "children" | "defaultValue"
> {
  /** The number of characters in a complete code. */
  length: number;
  /**
   * Which characters a code may contain; also picks the Input's `inputmode` and `pattern`.
   *
   * @defaultValue `"numeric"`
   */
  charset?: OTPFieldCharset;
  /** Controlled text. Follows the input: it cannot hold an edit back (the urgent lane). */
  value?: string;
  /**
   * Initial text in uncontrolled mode (filtered), and the form-reset target.
   *
   * @defaultValue `""`
   */
  defaultValue?: string;
  /**
   * The text changed: an edit (`"activate"`), a form reset, text adopted at hydration or a WebOTP
   * fill (`"platform"`). A fact: called synchronously, outside any transition, not awaited.
   * Called before `completeAction` for the same edit.
   */
  onValueChange?: UrgentChangeHandler<string, OTPFieldValueChangeDetails>;
  /**
   * An edit left the code complete: runs in the Root's transition and is awaited, with
   * `data-pending` on the Root and the Input. Runs for every such edit, also while an earlier run
   * is pending (a different code), and for the same code pasted again. Not at mount, on a reset,
   * for a controlled change, or while disabled or read-only. A rejection reaches the nearest Error
   * Boundary. May be a Server Function.
   */
  completeAction?: Action<[value: string, details: OTPFieldCompleteDetails & Rejectable]>;
  /**
   * Submit the Input's form (`requestSubmit()`) when an edit leaves the code complete, right
   * after dispatching `completeAction`. A change of context on input (WCAG 3.2.2): say so before
   * the field.
   *
   * @defaultValue `false`
   */
  submitOnComplete?: boolean;
  /**
   * Native `name` on the Input.
   *
   * @defaultValue the Field's `name` inside a `Field.Root`
   */
  name?: string;
  /** Native `form` on the Input. */
  form?: string;
  /**
   * Native `required` on the Input; or the Field's.
   *
   * @defaultValue `false`
   */
  required?: boolean;
  /**
   * Native `disabled` on the Input; or the Field's.
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
  /**
   * Native `readonly` on the Input: no edits, no completion.
   *
   * @defaultValue `false`
   */
  readOnly?: boolean;
  /**
   * The native attribute, with a library default: a code is read left to right in every locale,
   * so the Slots, the Input's text and its caret keys stay left to right inside an RTL page.
   * Pass `"rtl"` for a code that is read right to left (the attribute has no value meaning
   * "inherit"). A `dir` on a `render` element wins as well.
   *
   * @defaultValue `"ltr"`
   */
  dir?: ComponentPropsWithRef<"div">["dir"];
  /**
   * Ask the browser for the code of an origin-bound SMS (WebOTP, `navigator.credentials.get({
   * otp })`) while the Input is mounted. Chromium and Safari; nothing happens where the API is
   * missing (Firefox).
   *
   * @defaultValue `false`
   */
  experimental_webOTP?: boolean;
  /** Class name, or a function of the state that returns one. */
  className?: StateValue<string | undefined, OTPFieldState>;
  /** Inline style, or a function of the state that returns one. `position: relative` unless given. */
  style?: StateValue<CSSProperties | undefined, OTPFieldState>;
  /** The parts. The function form receives the state. */
  children?: StateValue<ReactNode, OTPFieldState>;
  /** Replace the default `<div>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"div">, OTPFieldState>;
}

const COMPLETE_TYPES = transitionTypes("otp-field", "complete");

interface Selection {
  readonly focused: boolean;
  readonly start: number | null;
  readonly end: number | null;
}

const BLURRED: Selection = { focused: false, start: null, end: null };

function isFocused(input: HTMLInputElement): boolean {
  return input.ownerDocument.activeElement === input || input.matches(":focus");
}

/** Writes `value` into the input when it differs and puts the selection at `[start, end]`. */
function writeInput(
  input: HTMLInputElement,
  value: string,
  start: number | null,
  end: number | null = start,
): void {
  if (input.value !== value) input.value = value;
  if (start === null || end === null || !isFocused(input)) return;
  if (input.selectionStart !== start || input.selectionEnd !== end) {
    input.setSelectionRange(start, end);
  }
}

/** The development check of the mounted Slots' indices (design 1). */
function slotIndexProblem(slots: Map<HTMLElement, number>, length: number): string | null {
  if (slots.size === 0) return null;
  const seen = new Set<number>();
  for (const index of slots.values()) {
    if (!Number.isInteger(index) || index < 0 || index >= length) {
      return `OTPField.Slot: index ${index} is outside 0 to ${length - 1} (length ${length}).`;
    }
    if (seen.has(index)) return `OTPField.Slot: index ${index} is used by more than one Slot.`;
    seen.add(index);
  }
  for (let i = 0; i < length; i++) {
    if (!seen.has(i)) {
      return (
        `OTPField.Slot: no Slot has index ${i} (length ${length}). Render one Slot per ` +
        "position, or the code's characters are not all shown."
      );
    }
  }
  return null;
}

/**
 * Owns the text of a one-time-code field (design/components/otp-field.md): the urgent value
 * (`value` / `defaultValue` / `onValueChange`), the filter that keeps it a code, the selection the
 * Slots draw, the completion transition (`completeAction`, `submitOnComplete`), form reset,
 * hydration adoption and WebOTP. Renders a `div` with `position: relative`: the box the Input
 * covers.
 *
 * Owned keys (conventions 1.2): `data-complete`, `data-pending`, `data-disabled`,
 * `data-invalid` (inside a Field); `position` in `style` unless the consumer's style sets it.
 *
 * @see https://ui.funstack.work/components/otp-field
 */
export function OTPFieldRoot(props: OTPFieldRootProps) {
  const {
    length: lengthProp,
    charset: charsetProp = "numeric",
    value: valueProp,
    defaultValue,
    onValueChange,
    completeAction,
    submitOnComplete = false,
    name: nameProp,
    form,
    required: requiredProp = false,
    disabled: disabledProp = false,
    readOnly: readOnlyProp = false,
    // design/components/otp-field.md 4.4, conventions 14.1 rule 8: a pass-through prop with a
    // default, so a `render` element's own `dir` wins over it (conventions 1.2).
    dir = "ltr",
    experimental_webOTP: experimentalWebOTP = false,
    className,
    style,
    children,
    render,
    ...rest
  } = props;

  const lengthValid = Number.isInteger(lengthProp) && lengthProp > 0;
  const length = lengthValid ? lengthProp : Math.max(1, Math.floor(lengthProp) || 1);
  useDevWarning(
    !lengthValid,
    isDev && `OTPField.Root: \`length\` must be a positive integer; got ${String(lengthProp)}.`,
  );
  const charset: OTPFieldCharset =
    charsetProp === "alphanumeric" || charsetProp === "alphabetic" ? charsetProp : "numeric";

  // --- Field ----------------------------------------------------------------------------------

  // OTPField.Input registers the control (design 7); the Root resolves the defaults.
  const fieldContext = use(FieldContext);
  const { disabled, required, readOnly, name } = resolveFieldDefaults(fieldContext, {
    name: nameProp,
    disabled: disabledProp,
    required: requiredProp,
    readOnly: readOnlyProp,
  });
  const fieldInvalid = fieldContext === null ? undefined : fieldContext.state.invalid;

  // --- The text (design 3.2) ------------------------------------------------------------------

  const controlled = valueProp !== undefined;
  // An urgent state warns like every controllable state (conventions 3.1).
  useModeWarnings(controlled, defaultValue !== undefined, {
    component: "OTPField.Root",
    prop: "value",
  });
  const controlledValue = controlled ? normalizeCode(valueProp, charset, length) : undefined;
  useDevWarning(
    controlled && controlledValue !== valueProp,
    isDev &&
      `OTPField.Root: the controlled \`value\` ("${valueProp ?? ""}") holds characters outside ` +
        `\`charset\` ("${charset}") or more than \`length\` (${length}); it is rendered as ` +
        `"${controlledValue ?? ""}".`,
  );
  const [internalValue, setInternalValue] = useState(() =>
    normalizeCode(defaultValue ?? "", charset, length),
  );
  const value = controlledValue ?? internalValue;
  const valueRef = useRef(value);
  // The latest value for handlers between two renders (two edits in one task).
  useLayoutEffect(() => {
    valueRef.current = value;
  });

  /** The raw text while a composition is open (design 4.1, Composition): rendered as is. */
  const [composingText, setComposingText] = useState<string | null>(null);
  const composingRef = useRef(false);
  const [selection, setSelection] = useState<Selection>(BLURRED);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const beforeRef = useRef<EditBefore | null>(null);
  /** The value change the Field is told about next was an edit (design 7: `takeEdit`). */
  const editRef = useRef(false);
  const webOTPAbort = useRef<AbortController | null>(null);
  /** A completion happened: no WebOTP request starts any more, and a late code is ignored. */
  const webOTPDone = useRef(false);
  /** `submitOnComplete` was held back by an open composition. */
  const submitAfterComposition = useRef(false);

  const { pending, run } = useActionTrigger();
  const nextValidity = useNextValidity();

  // The latest committed props and `run`, for the stable callbacks below. Named `*Ref` so that
  // React Compiler's lint treats `.current` as a ref read, not a missing memo dependency.
  // `run` is a new function on every render: reading it through the ref keeps every handler,
  // the context and the Input's listeners and WebOTP request stable across renders.
  const propsRef = useLatest({
    charset,
    length,
    disabled,
    readOnly,
    controlled,
    onValueChange,
    completeAction,
    submitOnComplete,
    run,
    notifyField: fieldContext?.notifyChange,
    name,
    nextValidity,
  });

  // --- Writes ---------------------------------------------------------------------------------

  /** Writes the value (urgent) and reports it to `onValueChange` (design 3.2). */
  const commitValue = useCallback(
    (next: string, reason: ChangeReason, event: Event | undefined, edit: boolean) => {
      const props = propsRef.current;
      editRef.current = edit;
      // Controlled: the value is the parent's until it renders it (it may not adopt the edit).
      if (!props.controlled) {
        valueRef.current = next;
        setInternalValue(next);
      }
      callUrgentHandler(
        props.onValueChange,
        next,
        createActionDetails(event, { reason }) as OTPFieldValueChangeDetails,
      );
    },
    [propsRef],
  );

  /** Submits the Input's form, after the Field re-validated the text just written (design 3.1). */
  const submit = useCallback(() => {
    const form = inputRef.current?.form;
    if (form == null) return;
    // The Field validated the browser's pre-filter text in its `input` listener; the commit
    // that re-validates the written text comes after this event. Refresh it now.
    propsRef.current.notifyField?.(true);
    form.requestSubmit();
  }, [propsRef]);

  /** The code is complete after an edit or a WebOTP fill (design 3.1). */
  const complete = useCallback(
    (code: string, reason: ChangeReason, event: Event | undefined, composing = false) => {
      const {
        disabled: off,
        readOnly: ro,
        completeAction: action,
        submitOnComplete: submitting,
        run: runAction,
        name: fieldName,
        nextValidity: validityOf,
      } = propsRef.current;
      if (off || ro) return;
      // A code completed by hand makes a waiting WebOTP request moot (design 8), and no new one
      // starts after it.
      webOTPDone.current = true;
      webOTPAbort.current?.abort();
      webOTPAbort.current = null;
      if (action !== undefined) {
        // `details.valid` (field-form.md 7.5): native constraints hold by construction; the
        // patch gives `validate` the filtered code (the Field's `input` listener saw the
        // browser's text before the filter's write-back).
        const valid = validityOf(true, setEntries(fieldName, [code], off));
        const details = createActionDetails(event, { reason, valid });
        runAction(() => {
          for (const type of COMPLETE_TYPES) addTransitionType(type);
          return callAction("OTPField.Root", details, (d) => action(code, d));
        });
      }
      if (!submitting) return;
      // The IME has not committed the text yet: submit at `compositionend` (design 4.1).
      if (composing) submitAfterComposition.current = true;
      else submit();
    },
    [propsRef, submit],
  );

  const readSelection = useCallback(() => {
    const input = inputRef.current;
    const next: Selection =
      input === null || !isFocused(input)
        ? BLURRED
        : { focused: true, start: input.selectionStart, end: input.selectionEnd };
    setSelection((prev) =>
      prev.focused === next.focused && prev.start === next.start && prev.end === next.end
        ? prev
        : next,
    );
  }, []);

  // --- Editing (design 4.1) -------------------------------------------------------------------

  const beforeInput = useCallback((event: InputEvent) => {
    const input = event.target as HTMLInputElement;
    beforeRef.current = {
      text: input.value,
      selectionStart: input.selectionStart ?? input.value.length,
      selectionEnd: input.selectionEnd ?? input.value.length,
    };
  }, []);

  const change = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const native = event.nativeEvent as Partial<InputEvent> & Event;
      const before = beforeRef.current;
      beforeRef.current = null;
      const { charset: cs, length: len, disabled: off, readOnly: ro } = propsRef.current;
      if (off || ro) return;

      if (composingRef.current || native.isComposing === true) {
        // Derive always, write when allowed: the composition keeps its text in the input.
        const next = normalizeCode(input.value, cs, len);
        setComposingText(input.value);
        readSelection();
        if (next === valueRef.current) return;
        commitValue(next, "activate", native, true);
        if (next.length === len) complete(next, "activate", native, true);
        return;
      }

      const result = applyEdit({
        before,
        dom: input.value,
        caret: input.selectionStart,
        inputType: native.inputType ?? "",
        charset: cs,
        length: len,
      });
      setComposingText(null);
      if (result.selection !== null) {
        writeInput(input, result.value, result.selection[0], result.selection[1]);
      } else {
        writeInput(input, result.value, result.caret);
      }
      readSelection();
      const changed = result.value !== valueRef.current;
      if (changed) commitValue(result.value, "activate", native, true);
      if (result.value.length === len && (changed || result.kept > 0)) {
        complete(result.value, "activate", native);
      }
    },
    [commitValue, complete, propsRef, readSelection],
  );

  const compositionStart = useCallback(() => {
    composingRef.current = true;
  }, []);

  const compositionEnd = useCallback(
    (event: CompositionEvent) => {
      composingRef.current = false;
      const input = inputRef.current;
      setComposingText(null);
      if (input === null) return;
      const { charset: cs, length: len } = propsRef.current;
      const dom = input.value;
      const next = normalizeCode(dom, cs, len);
      const caret = Math.min(
        filterChars(dom.slice(0, input.selectionStart ?? dom.length), cs).length,
        next.length,
      );
      writeInput(input, next, caret);
      readSelection();
      const held = submitAfterComposition.current;
      submitAfterComposition.current = false;
      if (next !== valueRef.current) {
        commitValue(next, "activate", event, true);
        if (next.length === len) complete(next, "activate", event);
        return;
      }
      // The code was completed while composing: the submission held back then goes now.
      if (held && next.length === len && propsRef.current.submitOnComplete) submit();
    },
    [commitValue, complete, propsRef, readSelection, submit],
  );

  const blurred = useCallback(() => {
    setSelection(BLURRED);
  }, []);

  // --- The pointer (design 4.3) ---------------------------------------------------------------

  const slots = useRef(new Map<HTMLElement, number>());
  const registerSlot = useCallback((index: number, element: HTMLElement) => {
    slots.current.set(element, index);
    return () => {
      if (slots.current.get(element) === index) slots.current.delete(element);
    };
  }, []);

  const click = useCallback((event: MouseEvent) => {
    const input = inputRef.current;
    // A double click selects; a drag made a range: the browser's selection stands.
    if (input === null || event.detail > 1 || input.selectionStart !== input.selectionEnd) return;
    let target: number | null = null;
    let distance = Infinity;
    for (const [element, index] of slots.current) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue;
      const dx = Math.max(box.left - event.clientX, 0, event.clientX - box.right);
      const dy = Math.max(box.top - event.clientY, 0, event.clientY - box.bottom);
      const d = dx * dx + dy * dy;
      if (d < distance) {
        distance = d;
        target = index;
      }
    }
    if (target === null) return;
    const caret = Math.min(target, input.value.length);
    if (input.selectionStart !== caret || input.selectionEnd !== caret) {
      input.setSelectionRange(caret, caret);
    }
  }, []);

  // --- Residual paths: hydration, reset, WebOTP (design 7, 8, 9) -----------------------------

  const inputMounted = useCallback(() => {
    const input = inputRef.current;
    if (input === null) return;
    const { charset: cs, length: len } = propsRef.current;
    const dom = input.value;
    const next = normalizeCode(dom, cs, len);
    if (dom !== next) input.value = next;
    // Read-only (internal-hooks 3.8 rule 10): text restored by the browser is put back.
    if (propsRef.current.readOnly) {
      if (input.value !== valueRef.current) input.value = valueRef.current;
      return;
    }
    // No completion for adopted text (design 9): a restored code is not a fresh one.
    if (next !== valueRef.current) commitValue(next, "platform", undefined, false);
  }, [commitValue, propsRef]);

  const resetTarget = normalizeCode(useResetTarget(valueProp, defaultValue) ?? "", charset, length);
  const [resync, setResync] = useState(0);
  const inputText = composingText ?? value;
  const inputTextRef = useLatest(inputText);
  useLayoutEffect(() => {
    // A controlled parent that did not adopt the reset gets the DOM put back.
    const input = inputRef.current;
    if (resync > 0 && input !== null && input.value !== inputTextRef.current) {
      input.value = inputTextRef.current;
    }
  }, [resync, inputTextRef]);
  useFormReset(
    inputRef as RefObject<FormAssociatedElement | null>,
    (event) => {
      // The reset algorithm wrote the text past react-dom's value tracker (rule 6).
      syncValueTracker(inputRef.current);
      composingRef.current = false;
      setComposingText(null);
      // The target is computed, not read from the input: after a click on a reset button this
      // microtask runs before the browser's reset algorithm (there is a microtask checkpoint
      // after each `reset` listener), so the input may still hold the old text here.
      if (resetTarget !== valueRef.current) commitValue(resetTarget, "platform", event, false);
      setResync((n) => n + 1);
    },
    () => {
      // react-dom rewrites a controlled input's `defaultValue` after every update; the reset
      // target is written right before the browser's reset algorithm reads it.
      const input = inputRef.current;
      if (input !== null && input.defaultValue !== resetTarget) input.defaultValue = resetTarget;
    },
  );

  const webOTPCode = useCallback(
    (code: string) => {
      const { charset: cs, length: len, disabled: off, readOnly: ro } = propsRef.current;
      if (off || ro || webOTPDone.current) return;
      const next = filterChars(code, cs);
      if (next.length !== len) return;
      // Written now, so that `submitOnComplete` posts it before React renders.
      const input = inputRef.current;
      if (input !== null) input.value = next;
      if (next !== valueRef.current) commitValue(next, "platform", undefined, true);
      complete(next, "platform", undefined);
    },
    [commitValue, complete, propsRef],
  );

  // A write-back or a WebOTP fill changed the value with no event the Field heard after it.
  useFieldValueChange(value, () => {
    const edit = editRef.current;
    editRef.current = false;
    return edit;
  });

  // --- Development warnings -------------------------------------------------------------------

  const slotWarned = useRef(false);
  useLayoutEffect(() => {
    if (!isDev || slotWarned.current) return;
    const problem = slotIndexProblem(slots.current, length);
    if (problem === null) return;
    slotWarned.current = true;
    console.error(problem);
  });

  // --- Render ---------------------------------------------------------------------------------

  const state = useMemo<OTPFieldState>(
    () => ({
      value,
      length,
      complete: value.length === length,
      pending,
      disabled,
      readOnly,
      invalid: fieldInvalid === true,
      required,
    }),
    [value, length, pending, disabled, readOnly, fieldInvalid, required],
  );

  const [activeFrom, activeTo] = activeRange(
    selection.focused,
    selection.start,
    selection.end,
    length,
  );

  const context = useMemo<OTPFieldContextValue>(
    () => ({
      state,
      charset,
      name,
      form,
      required,
      fieldInvalid,
      inputText,
      active: [activeFrom, activeTo],
      experimentalWebOTP,
      inputRef,
      change,
      beforeInput,
      compositionStart,
      compositionEnd,
      selectionChanged: readSelection,
      blurred,
      click,
      inputMounted,
      webOTPCode,
      registerSlot,
      webOTPAbort,
      webOTPDone,
    }),
    [
      state,
      charset,
      name,
      form,
      required,
      fieldInvalid,
      inputText,
      activeFrom,
      activeTo,
      experimentalWebOTP,
      change,
      beforeInput,
      compositionStart,
      compositionEnd,
      readSelection,
      blurred,
      click,
      inputMounted,
      webOTPCode,
      registerSlot,
    ],
  );

  const libraryProps: Partial<ComponentPropsWithRef<"div">> & DataAttributes = {
    ...(fieldContext !== null ? { "data-invalid": dataAttr(fieldInvalid === true) } : {}),
    "data-complete": dataAttr(state.complete),
    "data-pending": dataAttr(pending),
    "data-disabled": dataAttr(disabled),
    "data-readonly": dataAttr(readOnly),
  };

  const element = useRender<ComponentPropsWithRef<"div">, OTPFieldState>({
    defaultElement: "div",
    render,
    state,
    className,
    // `position: relative` is the Input's containing block (design 6), unless the consumer's
    // style places the Root itself.
    style: (s) => ({ position: "relative", ...resolveStateValue(style, s) }),
    children,
    props: { ...rest, dir },
    libraryProps,
  });

  return <OTPFieldContext value={context}>{element}</OTPFieldContext>;
}

OTPFieldRoot.displayName = "OTPFieldRoot";

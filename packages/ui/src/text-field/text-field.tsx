"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import type {
  ChangeEvent,
  ComponentPropsWithRef,
  CSSProperties,
  FocusEvent,
  KeyboardEvent,
  RefObject,
} from "react";
import { createActionDetails } from "../internal/action/action-details.js";
import {
  intendedValue,
  useControllableAction,
} from "../internal/action/use-controllable-action.js";
import { dataAttr } from "../internal/data-attr.js";
import { consumeEscape, isComposingKey, isEscapeRequest } from "../internal/escape-key.js";
import { useFieldControl, useFieldValueChange } from "../internal/form/use-field-control.js";
import { syncValueTracker } from "../internal/form/sync-value-tracker.js";
import { useResetTarget } from "../internal/form/use-form-reset.js";
import type { FormAssociatedElement } from "../internal/form/use-form-owner-event.js";
import { useNativeGroupReconciliation } from "../internal/form/use-native-group-reconciliation.js";
import { transitionTypes } from "../internal/transition-types.js";
import type {
  ActionDetails,
  ChangeAction,
  ChangeReason,
  RenderProp,
  StateValue,
} from "../internal/types.js";
import { useElementCheck } from "../internal/use-element-check.js";
import { CONTROL_NAME, useNameWarning } from "../internal/use-name-warning.js";
import { useLatest } from "../internal/use-latest.js";
import { useMergedRefs } from "../internal/use-merged-refs.js";
import { useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Details passed as the second argument of `valueCommitAction` (conventions 9.4: a commit
 * action's details are `<Component>ValueCommitDetails`; TextField has no change action).
 */
export interface TextFieldValueCommitDetails extends ActionDetails {
  /**
   * `"activate"`: the user committed an edit (`details.event` is the `focusout` or the commit
   * key's `keydown`: Enter in an `<input>`, Ctrl+Enter or Cmd+Enter in a `<textarea>`).
   * `"platform"`: a form reset (the `reset` event), or text adopted at mount (`undefined`: typed
   * before hydration, restored by the browser).
   */
  readonly reason: ChangeReason;
}

/** The state the function props (`className`, `style`, `render`) receive. */
export interface TextFieldState {
  /** The shown value: the optimistic value (the committed one when nothing is in flight). */
  readonly value: string;
  /** The shown text: the draft while the user is editing, else `value`. */
  readonly text: string;
  /** A `valueCommitAction` dispatched through this field is in flight. */
  readonly pending: boolean;
  /** The `disabled` prop, or the enclosing Field's. */
  readonly disabled: boolean;
  /** The `readOnly` prop. */
  readonly readOnly: boolean;
  /** The `required` prop, or the enclosing Field's. */
  readonly required: boolean;
  /** Inside a `Field.Root`: an error is shown for the field (`data-invalid`). `false` outside. */
  readonly invalid: boolean;
}

/**
 * Props of `TextField`.
 *
 * @see https://ui.funstack.work/components/text-field
 */
export interface TextFieldProps extends Omit<
  ComponentPropsWithRef<"input">,
  | "value"
  | "defaultValue"
  | "onChange"
  | "onKeyDown"
  | "onBlur"
  | "aria-invalid"
  | "className"
  | "style"
  | "children"
> {
  /** The saved text, controlled. `undefined` is uncontrolled. */
  value?: string;
  /**
   * Initial saved text in uncontrolled mode, and its form-reset target (latest).
   *
   * @defaultValue `""`
   */
  defaultValue?: string;
  /**
   * Runs inside the field's transition once per edit (blur, or the commit key: Enter in an
   * `<input>`, Ctrl+Enter or Cmd+Enter in a `<textarea>`), and for a platform change (a form
   * reset, text adopted at mount). Where the save goes: uncontrolled state is committed when it
   * resolves; a rejection shows the saved text again. May be a Server Function.
   */
  valueCommitAction?: ChangeAction<string, TextFieldValueCommitDetails>;
  /**
   * Native `name`.
   *
   * @defaultValue the Field's `name` inside a `Field.Root`
   */
  name?: string;
  /**
   * Native `disabled`; also `true` when the enclosing Field is disabled.
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
  /**
   * Native `readonly`: the text cannot be edited and nothing commits.
   *
   * @defaultValue `false`
   */
  readOnly?: boolean;
  /**
   * Native `required`; also `true` when the enclosing Field is required.
   *
   * @defaultValue `false`
   */
  required?: boolean;
  /** Class name, or a function of the state that returns one. */
  className?: StateValue<string | undefined, TextFieldState>;
  /** Inline style, or a function of the state that returns one. */
  style?: StateValue<CSSProperties | undefined, TextFieldState>;
  /**
   * Replace the default `<input type="text">`: a text `<input>` (`text`, `tel`, `url`, `email`,
   * `password`) or a `<textarea>` (`render={<textarea rows={4} />}`). `search` is not supported:
   * use `type="text"` with `role="searchbox"` and `enterKeyHint="search"`.
   */
  render?: RenderProp<ComponentPropsWithRef<"input">, TextFieldState>;
}

const COMMIT_TYPES = transitionTypes("text-field", "commit");
const commitTypes = () => COMMIT_TYPES;

/** The `<input>` types that hold free text (design 1, element constraints). */
const TEXT_TYPES = new Set(["text", "tel", "url", "email", "password"]);

type TextElement = HTMLInputElement | HTMLTextAreaElement;

/**
 * A text field that saves itself (design/components/text-field.md). The typed text is an urgent
 * internal draft; a blur or the commit key (Enter in an `<input>`, Ctrl+Enter or Cmd+Enter in a
 * `<textarea>`) commits it through `valueCommitAction` in the
 * field's transition (`data-pending` meanwhile; a rejection shows the saved text again). Escape
 * with an edited draft puts the saved text back and consumes the key (conventions 15). One
 * element: it carries `name`, the constraints and the text the form posts.
 *
 * Owned keys (conventions 1.2): `value` (the shown text), `onChange`, `onKeyDown`, `onBlur`,
 * `data-pending`, `data-disabled`; inside a `Field.Root` also `id`, `name`, `disabled`,
 * `required`, `aria-invalid`, `aria-describedby` (token-merged) and `data-invalid`. Everything
 * else passes through; the library sets no default but `type="text"` on the default element.
 *
 * @see https://ui.funstack.work/components/text-field
 */
export function TextField(props: TextFieldProps) {
  const {
    value,
    defaultValue,
    valueCommitAction,
    name: nameProp,
    disabled: disabledProp = false,
    readOnly = false,
    required: requiredProp = false,
    className,
    style,
    render,
    ...rest
  } = props;

  // --- Field (design 7) -----------------------------------------------------------------------

  const field = useFieldControl({
    labelable: true,
    name: nameProp,
    disabled: disabledProp,
    required: requiredProp,
    id: rest.id,
    component: "TextField",
  });
  const { disabled, required } = field;
  const invalid = field.state?.invalid ?? false;

  // --- State (design 2) -----------------------------------------------------------------------

  const { optimistic, pending, dispatch, latestInFlight } = useControllableAction<
    string,
    TextFieldValueCommitDetails
  >({
    controlled: value,
    defaultValue,
    initialValue: "",
    action: valueCommitAction,
    transitionTypes: commitTypes,
    warn: { component: "TextField", prop: "value" },
  });

  const [draft, setDraft] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);
  const elementRef = useRef<TextElement | null>(null);

  const text = draft ?? optimistic;

  const state = useMemo<TextFieldState>(
    () => ({ value: optimistic, text, pending, disabled, readOnly, required, invalid }),
    [optimistic, text, pending, disabled, readOnly, required, invalid],
  );

  // An Escape revert, a rollback and a controlled change move the text with no event the Field
  // hears; typing does too, which the Field heard already (design 7, no `takeEdit`).
  useFieldValueChange(text);

  const latest = useLatest({ optimistic, disabled, readOnly });

  const openDraft = useCallback((next: string) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  const clearDraft = useCallback(() => {
    if (draftRef.current === null) return;
    draftRef.current = null;
    setDraft(null);
  }, []);

  // --- The commit (design 4.2) ------------------------------------------------------------------

  const commit = useCallback(
    (event: Event) => {
      const open = draftRef.current;
      if (open === null) return;
      const { optimistic: shown, disabled: off, readOnly: ro } = latest.current;
      clearDraft();
      // Disabled or read-only, or nothing changed (conventions 2.3 item 8): no dispatch.
      if (off || ro || open === shown) return;
      dispatch(open, createActionDetails(event, { reason: "activate" }));
    },
    [clearDraft, dispatch, latest],
  );

  const keyDown = useCallback(
    (event: globalThis.KeyboardEvent, element: TextElement) => {
      if (event.key === "Enter") {
        // An Enter that confirms a composition is the IME's, with any modifier.
        if (isComposingKey(event)) return;
        if (element.tagName === "INPUT") {
          // Not prevented: inside a form the implicit submission follows (design 7).
          commit(event);
          return;
        }
        // A textarea: Enter without Ctrl or Cmd is not the field's (a new line, alone or with
        // Shift; the engine's with Alt); Ctrl or Cmd commits
        // (design 4.2). Always prevented, so the key means one thing and adds no line.
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        commit(event);
        return;
      }
      // Escape reverts an edited draft, in the field's own handler (design 4.3, conventions 15).
      if (!isEscapeRequest(event)) return;
      const open = draftRef.current;
      if (open === null || open === latest.current.optimistic) return;
      clearDraft();
      consumeEscape(event);
    },
    [clearDraft, commit, latest],
  );

  // --- Residual browser paths: mount reconciliation and form reset (design 4.4) ----------------

  const resetTarget = useResetTarget(value, defaultValue) ?? "";

  useNativeGroupReconciliation<string>({
    element: elementRef as RefObject<FormAssociatedElement | null>,
    readCurrent: () => {
      const element = elementRef.current;
      const current = latest.current.optimistic;
      if (element === null || element.value === current) return current;
      // Still being typed (focused before hydration): the user's blur or commit key commits it.
      if (element.ownerDocument.activeElement === element) {
        openDraft(element.value);
        return current;
      }
      return element.value;
    },
    readDefault: () => {
      // The reset algorithm wrote the text past react-dom's value tracker (rule 6).
      syncValueTracker(elementRef.current);
      // A reset clears an open draft whatever the target.
      clearDraft();
      return resetTarget;
    },
    base: () => intendedValue(latestInFlight, latest.current.optimistic),
    onPlatformChange: (next, event) => {
      dispatch(next, createActionDetails(event, { reason: "platform" }));
    },
    onResetEvent: () => {
      // react-dom keeps a controlled input's `defaultValue` equal to its value: the reset target
      // is written right before the reset algorithm reads it (conventions 3.8 rule 6).
      const element = elementRef.current;
      if (element !== null) element.defaultValue = resetTarget;
    },
  });

  // --- Element ----------------------------------------------------------------------------------

  const checkElement = useElementCheck(
    isDev &&
      ((element) => {
        if (element.tagName === "TEXTAREA") return null;
        if (element.tagName === "INPUT" && TEXT_TYPES.has((element as HTMLInputElement).type)) {
          return null;
        }
        const type = element.tagName === "INPUT" ? (element as HTMLInputElement).type : "";
        if (type === "search") {
          return (
            'TextField: type="search" is not supported. In a search field Escape is the ' +
            "engine's own key (it empties the field), which would give Escape two meanings. " +
            'Use type="text" with role="searchbox" (the role type="search" gives) and ' +
            'enterKeyHint="search".'
          );
        }
        return (
          `TextField: rendered <${element.tagName.toLowerCase()}` +
          `${type === "" ? "" : ` type="${type}"`}>. Render a text <input> (text, tel, url, ` +
          "email, password) or a <textarea>: other inputs sanitise their value " +
          "(NumberField exists for numbers)."
        );
      }),
  );
  const libraryRef = useCallback(
    (element: HTMLElement) => {
      checkElement?.(element);
      elementRef.current = element as TextElement;
      return () => {
        if (elementRef.current === element) elementRef.current = null;
      };
    },
    [checkElement],
  );
  // Development check (conventions 9.5): the field needs a name, from a `<label for>`, a
  // wrapping `<label>` (a `Field.Label` included), `aria-label` or `aria-labelledby`.
  const checkName = useNameWarning(
    isDev &&
      "TextField: the field has no accessible name. Associate a <label for>, use Field.Label, " +
        "or give it aria-label / aria-labelledby.",
    CONTROL_NAME,
  );
  const ref = useMergedRefs<HTMLElement>(libraryRef, field.ref, checkName);

  const libraryProps: ComponentPropsWithRef<"input"> & DataAttributes = {
    ...field.attributes,
    ...(field.inField
      ? { name: field.name, disabled: field.disabled, required: field.required }
      : {}),
    value: text,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      openDraft(event.currentTarget.value);
    },
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      keyDown(event.nativeEvent, event.currentTarget);
    },
    onBlur: (event: FocusEvent<HTMLInputElement>) => {
      commit(event.nativeEvent);
    },
    "data-pending": dataAttr(pending),
    "data-disabled": dataAttr(disabled),
  };

  return useRender<ComponentPropsWithRef<"input">, TextFieldState>({
    defaultElement: "input",
    render,
    state,
    className,
    style,
    children: undefined,
    // Outside a Field the own props are ordinary pass-through (Field.Control's rule).
    props: {
      ...(render === undefined ? { type: "text" } : {}),
      ...rest,
      readOnly,
      ...(field.inField ? {} : { name: nameProp, disabled: disabledProp, required: requiredProp }),
    },
    libraryProps,
    ref,
  });
}

TextField.displayName = "TextField";

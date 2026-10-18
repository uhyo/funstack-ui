"use client";
import {
  isValidElement,
  useCallback,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import type {
  ChangeEvent,
  ComponentPropsWithRef,
  CSSProperties,
  FocusEvent,
  KeyboardEvent,
  Ref,
} from "react";
import { dataAttr } from "../internal/data-attr.js";
import { mergeRefs } from "../internal/merge-props.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useFieldControl, useMergedRef } from "../internal/use-field-control.js";
import { useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { hiddenText } from "./number-field-root.js";
import type { NumberFieldState } from "./number-field-root.js";
import { useNumberFieldContext } from "./number-field-context.js";

export interface NumberFieldInputProps extends Omit<
  ComponentPropsWithRef<"input">,
  | "value"
  | "defaultValue"
  | "type"
  | "onChange"
  | "onKeyDown"
  | "onBlur"
  | "disabled"
  | "readOnly"
  | "required"
  | "name"
  | "form"
  | "min"
  | "max"
  | "step"
  | "pattern"
  | "aria-invalid"
  | "className"
  | "style"
  | "children"
> {
  /** The hidden native `<input type="number">` rendered after the visible input. */
  hiddenInputRef?: Ref<HTMLInputElement>;
  className?: StateValue<string | undefined, NumberFieldState>;
  style?: StateValue<CSSProperties | undefined, NumberFieldState>;
  /** Must render an `<input>` of type `text`, `search` or `tel`; the hidden input is rendered after it regardless. */
  render?: RenderProp<ComponentPropsWithRef<"input">, NumberFieldState>;
}

const isDev = process.env.NODE_ENV !== "production";

/** Visually hidden, unfocusable, out of the accessibility tree: the form's control (6.1). */
const HIDDEN_STYLE: CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  margin: "-1px",
  padding: 0,
  border: 0,
  opacity: 0,
  overflow: "hidden",
  clipPath: "inset(50%)",
  pointerEvents: "none",
};

const TEXT_TYPES = ["text", "search", "tel"];

/**
 * The visible text field (`input[type=text]`, the user's surface) **followed by** the visually
 * hidden native `input[type=number]` that carries `name`, `form`, `min`, `max`, `step`,
 * `required` and the canonical value (design/components/number-field.md 6). `ref` goes to the
 * visible input, `hiddenInputRef` to the hidden one.
 *
 * Owned keys on the visible input: `id`, `type`, `value`, `disabled`, `readOnly`, `onChange`,
 * `onKeyDown`, `onBlur`, `aria-invalid` and `aria-describedby` (Field, token-merged),
 * `data-pending`, `data-disabled`, `data-invalid`. Defaults the consumer's own prop replaces:
 * `inputMode`, `autoComplete="off"`, `autoCorrect="off"`, `spellCheck={false}`.
 */
export function NumberFieldInput({
  hiddenInputRef,
  className,
  style,
  render,
  ...rest
}: NumberFieldInputProps) {
  const ctx = useNumberFieldContext("NumberField.Input");
  const { state, visibleRef, hiddenRef, mirror, onInputMounted } = ctx;

  // --- The Field contract (design 7.1): the visible input registers, the hidden one validates.
  const validityElement = useCallback(() => hiddenRef.current, [hiddenRef]);
  const field = useFieldControl({
    labelable: true,
    name: ctx.name,
    disabled: state.disabled,
    required: state.required,
    component: "NumberField.Input",
    validityElement,
  });

  const restName = (rest as { name?: unknown }).name;
  useDevWarning(
    restName !== undefined,
    "NumberField.Input: `name` belongs on NumberField.Root (it goes to the hidden number input); " +
      "on the visible input it would post the formatted text.",
  );

  const libraryRef = useCallback(
    (element: HTMLElement) => {
      if (isDev) {
        const type = element.tagName === "INPUT" ? (element as HTMLInputElement).type : "";
        if (!TEXT_TYPES.includes(type)) {
          console.error(
            `NumberField.Input: rendered <${element.tagName.toLowerCase()}` +
              `${type === "" ? "" : ` type="${type}"`}>. Render an <input> of type "text", ` +
              '"search" or "tel": a number input would re-introduce the native parser.',
          );
        }
      }
      visibleRef.current = element as HTMLInputElement;
      return () => {
        if (visibleRef.current === element) visibleRef.current = null;
      };
    },
    [visibleRef],
  );
  const mergedRef = useMergedRef<HTMLElement>(libraryRef, field.ref);

  const hiddenMergedRef = useMemo(
    () => mergeRefs<HTMLInputElement | null>(hiddenRef, hiddenInputRef),
    [hiddenRef, hiddenInputRef],
  );

  // After every commit: the hidden input holds the shown value (a rollback, a controlled change,
  // a reset) and the visible input mirrors its validity (a changed `min` / `max` / `required`).
  useLayoutEffect(() => {
    const hidden = hiddenRef.current;
    if (hidden !== null) {
      const text = hiddenText(state.value);
      if (hidden.value !== text) hidden.value = text;
    }
    mirror();
  });

  // The hidden input is never the one the browser reports on (6.3); the visible input is
  // invalid in the same cases and gets the report (or the Field handles it).
  useLayoutEffect(() => {
    const hidden = hiddenRef.current;
    if (hidden === null) return;
    const onInvalid = (event: Event) => event.preventDefault();
    hidden.addEventListener("invalid", onInvalid);
    return () => hidden.removeEventListener("invalid", onInvalid);
  }, [hiddenRef]);

  // React's `onWheel` is passive: a native, non-passive listener can stop the page scroll (4.4).
  const onWheel = useEffectEvent((event: WheelEvent) => {
    ctx.wheel(event);
  });
  const { stepOnWheel } = ctx;
  useLayoutEffect(() => {
    const visible = visibleRef.current;
    if (!stepOnWheel || visible === null) return;
    visible.addEventListener("wheel", onWheel, { passive: false });
    return () => visible.removeEventListener("wheel", onWheel);
  }, [stepOnWheel, visibleRef]);

  // A late mount (inside a Suspense boundary that hydrates after the Root) reconciles again.
  const mounted = useRef(false);
  useLayoutEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    onInputMounted();
  }, [onInputMounted]);

  const renderType =
    isValidElement<{ type?: unknown }>(render) && typeof render.props.type === "string"
      ? render.props.type
      : undefined;
  const type = renderType !== undefined && TEXT_TYPES.includes(renderType) ? renderType : "text";
  useDevWarning(
    renderType !== undefined && !TEXT_TYPES.includes(renderType),
    `NumberField.Input: \`render\` has type="${renderType ?? ""}"; the visible input is ` +
      'rendered as type "text". A number input would re-introduce the native parser the ' +
      "NumberField exists to avoid.",
  );

  const dataInvalid =
    ctx.fieldInvalid === undefined ? {} : { "data-invalid": dataAttr(ctx.fieldInvalid) };
  const libraryProps: ComponentPropsWithRef<"input"> & DataAttributes = {
    ...field.attributes,
    id: ctx.inputId,
    type,
    value: state.text,
    disabled: state.disabled,
    readOnly: state.readOnly,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      ctx.typed(event.currentTarget.value);
    },
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      ctx.keyDown(event.nativeEvent);
    },
    onBlur: (event: FocusEvent<HTMLInputElement>) => {
      ctx.commitDraft(event.nativeEvent);
    },
    "data-pending": dataAttr(state.pending),
    "data-disabled": dataAttr(state.disabled),
    ...dataInvalid,
  };

  const visible = useRender<ComponentPropsWithRef<"input">, NumberFieldState>({
    defaultElement: "input",
    render,
    state,
    className,
    style,
    children: undefined,
    props: {
      inputMode: ctx.allowsFractions ? "decimal" : "numeric",
      autoComplete: "off",
      autoCorrect: "off",
      spellCheck: false,
      ...rest,
    },
    libraryProps,
    ref: mergedRef,
  });

  const { min, max, step } = ctx.bounds;
  return (
    <>
      {visible}
      <input
        ref={hiddenMergedRef}
        type="number"
        name={field.name}
        form={ctx.form}
        min={min}
        max={max}
        step={step}
        required={field.required}
        disabled={field.disabled}
        readOnly={state.readOnly}
        defaultValue={ctx.resetTargetText}
        autoComplete="off"
        aria-hidden="true"
        tabIndex={-1}
        style={HIDDEN_STYLE}
      />
    </>
  );
}

NumberFieldInput.displayName = "NumberFieldInput";

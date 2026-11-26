"use client";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { ComponentPropsWithRef, CSSProperties } from "react";
import { dataAttr } from "../internal/data-attr.js";
import { useFieldControl } from "../internal/form/use-field-control.js";
import { useFormOwnerEvent } from "../internal/form/use-form-owner-event.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useElementCheck } from "../internal/use-element-check.js";
import { useMergedRefs } from "../internal/use-merged-refs.js";
import { useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { useOTPFieldContext } from "./otp-field-context.js";
import { charsetInputMode, charsetPattern } from "./otp-field-filter.js";
import type { OTPFieldState } from "./otp-field-root.js";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Props of `OTPField.Input`.
 *
 * @see https://ui.funstack.work/components/otp-field
 */
export interface OTPFieldInputProps extends Omit<
  ComponentPropsWithRef<"input">,
  | "type"
  | "value"
  | "defaultValue"
  | "maxLength"
  | "minLength"
  | "pattern"
  | "name"
  | "form"
  | "required"
  | "disabled"
  | "readOnly"
  | "onChange"
  | "className"
  | "style"
  | "children"
> {
  /** Class name, or a function of the state that returns one. */
  className?: StateValue<string | undefined, OTPFieldState>;
  /**
   * Inline style, or a function of the state that returns one. The library's own inline style
   * (the Input covers the Root with transparent text) wins over these keys.
   */
  style?: StateValue<CSSProperties | undefined, OTPFieldState>;
  /** Must render an `<input>`. */
  render?: RenderProp<ComponentPropsWithRef<"input">, OTPFieldState>;
}

/**
 * The Input covers the Root with transparent text and caret (design 6). Functional, owned; the
 * outline is left to the consumer. Provisional until the device probes are done (changelog).
 */
const INPUT_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  inlineSize: "100%",
  blockSize: "100%",
  margin: 0,
  padding: 0,
  border: 0,
  background: "transparent",
  color: "transparent",
  caretColor: "transparent",
  forcedColorAdjust: "none",
};

/** The WebOTP request (design 8); not in the DOM typings yet. */
interface OTPCredentialRequest extends CredentialRequestOptions {
  otp: { transport: string[] };
}

/**
 * The one text input of an OTPField (design/components/otp-field.md 1, 4): `type="text"`,
 * `autocomplete="one-time-code"`, `inputmode` and `pattern` from the Root's `charset`, covering
 * the Root with transparent text. The only focusable and the only element assistive technology
 * sees. Registers with an enclosing `Field.Root` as `Field.Control` does.
 *
 * Owned keys (conventions 1.2): `type`, `value`, `pattern`, `name`, `form`, `required`,
 * `disabled`, `readOnly`, `onChange` (and the library's native `beforeinput`, composition,
 * selection and click listeners), the inline style above, the Field's `id`, `aria-describedby`
 * (token-merged) and `aria-invalid`, `data-complete`, `data-pending`, `data-disabled`,
 * `data-invalid`. Defaults the consumer's own prop replaces: `autoComplete="one-time-code"`,
 * `inputMode`, `autoCapitalize="off"`, `autoCorrect="off"`, `spellCheck={false}`.
 *
 * @see https://ui.funstack.work/components/otp-field
 */
export function OTPFieldInput({ className, style, render, ...rest }: OTPFieldInputProps) {
  const ctx = useOTPFieldContext("OTPField.Input");
  const { state, inputRef, experimentalWebOTP, webOTPAbort } = ctx;

  const field = useFieldControl({
    labelable: true,
    name: ctx.name,
    disabled: state.disabled,
    required: ctx.required,
    id: rest.id,
    component: "OTPField.Input",
  });

  const checkElement = useElementCheck(
    isDev &&
      ((element) =>
        element.tagName !== "INPUT"
          ? `OTPField.Input: rendered <${element.tagName.toLowerCase()}>. Render an <input>: ` +
            "the field's text, autofill and form value live in it."
          : null),
  );
  const libraryRef = useCallback(
    (element: HTMLElement) => {
      checkElement?.(element);
      inputRef.current = element as HTMLInputElement;
      return () => {
        if (inputRef.current === element) inputRef.current = null;
      };
    },
    [checkElement, inputRef],
  );
  const ref = useMergedRefs<HTMLElement>(libraryRef, field.ref);

  // --- Native listeners (design 4): React has no `beforeinput` and no `selectionchange`. -------

  const {
    beforeInput,
    compositionStart,
    compositionEnd,
    selectionChanged,
    blurred,
    click,
    inputMounted,
    webOTPCode,
  } = ctx;
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (input === null) return;
    const listeners: [string, (event: never) => void][] = [
      ["beforeinput", beforeInput],
      ["compositionstart", compositionStart],
      ["compositionend", compositionEnd],
      ["selectionchange", selectionChanged],
      ["select", selectionChanged],
      ["focus", selectionChanged],
      ["keyup", selectionChanged],
      ["blur", blurred],
      ["click", click],
    ];
    for (const [type, listener] of listeners) {
      input.addEventListener(type, listener as EventListener);
    }
    // Focused before hydration (or by `autoFocus`): no `focus` event will tell the Root.
    selectionChanged();
    return () => {
      for (const [type, listener] of listeners) {
        input.removeEventListener(type, listener as EventListener);
      }
    };
  }, [inputRef, beforeInput, compositionStart, compositionEnd, selectionChanged, blurred, click]);

  // Text typed, autofilled or restored before hydration is adopted once (design 9).
  const mounted = useRef(false);
  useLayoutEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    inputMounted();
  }, [inputMounted]);

  // --- WebOTP (design 8) ------------------------------------------------------------------------

  useEffect(() => {
    if (!experimentalWebOTP || !("OTPCredential" in window)) return;
    const controller = new AbortController();
    webOTPAbort.current = controller;
    const request: OTPCredentialRequest = {
      otp: { transport: ["sms"] },
      signal: controller.signal,
    };
    navigator.credentials.get(request).then(
      (credential) => {
        if (controller.signal.aborted) return;
        const code = (credential as { code?: unknown } | null)?.code;
        if (typeof code === "string") webOTPCode(code);
      },
      // Declined, no message, aborted: the normal outcomes.
      () => {},
    );
    return () => {
      controller.abort();
      if (webOTPAbort.current === controller) webOTPAbort.current = null;
    };
  }, [experimentalWebOTP, webOTPAbort, webOTPCode]);
  useFormOwnerEvent(inputRef, "submit", () => {
    webOTPAbort.current?.abort();
    webOTPAbort.current = null;
  });

  // --- Development: an unnamed input (design 5) -------------------------------------------------

  useEffect(() => {
    if (!isDev) return;
    const input = inputRef.current;
    if (input === null) return;
    const named =
      (input.labels?.length ?? 0) > 0 ||
      (input.getAttribute("aria-label") ?? "").trim() !== "" ||
      (input.getAttribute("aria-labelledby") ?? "").trim() !== "";
    if (!named) {
      console.error(
        "OTPField.Input: the input has no accessible name. Associate a <label for>, use " +
          "Field.Label, or give it aria-label / aria-labelledby.",
      );
    }
    // Mount only.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Render -----------------------------------------------------------------------------------

  const dataInvalid =
    ctx.fieldInvalid === undefined ? {} : { "data-invalid": dataAttr(ctx.fieldInvalid) };
  const libraryProps: ComponentPropsWithRef<"input"> & DataAttributes = {
    ...field.attributes,
    type: "text",
    value: ctx.inputText,
    pattern: charsetPattern(ctx.charset, state.length),
    name: field.name,
    form: ctx.form,
    required: field.required,
    disabled: field.disabled,
    readOnly: state.readOnly,
    onChange: ctx.change,
    style: INPUT_STYLE,
    "data-complete": dataAttr(state.complete),
    "data-pending": dataAttr(state.pending),
    "data-disabled": dataAttr(state.disabled),
    ...dataInvalid,
  };

  return useRender<ComponentPropsWithRef<"input">, OTPFieldState>({
    defaultElement: "input",
    render,
    state,
    className,
    style,
    children: undefined,
    props: {
      autoComplete: "one-time-code",
      inputMode: charsetInputMode(ctx.charset),
      autoCapitalize: "off",
      autoCorrect: "off",
      spellCheck: false,
      ...rest,
    },
    libraryProps,
    ref,
  });
}

OTPFieldInput.displayName = "OTPFieldInput";

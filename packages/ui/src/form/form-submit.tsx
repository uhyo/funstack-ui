"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useElementCheck } from "../internal/use-element-check.js";
import { rendersButton, useRender } from "../internal/use-render.js";

const isDev = process.env.NODE_ENV !== "production";

export interface FormSubmitState {
  /** The enclosing form's submission is in flight (`useFormStatus().pending`). */
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface FormSubmitProps extends Omit<
  ComponentPropsWithRef<"button">,
  "type" | "className" | "style" | "children"
> {
  /**
   * Native `disabled`; owned. Never set by the library (conventions 3.6). Always native, also
   * with a component `render`: a submitter has no handler to honour `aria-disabled`.
   */
  disabled?: boolean;
  className?: StateValue<string | undefined, FormSubmitState>;
  style?: StateValue<CSSProperties | undefined, FormSubmitState>;
  children?: StateValue<ReactNode, FormSubmitState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, FormSubmitState>;
}

/**
 * The form's submit button: `<button type="submit">` with `data-pending` while the enclosing
 * form's submission is in flight (`useFormStatus`). Works in any React-rendered form
 * (`Form.Root`, `Dialog.Form`, a plain `<form action>`). Never disabled while pending: block
 * repeat clicks with CSS on `[data-pending]` if you need to.
 *
 * Owned keys (conventions 1.2): `type` (on a `<button>`), `disabled`, `data-pending`,
 * `data-disabled`.
 */
export function FormSubmit({
  disabled = false,
  className,
  style,
  children,
  render,
  ...rest
}: FormSubmitProps) {
  const { pending } = useFormStatus();
  const ref = useElementCheck(
    isDev &&
      ((el) => {
        const submitter =
          el.tagName === "BUTTON" ||
          (el.tagName === "INPUT" && ["submit", "image"].includes((el as HTMLInputElement).type));
        return submitter
          ? null
          : `Form.Submit: expected to render a <button> (or <input type="submit">) but got ` +
              `<${el.tagName.toLowerCase()}>. Only a submit button submits the form natively.`;
      }),
  );
  const state: FormSubmitState = { pending, disabled };
  return useRender<ComponentPropsWithRef<"button">, FormSubmitState>({
    defaultElement: "button",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: {
      ...(rendersButton(render) && { type: "submit" as const }),
      disabled,
      "data-pending": dataAttr(pending),
      "data-disabled": dataAttr(disabled),
    },
    ref,
  });
}

FormSubmit.displayName = "FormSubmit";

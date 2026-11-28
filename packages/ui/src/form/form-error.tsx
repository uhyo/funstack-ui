"use client";
import { use, useLayoutEffect } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { dataAttr } from "../internal/data-attr.js";
import { FormContext } from "../internal/form/field-context.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";

/**
 * State of `Form.Error`, passed to the function forms of `className`, `style`, `children` and
 * `render`.
 */
export interface FormErrorState {
  /** The form-level messages: `Form.Root error`, normalised. Never empty while the part renders. */
  readonly messages: readonly string[];
  /** The enclosing form's submission is in flight (`useFormStatus().pending`). */
  readonly pending: boolean;
}

/**
 * Props of `Form.Error`.
 *
 * @see https://ui.funstack.work/components/field
 */
export interface FormErrorProps extends Omit<
  ComponentPropsWithRef<"div">,
  "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, FormErrorState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, FormErrorState>;
  /**
   * Rendered only while the form has a form-level error (`Form.Root error`). A function gets the
   * state. Must not suspend.
   *
   * @defaultValue `state.messages` joined by a space
   */
  children?: StateValue<ReactNode, FormErrorState>;
  /** Replace the default `<div>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"div">, FormErrorState>;
}

function defaultChildren(state: FormErrorState): ReactNode {
  return state.messages.join(" ");
}

/**
 * The form-level error (design/components/field-form.md 3.7, 4.7): a `div` rendered exactly while
 * `Form.Root error` has a message, a mirror of the prop (also at mount and while the next
 * submission is in flight). No role and no live region: while it is mounted the Form announces
 * the messages through `ariaNotify()` when a submission settles, and moves no focus.
 *
 * Owned keys (conventions 1.2): `data-pending`.
 *
 * @see https://ui.funstack.work/components/field
 */
export function FormError({
  className,
  style,
  children = defaultChildren,
  render,
  ...rest
}: FormErrorProps) {
  const form = use(FormContext);
  if (form === null) throw new Error("Form.Error must be rendered inside a Form.Root.");
  const { registerFormError } = form;
  useLayoutEffect(registerFormError, [registerFormError]);
  const { pending } = useFormStatus();
  const state: FormErrorState = { messages: form.error, pending };
  const element = useRender<ComponentPropsWithRef<"div">, FormErrorState>({
    defaultElement: "div",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: { "data-pending": dataAttr(pending) },
  });
  return form.error.length > 0 ? element : null;
}

FormError.displayName = "FormError";

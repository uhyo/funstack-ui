"use client";
import type { ComponentPropsWithRef, CSSProperties } from "react";
import { useFieldContext } from "../internal/field-context.js";
import type { FieldState } from "../internal/field-context.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useFieldControl } from "../internal/use-field-control.js";
import { useRender } from "../internal/use-render.js";
import { fieldDataAttributes } from "./field-root.js";
import { useMergedRefs } from "../internal/use-merged-refs.js";
import { useElementCheck } from "../internal/use-element-check.js";

export interface FieldControlProps extends Omit<
  ComponentPropsWithRef<"input">,
  "id" | "aria-invalid" | "className" | "style" | "children"
> {
  /** Native `name`; defaults to the Field's `name`. */
  name?: string;
  /** Native `disabled`; the Field's `disabled` also disables the control. Owned. */
  disabled?: boolean;
  /** Native `required`; the Field's `required` also requires the control. Owned. */
  required?: boolean;
  className?: StateValue<string | undefined, FieldState>;
  style?: StateValue<CSSProperties | undefined, FieldState>;
  /** Must render an `<input>`, `<textarea>` or `<select>`: `render={<textarea rows={3} />}`. */
  render?: RenderProp<ComponentPropsWithRef<"input">, FieldState>;
}

const CONTROL_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * The field's native control: an `<input>` (or a `<textarea>` / `<select>` through `render`)
 * wired to the Field: `id` for the Label, `aria-describedby` (the consumer's tokens, the
 * description, the error while shown), an explicit `aria-invalid`, and `name` / `disabled` /
 * `required` from the Field unless given. Everything else passes through, including `onChange`
 * / `value` for a controlled input; the Field's listeners are native and run independently.
 *
 * Owned keys (conventions 1.2): `id`, `name`, `disabled`, `required`, `aria-invalid`,
 * `aria-describedby` (token-merged), `data-invalid`, `data-disabled`, `data-required`,
 * `data-pending`.
 */
export function FieldControl({
  name,
  disabled,
  required,
  className,
  style,
  render,
  ...rest
}: FieldControlProps) {
  const ctx = useFieldContext("Field.Control");
  // `id` is not in the props type (the Field owns it); a JS caller's is ignored with a warning.
  const { id: consumerId, ...props } = rest as typeof rest & { id?: string };
  const field = useFieldControl({
    labelable: true,
    name,
    disabled,
    required,
    id: consumerId,
    component: "Field.Control",
  });
  const checkElement = useElementCheck((el) =>
    !CONTROL_TAGS.has(el.tagName)
      ? "Field.Control: expected to render an <input>, <textarea> or <select> but got " +
        `<${el.tagName.toLowerCase()}>. Validation, labelling and form participation need a ` +
        "native form control."
      : null,
  );
  const ref = useMergedRefs<HTMLElement>(checkElement, field.ref);

  return useRender<ComponentPropsWithRef<"input">, FieldState>({
    defaultElement: "input",
    render,
    state: ctx.state,
    className,
    style,
    children: undefined,
    props,
    libraryProps: {
      id: field.id,
      name: field.name,
      disabled: field.disabled,
      required: field.required,
      ...field.attributes,
      ...fieldDataAttributes(ctx.state),
    },
    ref,
  });
}

FieldControl.displayName = "FieldControl";

"use client";
import { use } from "react";
import type { ComponentPropsWithRef, CSSProperties } from "react";
import { FieldContext, fieldDataAttributes } from "../internal/form/field-context.js";
import type { FieldState } from "../internal/form/field-context.js";
import { VALID } from "../internal/form/validity.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useElementCheck } from "../internal/use-element-check.js";
import { useFieldControl } from "../internal/form/use-field-control.js";
import { useMergedRefs } from "../internal/use-merged-refs.js";
import { useRender } from "../internal/use-render.js";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Props of `Field.Control`.
 *
 * @see https://ui.funstack.work/components/field
 */
export interface FieldControlProps extends Omit<
  ComponentPropsWithRef<"input">,
  "id" | "aria-invalid" | "className" | "style" | "children"
> {
  /**
   * Native `id`, used outside a `Field.Root` only. Inside one the Field owns the id (so that
   * `Field.Label` can point at it) and this prop is ignored with a development warning.
   */
  id?: string;
  /**
   * Native `name`.
   *
   * @defaultValue the Field's `name`
   */
  name?: string;
  /**
   * Native `disabled`. Owned. Also `true` when the Field is disabled: an explicit `false` does not
   * override the Field.
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
  /**
   * Native `required`. Owned. Also `true` when the Field is required: an explicit `false` does not
   * override the Field.
   *
   * @defaultValue `false`
   */
  required?: boolean;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, FieldState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, FieldState>;
  /** Must render an `<input>`, `<textarea>` or `<select>`: `render={<textarea rows={3} />}`. */
  render?: RenderProp<ComponentPropsWithRef<"input">, FieldState>;
}

const CONTROL_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * The states the function props receive outside a `Field.Root` (design/components/field-form.md
 * 4.3): never invalid or pending (no validation without a Field), with `disabled` / `required`
 * from the control's own props, as inside a Field and as a standalone Checkbox reports them.
 * One frozen object per combination, indexed `disabled * 2 + required`.
 */
const NO_MESSAGES: readonly string[] = Object.freeze([]);
const STANDALONE_STATES: readonly FieldState[] = [false, true].flatMap((disabled) =>
  [false, true].map((required) =>
    Object.freeze({
      invalid: false,
      messages: NO_MESSAGES,
      validity: VALID,
      disabled,
      required,
      pending: false,
    }),
  ),
);

function standaloneState(disabled: boolean | undefined, required: boolean | undefined) {
  return STANDALONE_STATES[(disabled === true ? 2 : 0) + (required === true ? 1 : 0)]!;
}

/**
 * The field's native control: an `<input>` (or a `<textarea>` / `<select>` through `render`)
 * wired to the Field: `id` for the Label, `aria-describedby` (the consumer's tokens, the
 * description, the error while shown), an explicit `aria-invalid`, and `name` / `disabled` /
 * `required` from the Field unless given. Everything else passes through, including `onChange`
 * / `value` for a controlled input; the Field's listeners are native and run independently.
 *
 * Owned keys inside a Field (conventions 1.2): `id`, `name`, `disabled`, `required`,
 * `aria-invalid`, `aria-describedby` (token-merged), `data-invalid`, `data-disabled`,
 * `data-required`, `data-pending`.
 *
 * Outside a `Field.Root` it is the plain native control: every prop passes through (`id`
 * included), the library adds no attribute, and the function props receive a state that is
 * never invalid or pending, with `disabled` / `required` from the own props.
 *
 * @see https://ui.funstack.work/components/field
 */
export function FieldControl({
  id: consumerId,
  name,
  disabled,
  required,
  className,
  style,
  render,
  ...props
}: FieldControlProps) {
  const ctx = use(FieldContext);
  const field = useFieldControl({
    labelable: true,
    name,
    disabled,
    required,
    id: consumerId,
    component: "Field.Control",
  });
  const checkElement = useElementCheck(
    isDev &&
      ((el) =>
        !CONTROL_TAGS.has(el.tagName)
          ? "Field.Control: expected to render an <input>, <textarea> or <select> but got " +
            `<${el.tagName.toLowerCase()}>. Validation, labelling and form participation need a ` +
            "native form control."
          : null),
  );
  const ref = useMergedRefs<HTMLElement>(checkElement, field.ref);

  return useRender<ComponentPropsWithRef<"input">, FieldState>({
    defaultElement: "input",
    render,
    state: ctx === null ? standaloneState(disabled, required) : ctx.state,
    className,
    style,
    children: undefined,
    // Outside a Field the own props are ordinary pass-through: a `render` element's own `id` /
    // `disabled` / `required` win over them, as for any pass-through prop (conventions 1.2).
    props: ctx === null ? { ...props, id: consumerId, name, disabled, required } : props,
    libraryProps:
      ctx === null
        ? undefined
        : {
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

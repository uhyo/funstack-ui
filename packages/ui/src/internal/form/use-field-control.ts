"use client";
import { use, useCallback, useLayoutEffect, useRef } from "react";
import type { RefCallback } from "react";
import { dataAttr } from "../data-attr.js";
import { FieldContext } from "./field-context.js";
import type { FieldContextValue, FieldState } from "./field-context.js";
import { useDevWarning } from "../use-dev-warning.js";
import type { ValidatableElement } from "./validity.js";

const isDev = process.env.NODE_ENV !== "production";

export interface UseFieldControlOptions {
  /** `<label for>` can target the element (input, select, textarea). Groups pass `false`. */
  readonly labelable: boolean;
  /** The control's own props, so "own or the Field's" can be computed. */
  readonly name?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly required?: boolean | undefined;
  /** The control's own `readOnly` (conventions 3.6.1). */
  readonly readOnly?: boolean | undefined;
  /** The consumer's own `id` prop: ignored inside a Field (the Field owns it), with a warning. */
  readonly id?: string | undefined;
  /** Dev warning tag. */
  readonly component: string;
  /**
   * The element whose validity is real when it is not the registered one (NumberField's hidden
   * number input; field-form.md `validityElement`). Keep its identity stable.
   */
  readonly validityElement?: (() => ValidatableElement | null) | undefined;
}

/** The ARIA and state attributes a part spreads into its owned layer. */
export interface FieldControlAttributes {
  /** Labelable controls only: the id `Field.Label`'s `for` points at. */
  id?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: "true" | "false";
  "data-invalid"?: "" | undefined;
}

export interface FieldControlBinding {
  /** The control is inside a `Field.Root`. */
  readonly inField: boolean;
  /** Merge into the part's library ref: registers the element with the Field. `undefined` outside a Field. */
  readonly ref: RefCallback<HTMLElement> | undefined;
  /** The control id the Field's Label points at (labelable controls inside a Field), else the consumer's. */
  readonly id: string | undefined;
  /** Own `name` ?? the Field's. */
  readonly name: string | undefined;
  /** The Field's own `name` (`undefined` outside a Field or when it has none). */
  readonly fieldName: string | undefined;
  /** Own `disabled` || the Field's. */
  readonly disabled: boolean;
  /** Own `required` || the Field's. */
  readonly required: boolean;
  /** Own `readOnly` || the Field's (conventions 3.6.1). */
  readonly readOnly: boolean;
  /**
   * Owned attributes: `id` (labelable controls), `aria-invalid`, `data-invalid`,
   * `aria-labelledby` (groups) and `aria-describedby` (both token-merged by the owned layer, the
   * consumer's tokens first). Empty outside a Field, so nothing is owned there.
   */
  readonly attributes: FieldControlAttributes;
  /** The Field's state, `undefined` outside a Field. */
  readonly state: FieldState | undefined;
}

/**
 * "Own or the Field's" (design/components/field-form.md 7.1): `name` falls back to the Field's,
 * `disabled`, `required` and `readOnly` are either's. Outside a Field (`field === null`) the own
 * props.
 */
export function resolveFieldDefaults(
  field: Pick<FieldContextValue, "name" | "disabled" | "required" | "readOnly"> | null,
  own: {
    readonly name: string | undefined;
    readonly disabled: boolean;
    readonly required: boolean;
    readonly readOnly: boolean;
  },
): { name: string | undefined; disabled: boolean; required: boolean; readOnly: boolean } {
  if (field === null) {
    return {
      name: own.name,
      disabled: own.disabled,
      required: own.required,
      readOnly: own.readOnly,
    };
  }
  return {
    name: own.name ?? field.name,
    disabled: own.disabled || field.disabled,
    required: own.required || field.required,
    readOnly: own.readOnly || field.readOnly,
  };
}

/**
 * The owned props of a labelable native control (`<input>`, `<select>`) inside a Field: the
 * ARIA wiring plus `name` and `required` ("own or the Field's"). Empty outside a Field, so the
 * consumer's own `id` / `name` / `required` keep passing through untouched there.
 *
 * `withholdRequired`: a control the platform does not bar from validation while read-only (a
 * checkbox, a `<select>`) passes `true`; native `required` is then owned and absent while the
 * control is read-only, inside a Field and outside (conventions 3.6.1 rule 5).
 */
export function fieldInputProps(
  field: FieldControlBinding,
  withholdRequired = false,
): FieldControlAttributes & {
  name?: string | undefined;
  required?: boolean;
} {
  const withheld = withholdRequired && field.readOnly ? { required: false } : null;
  if (!field.inField) return withheld ?? {};
  return { ...field.attributes, name: field.name, required: field.required, ...withheld };
}

/**
 * The contract between a Field and its control (design/components/field-form.md 7.1), called by
 * `Field.Control` and by the owner part of every FUNSTACK form control. Outside a `Field.Root` it
 * returns the control's own props and nothing to merge.
 *
 * Inside a Field: registers the element from the returned ref (the Field attaches its listeners
 * and reads validity there; a group's `<fieldset>` makes `Field.Label` drop `for`), resolves "own
 * or the Field's" for `name` / `disabled` / `required`, and returns the owned ARIA wiring.
 */
export function useFieldControl(options: UseFieldControlOptions): FieldControlBinding {
  const {
    labelable,
    name,
    disabled = false,
    required = false,
    readOnly = false,
    id,
    component,
    validityElement,
  } = options;
  const field = use(FieldContext);
  const registerControl = field?.registerControl;
  // Registered resolved: the Field bars the control from validation whichever of the two set it.
  const resolvedReadOnly = readOnly || (field?.readOnly ?? false);

  const ref = useCallback(
    (element: HTMLElement) => {
      if (registerControl === undefined) return () => {};
      return registerControl({
        element,
        labelable,
        required,
        disabled,
        readOnly: resolvedReadOnly,
        validityElement,
      });
    },
    [registerControl, labelable, required, disabled, resolvedReadOnly, validityElement],
  );

  useDevWarning(
    field !== null && id !== undefined,
    isDev &&
      `${component}: the \`id\` prop is ignored inside a Field.Root; the Field owns the control's ` +
        "id so that Field.Label can point at it.",
  );
  useDevWarning(
    field !== null && name !== undefined && field.name !== undefined && name !== field.name,
    isDev &&
      `${component}: its \`name\` ("${name}") differs from the Field.Root's ("${field?.name}"). ` +
        "The Field reads server errors and `validate`'s value by the Field's name.",
  );

  if (field === null) {
    return {
      inField: false,
      ref: undefined,
      id,
      name,
      fieldName: undefined,
      disabled,
      required,
      readOnly,
      attributes: {},
      state: undefined,
    };
  }

  const { ids, state } = field;
  const attributes: FieldControlAttributes = {
    "aria-describedby": state.invalid ? `${ids.description} ${ids.error}` : ids.description,
    "aria-invalid": state.invalid ? "true" : "false",
    "data-invalid": dataAttr(state.invalid),
  };
  if (labelable) attributes.id = ids.control;
  else attributes["aria-labelledby"] = ids.label;

  return {
    inField: true,
    ref,
    id: labelable ? ids.control : undefined,
    ...resolveFieldDefaults(field, { name, disabled, required, readOnly }),
    fieldName: field.name,
    attributes,
    state,
  };
}

/**
 * Tells the enclosing Field (if any) that the control's value changed, after the commit that
 * wrote it to the DOM (design/components/field-form.md 2.1: `validate` and the mirror follow the
 * value). Needed where the DOM changes without an `input` / `change` event the Field hears: a
 * Combobox selection (React writes the hidden input), a CheckboxGroup's derived `required`, a
 * Parent checking Items, a rejected action rolling the value back. Nothing at mount.
 *
 * `takeEdit` is read when the value changed: `true` when the user made this change (a shown
 * server error is dismissed, like an `input` event would). Native controls whose own events
 * already dismiss pass nothing.
 */
export function useFieldValueChange(value: unknown, takeEdit?: () => boolean): void {
  const notifyChange = use(FieldContext)?.notifyChange;
  const previous = useRef(value);
  // No deps: compares with the last committed value after every commit of the caller.
  useLayoutEffect(() => {
    if (Object.is(previous.current, value)) return;
    previous.current = value;
    const edit = takeEdit?.() ?? false;
    notifyChange?.(edit);
  });
}

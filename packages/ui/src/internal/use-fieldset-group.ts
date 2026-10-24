"use client";
import { useCallback, useId, useRef } from "react";
import type { Ref, RefObject } from "react";
import type { FieldControlBinding } from "./use-field-control.js";
import { useFieldControl } from "./use-field-control.js";
import { useElementCheck } from "./use-element-check.js";
import { useMergedRefs } from "./use-merged-refs.js";

const isDev = process.env.NODE_ENV !== "production";

export interface UseFieldsetGroupOptions {
  /** Dev warning tag (`"RadioGroup.Root"`). */
  readonly component: string;
  /** The Root's own `name` / `disabled` / `required` props. */
  readonly name: string | undefined;
  readonly disabled: boolean | undefined;
  readonly required: boolean | undefined;
}

export interface FieldsetGroup {
  readonly field: FieldControlBinding;
  /** Own `name`, else the Field's, else a `useId()` value. */
  readonly name: string;
  /** Own `required` or the Field's. */
  readonly required: boolean;
  /** Own `disabled` or the Field's. */
  readonly disabled: boolean;
  /** The rendered `<fieldset>`. */
  readonly fieldsetRef: RefObject<HTMLFieldSetElement | null>;
  /** The Root's library ref: fills `fieldsetRef`, checks the element, registers with the Field. */
  readonly rootRef: Ref<HTMLFieldSetElement> | undefined;
}

/**
 * The `<fieldset>` wiring of a native-input group Root (`RadioGroup.Root`,
 * `CheckboxGroup.Root`). Inside a `Field.Root` (design/components/field-form.md 7.2) the fieldset
 * is the Field's group control: `aria-labelledby` → `Field.Label`, the ARIA wiring, and `name` /
 * `required` / `disabled` defaulting from the Field.
 */
export function useFieldsetGroup(options: UseFieldsetGroupOptions): FieldsetGroup {
  const { component } = options;
  const field = useFieldControl({
    labelable: false,
    name: options.name,
    disabled: options.disabled,
    required: options.required,
    component,
  });
  const fallbackName = useId();
  const fieldsetRef = useRef<HTMLFieldSetElement | null>(null);

  const checkElement = useElementCheck<HTMLFieldSetElement>(
    isDev &&
      ((el) =>
        el.tagName !== "FIELDSET"
          ? `${component}: expected to render a <fieldset> element but got ` +
            `<${el.tagName.toLowerCase()}>. The platform semantics (legend naming, disabled ` +
            `inheritance, form reset) need a real <fieldset>.`
          : null),
  );
  const libraryRef = useCallback(
    (el: HTMLFieldSetElement) => {
      fieldsetRef.current = el;
      checkElement?.(el);
      return () => {
        fieldsetRef.current = null;
      };
    },
    [checkElement],
  );
  const rootRef = useMergedRefs<HTMLFieldSetElement>(libraryRef, field.ref);

  return {
    field,
    name: field.name ?? fallbackName,
    required: field.required,
    disabled: field.disabled,
    fieldsetRef,
    rootRef,
  };
}

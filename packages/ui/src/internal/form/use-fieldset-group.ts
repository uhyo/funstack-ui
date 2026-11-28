"use client";
import { useCallback, useId, useRef } from "react";
import type { Ref, RefObject } from "react";
import type { FieldControlBinding } from "./use-field-control.js";
import { useFieldControl } from "./use-field-control.js";
import { useElementCheck } from "../use-element-check.js";
import type { ElementCheck } from "../use-element-check.js";
import { useMergedRefs } from "../use-merged-refs.js";
import { GROUP_NAME, useNameWarning } from "../use-name-warning.js";

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
  /** Inside a `Field.Root`: the Field shows an error (`data-invalid`). `false` outside. */
  readonly invalid: boolean;
  /** The rendered `<fieldset>`. */
  readonly fieldsetRef: RefObject<HTMLFieldSetElement | null>;
  /** The Root's library ref: fills `fieldsetRef`, checks the element, registers with the Field. */
  readonly rootRef: Ref<HTMLFieldSetElement> | undefined;
}

/**
 * The `<fieldset>` wiring of a native-input group Root (`RadioGroup.Root`,
 * `CheckboxGroup.Root`). Inside a `Field.Root` (design/components/field-form.md 7.2) the fieldset
 * is the Field's group control: `aria-labelledby` → `Field.Label`, the ARIA wiring, and `name` /
 * `required` / `disabled` defaulting from the Field. In development the group warns when it has
 * no accessible name: no `<legend>` (its `Label`), `aria-label` or `aria-labelledby`
 * (conventions 9.5).
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
  const checkName: ElementCheck<HTMLFieldSetElement> | undefined = useNameWarning(
    isDev &&
      `${component}: the group has no accessible name. Render a ${component.split(".")[0]}.Label ` +
        "(its <legend>) or a Field.Label, or give the Root aria-label / aria-labelledby.",
    GROUP_NAME,
  );
  const rootRef = useMergedRefs<HTMLFieldSetElement>(libraryRef, field.ref, checkName);

  return {
    field,
    name: field.name ?? fallbackName,
    required: field.required,
    disabled: field.disabled,
    invalid: field.state?.invalid ?? false,
    fieldsetRef,
    rootRef,
  };
}

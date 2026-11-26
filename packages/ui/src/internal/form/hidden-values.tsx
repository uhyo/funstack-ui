// No "use client" directive: a plain component with no hook, rendered by the client Roots that
// use it (conventions 7.1).
import type { ReactNode, Ref } from "react";

export interface HiddenValuesProps {
  /** The `name` of every input; `undefined` renders nothing. */
  readonly name: string | undefined;
  readonly form: string | undefined;
  /** The optimistic selection, in value order. */
  readonly values: readonly string[];
  /** Attached to the first input: the form-associated element of the reset listener and a Field. */
  readonly inputRef: Ref<HTMLInputElement>;
}

/**
 * The form value of a set-valued Root that has no form element of its own, Combobox `multiple`
 * and MultiSelect (design/components/combobox.md 15.8, multi-select.md B.10; conventions 1.1):
 * one `<input type="hidden" name value>` per value, in value order. An empty selection keeps one
 * nameless input, which posts nothing but is still the form-associated element of the reset
 * listener and an enclosing Field.
 */
export function HiddenValues({ name, form, values, inputRef }: HiddenValuesProps): ReactNode {
  if (name === undefined) return null;
  if (values.length === 0)
    return <input key="" ref={inputRef} type="hidden" form={form} value="" />;
  return values.map((v, i) => (
    <input
      key={`v:${v}`}
      ref={i === 0 ? inputRef : undefined}
      type="hidden"
      name={name}
      form={form}
      value={v}
    />
  ));
}

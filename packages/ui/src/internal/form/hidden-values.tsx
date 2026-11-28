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
  /**
   * The owner is disabled (its own prop or the Field's): every input, the unnamed one included,
   * is `disabled` and posts nothing (conventions 3.6). A disabled input is still form-associated,
   * so it still receives `reset` and still registers with the Field.
   */
  readonly disabled: boolean;
}

/**
 * The form value of a set-valued Root that has no form element of its own, Combobox `multiple`
 * and MultiSelect (design/components/combobox.md 15.8, multi-select.md B.10; conventions 1.1):
 * one `<input type="hidden" name value>` per value, in value order. An empty selection keeps one
 * nameless input, which posts nothing but is still the form-associated element of the reset
 * listener and an enclosing Field. A disabled owner is not submitted (conventions 3.6).
 */
export function HiddenValues({
  name,
  form,
  values,
  inputRef,
  disabled,
}: HiddenValuesProps): ReactNode {
  if (name === undefined) return null;
  if (values.length === 0)
    return <input key="" ref={inputRef} type="hidden" form={form} value="" disabled={disabled} />;
  return values.map((v, i) => (
    <input
      key={`v:${v}`}
      ref={i === 0 ? inputRef : undefined}
      type="hidden"
      name={name}
      form={form}
      value={v}
      disabled={disabled}
    />
  ));
}

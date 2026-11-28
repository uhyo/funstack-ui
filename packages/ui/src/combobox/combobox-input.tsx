"use client";
import { isValidElement, useCallback } from "react";
import type {
  ChangeEvent,
  ComponentPropsWithRef,
  CSSProperties,
  FocusEvent,
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
} from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { registerTrigger } from "../internal/overlay/trigger-ref.js";
import { useElementCheck } from "../internal/use-element-check.js";
import { useFieldControl } from "../internal/form/use-field-control.js";
import { useMergedRefs } from "../internal/use-merged-refs.js";
import { useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { optionId, useComboboxContext } from "./combobox-context.js";

const isDev = process.env.NODE_ENV !== "production";

/** State of `Combobox.Input`, passed to the function forms of `className`, `style` and `render`. */
export interface ComboboxInputState {
  /** Optimistic selection; always `null` with `multiple` (read `values`). */
  readonly value: string | null;
  /** Optimistic selection as a list: pick order with `multiple`, `[value]` or `[]` otherwise. */
  readonly values: readonly string[];
  /** The urgent text. */
  readonly inputValue: string;
  /** Optimistic open state. */
  readonly open: boolean;
  /** The Root is pending (a selection or an open in flight). */
  readonly pending: boolean;
  /** The results shown are for an older text. */
  readonly stale: boolean;
  /**
   * Nothing is selected (`data-empty`): the optimistic value is `null`, or has no entries with
   * `multiple`. "Has a value" is `:not([data-empty])`.
   */
  readonly empty: boolean;
  /** The Root's `disabled` (or the Field's). */
  readonly disabled: boolean;
  /** Inside a `Field.Root`: an error is shown for the field (`data-invalid`). `false` outside. */
  readonly invalid: boolean;
  /** The Input's own `required`, or the enclosing Field's. */
  readonly required: boolean;
}

/**
 * Props of `Combobox.Input`.
 *
 * @see https://ui.funstack.work/components/combobox
 */
export interface ComboboxInputProps extends Omit<
  ComponentPropsWithRef<"input">,
  | "value"
  | "defaultValue"
  | "onChange"
  | "onInput"
  | "onKeyDown"
  | "onFocus"
  | "onBlur"
  | "onClick"
  | "onPointerDown"
  | "role"
  | "aria-autocomplete"
  | "aria-expanded"
  | "aria-controls"
  | "aria-activedescendant"
  | "autoComplete"
  | "disabled"
  | "readOnly"
  | "className"
  | "style"
  | "children"
> {
  /**
   * Native `required`: empty text is `valueMissing`. With `multiple` it means "at least one
   * value": native `required` is rendered only while the selection is empty, and
   * `aria-required="true"` always.
   */
  required?: boolean;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, ComboboxInputState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, ComboboxInputState>;
  /** Must render an `<input>` of type `text` or `search`. */
  render?: RenderProp<ComponentPropsWithRef<"input">, ComboboxInputState>;
}

/**
 * The text field: `<input role="combobox" aria-autocomplete="list" aria-expanded aria-controls
 * aria-activedescendant autocomplete="off">`. DOM focus stays here while the active option moves
 * virtually (design 7.1). Its text is the Root's urgent `inputValue`; typing opens the listbox.
 * `readOnly` is not accepted (conventions 3.6): the options, the Trigger and `Clear` would still
 * change the value.
 *
 * Owned keys (conventions 1.2): `id`, `type`, `role`, `value`, `autoComplete`,
 * `aria-autocomplete`, `aria-expanded`, `aria-controls` (token-merged), `aria-activedescendant`,
 * `disabled`, `onChange`, `onKeyDown`, `onFocus` and `onBlur` (focus arriving starts the press
 * watch that decides a focus loss), `onClick`, `onPointerDown` (a primary-button press while the
 * listbox is shown captures the pointer to the Popup, so it is no light dismiss), `data-open`,
 * `data-pending`, `data-empty`, `data-stale`, `data-disabled`; inside a `Field.Root` (whose
 * control id it takes) also `required` (own or the Field's), `aria-describedby` (token-merged),
 * `aria-invalid` and `data-invalid`; with `multiple`, `required` (only while nothing is selected)
 * and `aria-required`. `onFocusCapture` passes through.
 *
 * @see https://ui.funstack.work/components/combobox
 */
export function ComboboxInput({ className, style, render, ...rest }: ComboboxInputProps) {
  const ctx = useComboboxContext("Combobox.Input");
  const { popover, ids, inputRef } = ctx;
  const { triggerRef } = popover;

  const checkElement = useElementCheck(
    isDev &&
      ((element) => {
        const type = element.tagName === "INPUT" ? (element as HTMLInputElement).type : "";
        return type !== "text" && type !== "search"
          ? `Combobox.Input: rendered <${element.tagName.toLowerCase()}` +
              `${type === "" ? "" : ` type="${type}"`}>. Render an <input> of type "text" or ` +
              '"search": `role="combobox"`, `aria-activedescendant` and the caret keys depend on it.'
          : null;
      }),
  );
  const ref = useCallback(
    (element: HTMLElement) => {
      checkElement?.(element);
      inputRef.current = element as HTMLInputElement;
      // The popover's "trigger" is the input: `showPopover({ source: input })` anchors the
      // listbox to it and stacks a nested listbox under its popover (design 5.1). It does not
      // exempt presses on the input from light dismiss; `onPointerDown` does that.
      const unregister = registerTrigger(triggerRef, element, "Combobox.Input");
      return () => {
        if (inputRef.current === element) inputRef.current = null;
        unregister();
      };
    },
    [checkElement, inputRef, triggerRef],
  );

  // Inside a Field.Root (design/components/field-form.md 7.2) the Input is the Field's control:
  // the Root already took the Field's id for it; `required` and the ARIA wiring land here.
  const field = useFieldControl({
    labelable: true,
    required: rest.required,
    disabled: ctx.disabled,
    id: rest.id,
    component: "Combobox.Input",
  });
  const fieldRef = field.ref;
  const mergedRef = useMergedRefs<HTMLElement>(ref, fieldRef);

  const searchType = isValidElement<{ type?: unknown }>(render) && render.props.type === "search";

  // `multiple` (design 15.8): `required` means "at least one value", a computed native attribute
  // (conventions 3.6) that follows the optimistic selection; `aria-required` says it throughout.
  const required = field.inField ? field.required : rest.required === true;
  const requiredProps = ctx.multiple
    ? { required: required && ctx.values.length === 0, "aria-required": required || undefined }
    : field.inField && { required: field.required };

  const state: ComboboxInputState = {
    value: ctx.value,
    values: ctx.values,
    inputValue: ctx.inputValue,
    open: popover.optimistic,
    pending: ctx.pending,
    stale: ctx.stale,
    empty: ctx.values.length === 0,
    disabled: ctx.disabled,
    invalid: field.state?.invalid ?? false,
    required,
  };

  const libraryProps: ComponentPropsWithRef<"input"> & DataAttributes = {
    ...field.attributes,
    ...requiredProps,
    id: ids.input,
    type: searchType ? "search" : "text",
    role: "combobox",
    value: ctx.inputValue,
    autoComplete: "off",
    "aria-autocomplete": "list",
    // Shown (the listbox is in the top layer); `data-open` is the optimistic one.
    "aria-expanded": popover.shown,
    "aria-controls": ids.list,
    "aria-activedescendant":
      ctx.activeValue === null ? undefined : optionId(ids.optionPrefix, ctx.activeValue),
    disabled: ctx.disabled,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      ctx.typed(event.currentTarget.value, event.nativeEvent);
    },
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      ctx.keyDown(event.nativeEvent);
    },
    onFocus: (event: FocusEvent<HTMLInputElement>) => {
      ctx.focusIn(event.nativeEvent);
    },
    onBlur: (event: FocusEvent<HTMLInputElement>) => {
      ctx.focusOut(event.nativeEvent);
    },
    onClick: (event: MouseEvent<HTMLInputElement>) => {
      ctx.inputClick(event.nativeEvent);
    },
    onPointerDown: (event: PointerEvent<HTMLInputElement>) => {
      ctx.inputPointerDown(event.nativeEvent);
    },
    "data-open": dataAttr(popover.optimistic),
    "data-pending": dataAttr(state.pending),
    "data-empty": dataAttr(state.empty),
    "data-stale": dataAttr(ctx.stale),
    "data-disabled": dataAttr(ctx.disabled),
  };

  return useRender<ComponentPropsWithRef<"input">, ComboboxInputState>({
    defaultElement: "input",
    render,
    state,
    className,
    style,
    children: undefined,
    props: rest,
    libraryProps,
    ref: mergedRef,
  });
}

ComboboxInput.displayName = "ComboboxInput";

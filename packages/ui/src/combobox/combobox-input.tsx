"use client";
import { isValidElement, useCallback } from "react";
import type {
  ChangeEvent,
  ComponentPropsWithRef,
  CSSProperties,
  FocusEvent,
  KeyboardEvent,
  MouseEvent,
} from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useElementCheck } from "../internal/use-element-check.js";
import { useFieldControl } from "../internal/use-field-control.js";
import { useMergedRefs } from "../internal/use-merged-refs.js";
import { useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { optionId, useComboboxContext } from "./combobox-context.js";

const isDev = process.env.NODE_ENV !== "production";

export interface ComboboxInputState {
  /** Optimistic selection. */
  readonly value: string | null;
  /** The urgent text. */
  readonly inputValue: string;
  /** Optimistic open state. */
  readonly open: boolean;
  /** The Root is pending (a selection or an open in flight). */
  readonly pending: boolean;
  /** The results shown are for an older text. */
  readonly stale: boolean;
  readonly disabled: boolean;
}

export interface ComboboxInputProps extends Omit<
  ComponentPropsWithRef<"input">,
  | "value"
  | "defaultValue"
  | "onChange"
  | "onInput"
  | "onKeyDown"
  | "onBlur"
  | "onClick"
  | "role"
  | "aria-autocomplete"
  | "aria-expanded"
  | "aria-controls"
  | "aria-activedescendant"
  | "autoComplete"
  | "disabled"
  | "className"
  | "style"
  | "children"
> {
  /** Native `required`: empty text is `valueMissing`. */
  required?: boolean;
  className?: StateValue<string | undefined, ComboboxInputState>;
  style?: StateValue<CSSProperties | undefined, ComboboxInputState>;
  /** Must render an `<input>` of type `text` or `search`. */
  render?: RenderProp<ComponentPropsWithRef<"input">, ComboboxInputState>;
}

/**
 * The text field: `<input role="combobox" aria-autocomplete="list" aria-expanded aria-controls
 * aria-activedescendant autocomplete="off">`. DOM focus stays here while the active option moves
 * virtually (design 7.1). Its text is the Root's urgent `inputValue`; typing opens the listbox.
 *
 * Owned keys (conventions 1.2): `id`, `type`, `role`, `value`, `autoComplete`,
 * `aria-autocomplete`, `aria-expanded`, `aria-controls` (token-merged), `aria-activedescendant`,
 * `disabled`, `onChange`, `onKeyDown`, `onBlur`, `onClick`, `data-open`, `data-pending`,
 * `data-selected`, `data-stale`, `data-disabled`; inside a `Field.Root` (whose control id it
 * takes) also `required` (own or the Field's), `aria-describedby` (token-merged), `aria-invalid`
 * and `data-invalid`.
 */
export function ComboboxInput({ className, style, render, ...rest }: ComboboxInputProps) {
  const ctx = useComboboxContext("Combobox.Input");
  const { popover, ids, inputRef } = ctx;
  const { triggerRef } = popover;

  const state: ComboboxInputState = {
    value: ctx.value,
    inputValue: ctx.inputValue,
    open: popover.optimistic,
    pending: ctx.pending,
    stale: ctx.stale,
    disabled: ctx.disabled,
  };

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
      // listbox to it and makes clicks on it not light-dismiss (design 5.1).
      triggerRef.current = element;
      return () => {
        if (inputRef.current === element) inputRef.current = null;
        if (triggerRef.current === element) triggerRef.current = null;
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

  const libraryProps: ComponentPropsWithRef<"input"> & DataAttributes = {
    ...field.attributes,
    ...(field.inField && { required: field.required }),
    id: ids.input,
    type: searchType ? "search" : "text",
    role: "combobox",
    value: ctx.inputValue,
    autoComplete: "off",
    "aria-autocomplete": "list",
    "aria-expanded": popover.optimistic,
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
    "data-open": dataAttr(popover.optimistic),
    "data-pending": dataAttr(state.pending),
    "data-selected": dataAttr(ctx.value !== null),
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

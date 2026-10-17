"use client";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  MouseEvent,
  PointerEvent,
  ReactNode,
} from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { rendersButton, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { useComboboxContext } from "./combobox-context.js";
import { useNameWarning } from "./combobox-trigger.js";

export interface ComboboxClearState {
  /** Optimistic selection. */
  readonly value: string | null;
  readonly inputValue: string;
  readonly disabled: boolean;
}

export interface ComboboxClearProps extends Omit<
  ComponentPropsWithRef<"button">,
  | "onClick"
  | "onPointerDown"
  | "onMouseDown"
  | "tabIndex"
  | "disabled"
  | "className"
  | "style"
  | "children"
> {
  /** Disables this button; the Root's `disabled` does too. */
  disabled?: boolean;
  className?: StateValue<string | undefined, ComboboxClearState>;
  style?: StateValue<CSSProperties | undefined, ComboboxClearState>;
  children?: StateValue<ReactNode, ComboboxClearState>;
  /** Should render a `<button>`. */
  render?: RenderProp<ComponentPropsWithRef<"button">, ComboboxClearState>;
}

/**
 * The optional button that clears the combobox: `<button type="button" tabindex="-1">`. A click
 * empties the text (urgent) and dispatches `valueChangeAction(null)` unless nothing is selected;
 * the input keeps focus. Always rendered: hide it with CSS (`:placeholder-shown`) or `state`.
 * A click while the listbox is open closes it (the platform's light dismiss: the button is
 * outside the popup).
 *
 * Owned keys: `type` (on a `<button>`), `tabIndex`, `disabled`, `onClick`, `onPointerDown`,
 * `onMouseDown`, `data-disabled`.
 */
export function ComboboxClear({
  disabled: ownDisabled = false,
  className,
  style,
  children,
  render,
  ...rest
}: ComboboxClearProps) {
  const ctx = useComboboxContext("Combobox.Clear");
  const disabled = ownDisabled || ctx.disabled;
  const ref = useNameWarning("Combobox.Clear");
  const state: ComboboxClearState = { value: ctx.value, inputValue: ctx.inputValue, disabled };

  const libraryProps: ComponentPropsWithRef<"button"> & DataAttributes = {
    ...(rendersButton(render) && { type: "button" as const }),
    tabIndex: -1,
    disabled,
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
    },
    onMouseDown: (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
    },
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;
      ctx.clear(event.nativeEvent);
    },
    "data-disabled": dataAttr(disabled),
  };

  return useRender<ComponentPropsWithRef<"button">, ComboboxClearState>({
    defaultElement: "button",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps,
    ref,
  });
}

ComboboxClear.displayName = "ComboboxClear";

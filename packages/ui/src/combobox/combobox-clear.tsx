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
import { BUTTON_NAME, useNameWarning } from "../internal/use-name-warning.js";
import { disabledButton, rendersButton, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import { useComboboxContext } from "./combobox-context.js";

const isDev = process.env.NODE_ENV !== "production";

/**
 * State of `Combobox.Clear`, passed to the function forms of `className`, `style`, `children` and
 * `render`.
 */
export interface ComboboxClearState {
  /** Optimistic selection. */
  readonly value: string | null;
  /** The text in the input (urgent). */
  readonly inputValue: string;
  /** Disabled by its own prop or by the Root. */
  readonly disabled: boolean;
}

/**
 * Props of `Combobox.Clear`.
 *
 * @see https://ui.funstack.work/components/combobox
 */
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
  /**
   * Disables this button; the Root's `disabled` does too. Native `disabled` on a `<button>`; with
   * a link or component `render`, `aria-disabled="true"` instead.
   *
   * @defaultValue `false`
   */
  disabled?: boolean;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, ComboboxClearState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, ComboboxClearState>;
  /** Content, or a function of the part's state. */
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
 * Owned keys: `type` (on a `<button>`), `tabIndex`, `disabled`, `aria-disabled` (link or component
 * `render`), `onClick`, `onPointerDown`, `onMouseDown`, `data-disabled`.
 *
 * @see https://ui.funstack.work/components/combobox
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
  const ref = useNameWarning(
    isDev && "Combobox.Clear: the button has no accessible name. Give it an `aria-label`.",
    BUTTON_NAME,
  );
  const state: ComboboxClearState = { value: ctx.value, inputValue: ctx.inputValue, disabled };

  const libraryProps: ComponentPropsWithRef<"button"> & DataAttributes = {
    ...(rendersButton(render) && { type: "button" as const }),
    tabIndex: -1,
    ...disabledButton(render, disabled).props,
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
    },
    onMouseDown: (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
    },
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      if (disabled) {
        // A disabled link must not navigate either.
        event.preventDefault();
        return;
      }
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

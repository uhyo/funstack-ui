"use client";
import { useLayoutEffect } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useComboboxContext } from "./combobox-context.js";

/**
 * State of `Combobox.Label`, passed to the function forms of `className`, `style`, `children` and
 * `render`.
 */
export interface ComboboxLabelState {
  /** The Root's `disabled` (or the Field's). */
  readonly disabled: boolean;
}

/**
 * Props of `Combobox.Label`.
 *
 * @see https://ui.funstack.work/components/combobox
 */
export interface ComboboxLabelProps extends Omit<
  ComponentPropsWithRef<"label">,
  "id" | "htmlFor" | "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, ComboboxLabelState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, ComboboxLabelState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, ComboboxLabelState>;
  /** Replace the default `<label>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"label">, ComboboxLabelState>;
}

/**
 * The visible name of the combobox: `<label for={input}>`, whose id also names the listbox
 * (`aria-labelledby` on `Combobox.List`, emitted only while a Label is mounted). Owned keys:
 * `id`, `htmlFor`.
 *
 * @see https://ui.funstack.work/components/combobox
 */
export function ComboboxLabel({ className, style, children, render, ...rest }: ComboboxLabelProps) {
  const ctx = useComboboxContext("Combobox.Label");
  const { registerLabel } = ctx;
  useLayoutEffect(registerLabel, [registerLabel]);
  return useRender<ComponentPropsWithRef<"label">, ComboboxLabelState>({
    defaultElement: "label",
    render,
    state: { disabled: ctx.disabled },
    className,
    style,
    children,
    props: rest,
    libraryProps: { id: ctx.ids.label, htmlFor: ctx.ids.input },
  });
}

ComboboxLabel.displayName = "ComboboxLabel";

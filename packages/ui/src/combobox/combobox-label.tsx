"use client";
import { useLayoutEffect } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useComboboxContext } from "./combobox-context.js";

export interface ComboboxLabelState {
  readonly disabled: boolean;
}

export interface ComboboxLabelProps extends Omit<
  ComponentPropsWithRef<"label">,
  "id" | "htmlFor" | "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, ComboboxLabelState>;
  style?: StateValue<CSSProperties | undefined, ComboboxLabelState>;
  children?: StateValue<ReactNode, ComboboxLabelState>;
  render?: RenderProp<ComponentPropsWithRef<"label">, ComboboxLabelState>;
}

/**
 * The visible name of the combobox: `<label for={input}>`, whose id also names the listbox
 * (`aria-labelledby` on `Combobox.List`, emitted only while a Label is mounted). Owned keys:
 * `id`, `htmlFor`.
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

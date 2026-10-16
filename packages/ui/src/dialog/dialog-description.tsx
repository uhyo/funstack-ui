"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useDialogContext } from "./dialog-context.js";
import type { DialogPopupState } from "./dialog-popup.js";

export type DialogDescriptionState = DialogPopupState;

export interface DialogDescriptionProps extends Omit<
  ComponentPropsWithRef<"p">,
  "id" | "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, DialogDescriptionState>;
  style?: StateValue<CSSProperties | undefined, DialogDescriptionState>;
  children?: StateValue<ReactNode, DialogDescriptionState>;
  render?: RenderProp<ComponentPropsWithRef<"p">, DialogDescriptionState>;
}

/**
 * The dialog's description: a `<p>` whose id the Popup references with `aria-describedby`.
 *
 * Owned key (conventions 1.2): `id`.
 */
export function DialogDescription({
  className,
  style,
  children,
  render,
  ...rest
}: DialogDescriptionProps) {
  const ctx = useDialogContext("Dialog.Description");
  const state: DialogDescriptionState = { open: ctx.committed, modal: ctx.modal };
  return useRender<ComponentPropsWithRef<"p">, DialogDescriptionState>({
    defaultElement: "p",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: { id: ctx.ids.description },
  });
}

DialogDescription.displayName = "DialogDescription";

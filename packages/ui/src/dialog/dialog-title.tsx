"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useDialogContext } from "./dialog-context.js";
import type { DialogPopupState } from "./dialog-popup.js";

export type DialogTitleState = DialogPopupState;

export interface DialogTitleProps extends Omit<
  ComponentPropsWithRef<"h2">,
  "id" | "className" | "style" | "children"
> {
  className?: StateValue<string | undefined, DialogTitleState>;
  style?: StateValue<CSSProperties | undefined, DialogTitleState>;
  children?: StateValue<ReactNode, DialogTitleState>;
  /** `render={<h3 />}` changes the heading level. */
  render?: RenderProp<ComponentPropsWithRef<"h2">, DialogTitleState>;
}

/**
 * The dialog's name: an `<h2>` whose id the Popup references with `aria-labelledby`.
 *
 * Owned key (conventions 1.2): `id`.
 */
export function DialogTitle({ className, style, children, render, ...rest }: DialogTitleProps) {
  const ctx = useDialogContext("Dialog.Title");
  const state: DialogTitleState = { open: ctx.committed, modal: ctx.modal };
  return useRender<ComponentPropsWithRef<"h2">, DialogTitleState>({
    defaultElement: "h2",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: { id: ctx.ids.title },
  });
}

DialogTitle.displayName = "DialogTitle";

"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useDialogContext } from "./dialog-context.js";
import type { DialogPopupState } from "./dialog-popup.js";

/** State of `Dialog.Title`: the Popup's state. */
export type DialogTitleState = DialogPopupState;

/**
 * Props of `Dialog.Title`.
 *
 * @see https://ui.funstack.work/components/dialog
 */
export interface DialogTitleProps extends Omit<
  ComponentPropsWithRef<"h2">,
  "id" | "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, DialogTitleState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, DialogTitleState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, DialogTitleState>;
  /** `render={<h3 />}` changes the heading level. */
  render?: RenderProp<ComponentPropsWithRef<"h2">, DialogTitleState>;
}

/**
 * The dialog's name: an `<h2>` whose id the Popup references with `aria-labelledby`.
 *
 * Owned key (conventions 1.2): `id`.
 *
 * @see https://ui.funstack.work/components/dialog
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

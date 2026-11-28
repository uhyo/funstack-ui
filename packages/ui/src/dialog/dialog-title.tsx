"use client";
import { useLayoutEffect } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useDialogContext } from "./dialog-context.js";
import type { DialogNamespace } from "./dialog-context.js";
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
export function DialogTitle(props: DialogTitleProps) {
  return useDialogTitle(props, "Dialog");
}

DialogTitle.displayName = "DialogTitle";

/** The body of `Dialog.Title`, also run by `AlertDialog.Title` (alert-dialog.md 8). */
export function useDialogTitle(
  { className, style, children, render, ...rest }: DialogTitleProps,
  namespace: DialogNamespace,
): ReactNode {
  const ctx = useDialogContext(`${namespace}.Title`);
  // The Popup's `aria-labelledby` names it only while it is mounted (#218).
  const { registerTitle } = ctx.parts;
  useLayoutEffect(registerTitle, [registerTitle]);
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

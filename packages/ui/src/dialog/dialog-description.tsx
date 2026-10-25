"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useDialogContext } from "./dialog-context.js";
import type { DialogPopupState } from "./dialog-popup.js";

/** State of `Dialog.Description`: the Popup's state. */
export type DialogDescriptionState = DialogPopupState;

/**
 * Props of `Dialog.Description`.
 *
 * @see https://ui.funstack.work/components/dialog
 */
export interface DialogDescriptionProps extends Omit<
  ComponentPropsWithRef<"p">,
  "id" | "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, DialogDescriptionState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, DialogDescriptionState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, DialogDescriptionState>;
  /** Replace the default `<p>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"p">, DialogDescriptionState>;
}

/**
 * The dialog's description: a `<p>` whose id the Popup references with `aria-describedby`.
 *
 * Owned key (conventions 1.2): `id`.
 *
 * @see https://ui.funstack.work/components/dialog
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

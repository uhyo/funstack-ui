"use client";
import { useLayoutEffect } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useToastRootContext } from "./toast-context.js";
import type { ToastRootState } from "./toast-root.js";

/**
 * State of `Toast.Title`, passed to the function forms of `className`, `style`, `children` and
 * `render`: the Root's state.
 */
export type ToastTitleState = ToastRootState;

/**
 * Props of `Toast.Title`.
 *
 * @see https://ui.funstack.work/components/toast
 */
export interface ToastTitleProps extends Omit<
  ComponentPropsWithRef<"div">,
  "id" | "className" | "style" | "children"
> {
  /**
   * The title shown, or a function of the part's state.
   *
   * @defaultValue the toast's `title`
   */
  children?: StateValue<ReactNode, ToastTitleState>;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, ToastTitleState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, ToastTitleState>;
  /** Replace the default `<div>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"div">, ToastTitleState>;
}

/**
 * The toast's name: a `div` whose id the Root references with `aria-labelledby`. Not a heading,
 * so transient notifications stay out of heading navigation. Its text is part of the default
 * announcement.
 *
 * Owned key (conventions 1.2): `id`.
 *
 * @see https://ui.funstack.work/components/toast
 */
export function ToastTitle({ children, className, style, render, ...rest }: ToastTitleProps) {
  const root = useToastRootContext("Toast.Title");
  // Mounted, or revealed by a Suspense boundary inside the Root: announce the text now present.
  const { contentCommitted } = root;
  useLayoutEffect(() => contentCommitted(), [contentCommitted]);
  // The Root's `aria-labelledby` names it only while it is mounted (#218).
  const { registerTitle } = root.parts;
  useLayoutEffect(registerTitle, [registerTitle]);
  return useRender<ComponentPropsWithRef<"div">, ToastTitleState>({
    defaultElement: "div",
    render,
    state: root.state,
    className,
    style,
    children: children ?? root.toast.title,
    props: rest,
    libraryProps: { id: root.ids.title },
    ref: root.registerTitle,
  });
}

ToastTitle.displayName = "ToastTitle";

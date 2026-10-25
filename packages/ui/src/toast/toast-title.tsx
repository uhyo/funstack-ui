"use client";
import { useLayoutEffect } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useToastRootContext } from "./toast-context.js";
import type { ToastRootState } from "./toast-root.js";

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
  children?: StateValue<ReactNode, ToastRootState>;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, ToastRootState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, ToastRootState>;
  /** Replace the default `<div>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"div">, ToastRootState>;
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
  return useRender<ComponentPropsWithRef<"div">, ToastRootState>({
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

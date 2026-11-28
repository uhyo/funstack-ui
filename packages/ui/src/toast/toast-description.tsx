"use client";
import { useLayoutEffect } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useToastRootContext } from "./toast-context.js";
import type { ToastRootState } from "./toast-root.js";

/**
 * State of `Toast.Description`, passed to the function forms of `className`, `style`, `children` and
 * `render`: the Root's state.
 */
export type ToastDescriptionState = ToastRootState;

/**
 * Props of `Toast.Description`.
 *
 * @see https://ui.funstack.work/components/toast
 */
export interface ToastDescriptionProps extends Omit<
  ComponentPropsWithRef<"p">,
  "id" | "className" | "style" | "children"
> {
  /**
   * The description shown, or a function of the part's state. Without either, nothing is
   * rendered.
   *
   * @defaultValue the toast's `description`
   */
  children?: StateValue<ReactNode, ToastDescriptionState>;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, ToastDescriptionState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, ToastDescriptionState>;
  /** Replace the default `<p>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"p">, ToastDescriptionState>;
}

/**
 * The toast's description: a `p` whose id the Root references with `aria-describedby`. Renders
 * nothing when the part has no `children` and the toast no `description`. Its text is part of the
 * default announcement.
 *
 * Owned key (conventions 1.2): `id`.
 *
 * @see https://ui.funstack.work/components/toast
 */
export function ToastDescription({
  children,
  className,
  style,
  render,
  ...rest
}: ToastDescriptionProps) {
  const root = useToastRootContext("Toast.Description");
  const content = children ?? root.toast.description;
  // Mounted, or revealed by a Suspense boundary inside the Root: announce the text now present.
  const { contentCommitted } = root;
  useLayoutEffect(() => contentCommitted(), [contentCommitted]);
  const element = useRender<ComponentPropsWithRef<"p">, ToastDescriptionState>({
    defaultElement: "p",
    render,
    state: root.state,
    className,
    style,
    children: content,
    props: rest,
    libraryProps: { id: root.ids.description },
    ref: root.registerDescription,
  });
  return content == null || content === false ? null : element;
}

ToastDescription.displayName = "ToastDescription";

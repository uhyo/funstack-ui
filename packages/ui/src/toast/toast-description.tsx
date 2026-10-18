"use client";
import { useLayoutEffect } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useToastRootContext } from "./toast-context.js";
import type { ToastRootState } from "./toast-root.js";

export interface ToastDescriptionProps extends Omit<
  ComponentPropsWithRef<"p">,
  "id" | "className" | "style" | "children"
> {
  /** Default: the toast's `description`. Without either, nothing is rendered. */
  children?: StateValue<ReactNode, ToastRootState>;
  className?: StateValue<string | undefined, ToastRootState>;
  style?: StateValue<CSSProperties | undefined, ToastRootState>;
  render?: RenderProp<ComponentPropsWithRef<"p">, ToastRootState>;
}

/**
 * The toast's description: a `p` whose id the Root references with `aria-describedby`. Renders
 * nothing when the part has no `children` and the toast no `description`. Its text is part of the
 * default announcement.
 *
 * Owned key (conventions 1.2): `id`.
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
  const element = useRender<ComponentPropsWithRef<"p">, ToastRootState>({
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

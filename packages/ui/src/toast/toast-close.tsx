"use client";
import type { ComponentPropsWithRef, CSSProperties, MouseEvent, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { TEXT_NAME, useNameWarning } from "../internal/use-name-warning.js";
import { rendersButton, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import type { ToastItem } from "./toast.js";
import { useToastRootContext } from "./toast-context.js";

const isDev = process.env.NODE_ENV !== "production";

/**
 * State of `Toast.Close`, passed to the function forms of `className`, `style`, `children` and
 * `render`.
 */
export interface ToastCloseState {
  /** The toast this Close belongs to. */
  readonly toast: ToastItem;
}

/**
 * Props of `Toast.Close`.
 *
 * @see https://ui.funstack.work/components/toast
 */
export interface ToastCloseProps extends Omit<
  ComponentPropsWithRef<"button">,
  "onClick" | "className" | "style" | "children"
> {
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, ToastCloseState>;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, ToastCloseState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, ToastCloseState>;
  /** Replace the default `<button>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"button">, ToastCloseState>;
}

/**
 * Dismisses the toast (`reason: "dismiss"`, the same as Escape). Label it yourself (`aria-label`
 * or text). No Invoker Command: `hide-popover` would hide the whole region.
 *
 * Owned keys (conventions 1.2): `type` (on a `<button>` only), `onClick`.
 *
 * @see https://ui.funstack.work/components/toast
 */
export function ToastClose({ children, className, style, render, ...rest }: ToastCloseProps) {
  const root = useToastRootContext("Toast.Close");

  const devRef = useNameWarning(
    isDev && "Toast.Close: the button has no accessible name. Give it text or an `aria-label`.",
    TEXT_NAME,
  );

  const onClick = (event: MouseEvent<HTMLElement>): void => {
    if (rest.disabled === true) return;
    root.close("dismiss", event.nativeEvent);
  };

  const libraryProps: ComponentPropsWithRef<"button"> & DataAttributes = {
    ...(rendersButton(render) && { type: "button" as const }),
    onClick,
  };

  return useRender<ComponentPropsWithRef<"button">, ToastCloseState>({
    defaultElement: "button",
    render,
    state: { toast: root.toast },
    className,
    style,
    children,
    props: rest,
    libraryProps,
    ref: devRef,
  });
}

ToastClose.displayName = "ToastClose";

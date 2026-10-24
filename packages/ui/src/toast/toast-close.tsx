"use client";
import type { ComponentPropsWithRef, CSSProperties, MouseEvent, ReactNode } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { TEXT_NAME, useNameWarning } from "../internal/use-name-warning.js";
import { rendersButton, useRender } from "../internal/use-render.js";
import type { DataAttributes } from "../internal/use-render.js";
import type { ToastItem } from "./toast.js";
import { useToastRootContext } from "./toast-context.js";

const isDev = process.env.NODE_ENV !== "production";

export interface ToastCloseState {
  readonly toast: ToastItem;
}

export interface ToastCloseProps extends Omit<
  ComponentPropsWithRef<"button">,
  "onClick" | "className" | "style" | "children"
> {
  children?: StateValue<ReactNode, ToastCloseState>;
  className?: StateValue<string | undefined, ToastCloseState>;
  style?: StateValue<CSSProperties | undefined, ToastCloseState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, ToastCloseState>;
}

/**
 * Dismisses the toast (`reason: "dismiss"`, the same as Escape). Label it yourself (`aria-label`
 * or text). No Invoker Command: `hide-popover` would hide the whole region.
 *
 * Owned keys (conventions 1.2): `type` (on a `<button>` only), `onClick`.
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

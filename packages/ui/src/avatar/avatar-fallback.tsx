"use client";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { mergeRenderRef, renderElement } from "../internal/render-element.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useAvatarContext } from "./avatar-context.js";
import type { AvatarState } from "./avatar-root.js";

/**
 * Props of `Avatar.Fallback`.
 *
 * @see https://ui.funstack.work/components/avatar
 */
export interface AvatarFallbackProps extends Omit<
  ComponentPropsWithRef<"span">,
  "className" | "style" | "children"
> {
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, AvatarState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, AvatarState>;
  /** Content (initials, an icon), or a function of the part's state. */
  children?: StateValue<ReactNode, AvatarState>;
  /** Replace the default `<span>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"span">, AvatarState>;
}

/**
 * `Avatar.Fallback`: what shows when there is no picture. Rendered in every status but
 * `"loaded"`, from the server render on, **under** the image (the consumer's CSS stacks them):
 * nothing is swapped while the image loads, so there is no delay prop. Owned key: `data-status`.
 *
 * @see https://ui.funstack.work/components/avatar
 */
export function AvatarFallback({
  className,
  style,
  children,
  render,
  ref,
  ...rest
}: AvatarFallbackProps) {
  const { status } = useAvatarContext("Avatar.Fallback");
  // Not rendered at all once the image loaded: a function `render` or `children` does not run.
  if (status === "loaded") return null;
  return renderElement<ComponentPropsWithRef<"span">, AvatarState>({
    defaultElement: "span",
    render,
    state: { status },
    className,
    style,
    children,
    props: rest,
    libraryProps: { "data-status": status },
    // Passed through to the element, never read during render.
    // oxlint-disable-next-line react/refs
    ref: mergeRenderRef(ref, render),
  });
}

AvatarFallback.displayName = "AvatarFallback";

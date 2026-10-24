"use client";
import { useMemo, useRef, useSyncExternalStore } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { ToolbarContext } from "../internal/toolbar-context.js";
import type { ToolbarContextValue } from "../internal/toolbar-context.js";
import type { Orientation, RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useRovingFocus } from "../internal/use-roving-focus.js";

export type ToolbarOrientation = Orientation;

export interface ToolbarRootState {
  readonly orientation: ToolbarOrientation;
}

export interface ToolbarRootProps extends Omit<
  ComponentPropsWithRef<"div">,
  | "role"
  | "aria-orientation"
  | "onKeyDown"
  | "onFocus"
  | "onBlur"
  | "onPointerDown"
  | "className"
  | "style"
  | "children"
> {
  /** Axis of the arrow keys; also `aria-orientation`. Default `"horizontal"`. */
  orientation?: ToolbarOrientation;
  /** Whether arrows wrap from the last item to the first. Default `true`. */
  loop?: boolean;
  /**
   * Render `focusgroup="toolbar …"` and, where the browser implements it, let the browser handle
   * arrow keys, Home and End and the single Tab stop. Chromium 150+ only; elsewhere the JS path
   * stays active. Default `false`.
   */
  experimental_focusgroup?: boolean;
  className?: StateValue<string | undefined, ToolbarRootState>;
  style?: StateValue<CSSProperties | undefined, ToolbarRootState>;
  children?: StateValue<ReactNode, ToolbarRootState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, ToolbarRootState>;
}

/**
 * First entry: the first item. Natively `disabled` controls are not items; `aria-disabled` ones
 * are, and are entered like any other, as Chromium's native `focusgroup` does (the APG allows
 * focusable disabled items in a toolbar).
 */
function firstItem(items: readonly HTMLElement[]): HTMLElement | undefined {
  return items[0];
}

/** Engine capabilities never change while the page lives. */
const subscribeNever = () => () => {};

/**
 * `<div role="toolbar" aria-orientation>` (WAI-ARIA APG Toolbar). Its items are its focusable
 * descendants, found in the DOM: one Tab stop (the last focused item), arrow keys, Home and End
 * between them (design/components/toggle-group.md section 6). Name it with `aria-label` or
 * `aria-labelledby`.
 *
 * Owned keys (conventions 1.2): `role`, `aria-orientation`, `data-orientation`, `onKeyDown`,
 * `onFocus`, `onBlur`, `onPointerDown`, and `focusgroup` while the flag is on.
 */
export function ToolbarRoot({
  orientation = "horizontal",
  loop = true,
  experimental_focusgroup = false,
  className,
  style,
  children,
  render,
  ...rest
}: ToolbarRootProps) {
  // Conventions 8: the server snapshot is `false`, so hydration markup matches the server.
  const native = useSyncExternalStore(
    subscribeNever,
    () => experimental_focusgroup && "focusGroup" in HTMLElement.prototype,
    () => false,
  );
  const rootRef = useRef<HTMLElement | null>(null);
  const roving = useRovingFocus(rootRef, {
    orientation,
    loop,
    native,
    entry: firstItem,
    memory: true,
  });

  const context = useMemo<ToolbarContextValue>(() => ({ orientation }), [orientation]);
  const state: ToolbarRootState = { orientation };

  const focusgroup = experimental_focusgroup
    ? `toolbar ${orientation === "vertical" ? "block" : "inline"} ${loop ? "wrap" : "nowrap"}`
    : undefined;

  const element = useRender<ComponentPropsWithRef<"div">, ToolbarRootState>({
    defaultElement: "div",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: {
      role: "toolbar",
      "aria-orientation": orientation,
      "data-orientation": orientation,
      ...roving,
      ...(focusgroup !== undefined && { focusgroup }),
    },
    ref: rootRef,
  });

  return <ToolbarContext value={context}>{element}</ToolbarContext>;
}

ToolbarRoot.displayName = "ToolbarRoot";

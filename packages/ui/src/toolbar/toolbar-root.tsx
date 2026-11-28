"use client";
import { useMemo, useRef } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { ToolbarContext } from "../internal/toolbar-context.js";
import type { ToolbarContextValue } from "../internal/toolbar-context.js";
import type { Orientation, RenderProp, StateValue } from "../internal/types.js";
import { useNativeFocusgroup } from "../internal/use-native-focusgroup.js";
import { useRender } from "../internal/use-render.js";
import { useRovingFocus } from "../internal/use-roving-focus.js";

/** The arrow-key axis of a Toolbar. */
export type ToolbarOrientation = Orientation;

/**
 * State of `Toolbar.Root`, passed to the function forms of `className`, `style`, `children` and
 * `render`.
 */
export interface ToolbarRootState {
  /** The `orientation` prop. */
  readonly orientation: ToolbarOrientation;
}

/**
 * Props of `Toolbar.Root`.
 *
 * @see https://ui.funstack.work/components/toolbar
 */
export interface ToolbarRootProps extends Omit<
  ComponentPropsWithRef<"div">,
  | "role"
  | "aria-orientation"
  | "onKeyDown"
  | "onFocus"
  | "onBlur"
  | "onPointerDown"
  | "focusgroup"
  | "className"
  | "style"
  | "children"
> {
  /**
   * Axis of the arrow keys; also `aria-orientation`.
   *
   * @defaultValue `"horizontal"`
   */
  orientation?: ToolbarOrientation;
  /**
   * Whether arrows wrap from the last item to the first.
   *
   * @defaultValue `true`
   */
  loop?: boolean;
  /**
   * Render `focusgroup="toolbar …"` and, where the browser implements it, let the browser handle
   * arrow keys, Home and End and the single Tab stop. Chromium 150+ only; elsewhere the JS path
   * stays active.
   *
   * @defaultValue `false`
   */
  experimental_focusGroup?: boolean;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, ToolbarRootState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, ToolbarRootState>;
  /** Content, or a function of the part's state. */
  children?: StateValue<ReactNode, ToolbarRootState>;
  /** Replace the default `<div>` (element form) or take over rendering (function form). */
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

/**
 * `<div role="toolbar" aria-orientation>` (WAI-ARIA APG Toolbar). Its items are its focusable
 * descendants, found in the DOM: one Tab stop (the last focused item), arrow keys, Home and End
 * between them (design/components/toggle-group.md section 6). Name it with `aria-label` or
 * `aria-labelledby`.
 *
 * Owned keys (conventions 1.5): `role`, `aria-orientation`, `data-orientation`, `onKeyDown`,
 * `onFocus`, `onBlur`, `onPointerDown`, and `focusgroup` (the token list while the flag is on,
 * removed otherwise).
 *
 * @see https://ui.funstack.work/components/toolbar
 */
export function ToolbarRoot({
  orientation = "horizontal",
  loop = true,
  experimental_focusGroup = false,
  className,
  style,
  children,
  render,
  ...rest
}: ToolbarRootProps) {
  const native = useNativeFocusgroup(experimental_focusGroup);
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

  const focusgroup = experimental_focusGroup
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
      // Owned in both modes (conventions 1.5): without the flag a `render` element's own
      // `focusgroup` would put a native arrow-key handler beside the JS one.
      focusgroup,
    },
    ref: rootRef,
  });

  return <ToolbarContext value={context}>{element}</ToolbarContext>;
}

ToolbarRoot.displayName = "ToolbarRoot";

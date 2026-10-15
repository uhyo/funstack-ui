"use client";
import { cloneElement, createElement, isValidElement, useMemo } from "react";
import type { CSSProperties, ReactNode, Ref } from "react";
import { mergeProps, mergeRefs } from "./merge-props.js";
import type { RenderProp, StateValue } from "./types.js";

interface ElementLikeProps {
  className?: string | undefined;
  style?: CSSProperties | undefined;
  children?: ReactNode;
  ref?: Ref<unknown> | undefined;
}

/** `data-*` attributes are valid JSX but absent from the element prop types. */
export type DataAttributes = { [key: `data-${string}`]: string | undefined };

export interface UseRenderOptions<Props extends ElementLikeProps, State> {
  /** Intrinsic element rendered when `render` is not given. */
  defaultElement: string;
  render: RenderProp<Props, State> | undefined;
  state: State;
  className: StateValue<string | undefined, State> | undefined;
  style: StateValue<CSSProperties | undefined, State> | undefined;
  children: StateValue<ReactNode, State> | undefined;
  /** The library's props for the element: pass-through props plus library-controlled attributes. */
  props: Omit<Props, "className" | "style" | "children"> & DataAttributes;
  /** The library's own ref, if the part needs the DOM node. */
  ref?: Ref<unknown> | undefined;
}

export function resolveStateValue<T, State>(value: StateValue<T, State>, state: State): T {
  return typeof value === "function" ? (value as (state: State) => T)(state) : value;
}

/**
 * Resolves `render` and the function-form `className` / `style` / `children` of a part against
 * its state and produces the element (conventions 1.2, 1.3, 1.4).
 */
export function useRender<Props extends ElementLikeProps, State>(
  options: UseRenderOptions<Props, State>,
): ReactNode {
  const { defaultElement, render, state, className, style, children, props, ref } = options;

  const consumerRef = (props as ElementLikeProps).ref;
  const renderElement = isValidElement<ElementLikeProps>(render) ? render : undefined;
  const elementRef = renderElement?.props.ref;
  // Memoised so that the callback ref keeps its identity across renders and React does not
  // detach and re-attach the node every time.
  const mergedRef = useMemo(
    () => mergeRefs(ref, consumerRef, elementRef),
    [ref, consumerRef, elementRef],
  );

  const resolved = {
    ...props,
    ref: mergedRef,
    className: resolveStateValue(className, state),
    style: resolveStateValue(style, state),
    children: resolveStateValue(children, state),
  } as Props;

  if (typeof render === "function") {
    return render(resolved, state);
  }
  if (renderElement !== undefined) {
    const { ref: _ignored, ...elementProps } = renderElement.props as Record<string, unknown>;
    return cloneElement(
      renderElement,
      mergeProps(resolved as unknown as Record<string, unknown>, elementProps) as Partial<Props>,
    );
  }
  return createElement(defaultElement, resolved);
}

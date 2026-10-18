// No "use client": the pure half of `useRender`, usable from a directive-free part (a Root that
// may run as a Server Component, design/components/progress.md 8.1 and implementation note 14.1).
import { cloneElement, createElement, isValidElement } from "react";
import type { CSSProperties, ReactNode, Ref } from "react";
import { mergeProps, mergeRefs } from "./merge-props.js";
import type { RenderProp, StateValue } from "./types.js";

export interface ElementLikeProps {
  className?: string | undefined;
  style?: CSSProperties | undefined;
  children?: ReactNode;
  ref?: Ref<unknown> | undefined;
}

/** `data-*` attributes are valid JSX but absent from the element prop types. */
export type DataAttributes = { [key: `data-${string}`]: string | undefined };

export interface RenderElementOptions<Props extends ElementLikeProps, State> {
  /** Intrinsic element rendered when `render` is not given. */
  defaultElement: string;
  render: RenderProp<Props, State> | undefined;
  state: State;
  className: StateValue<string | undefined, State> | undefined;
  style: StateValue<CSSProperties | undefined, State> | undefined;
  children: StateValue<ReactNode, State> | undefined;
  /**
   * The part's pass-through props for the element. A `render` element's own props win over
   * these. Their `ref` is replaced by `ref` below.
   */
  props: Omit<Props, "className" | "style" | "children"> & DataAttributes;
  /**
   * Library-controlled attributes the part computes (`role`, `aria-*` state, id wiring, `data-*`
   * state, the library's own event handlers). These win over a `render` element's props
   * (conventions 1.2).
   */
  libraryProps?: Partial<Omit<Props, "className" | "style" | "children">> & DataAttributes;
  /**
   * The element's ref, already merged from the library's ref, the consumer's `ref` and the
   * `render` element's ref. The `render` element's own ref is not attached separately.
   */
  ref: Ref<unknown> | undefined;
}

export function resolveStateValue<T, State>(value: StateValue<T, State>, state: State): T {
  return typeof value === "function" ? (value as (state: State) => T)(state) : value;
}

/**
 * Whether a part whose default element is a `<button>` should add `type="button"`: no `render`,
 * a `render` element whose type is the intrinsic `"button"`, or the function form (it receives
 * button props and decides itself what to spread). An element of any other type (an `<a>`, a
 * router `Link`) does not get it: `type` means something else, or nothing, there.
 */
export function rendersButton<Props, State>(render: RenderProp<Props, State> | undefined): boolean {
  if (render === undefined || typeof render === "function") return true;
  return isValidElement(render) && render.type === "button";
}

/**
 * The ref of a part with no library ref, merged from the consumer's `ref` and a `render`
 * element's ref without memoisation (a directive-free part cannot `useMemo`, design
 * progress.md 14.1). A fresh callback ref per render is correct because every merged callback
 * returns a cleanup; a single ref is passed through untouched.
 */
export function mergeRenderRef(
  consumerRef: Ref<unknown> | undefined,
  render: unknown,
): Ref<unknown> | undefined {
  const elementRef = isValidElement<ElementLikeProps>(render) ? render.props.ref : undefined;
  if (consumerRef != null && elementRef != null) return mergeRefs(consumerRef, elementRef);
  return consumerRef ?? elementRef;
}

/**
 * Resolves `render` and the function-form `className` / `style` / `children` of a part against
 * its state and produces the element (conventions 1.2, 1.3, 1.4). Pure: the caller merges the
 * refs (`useRender` memoises the merge; a directive-free part merges unmemoised).
 */
export function renderElement<Props extends ElementLikeProps, State>(
  options: RenderElementOptions<Props, State>,
): ReactNode {
  const { defaultElement, render, state, className, style, children, props, libraryProps, ref } =
    options;

  const partProps = {
    ...props,
    ref,
    className: resolveStateValue(className, state),
    style: resolveStateValue(style, state),
    children: resolveStateValue(children, state),
  } as Record<string, unknown>;
  const controlled = (libraryProps ?? {}) as Record<string, unknown>;

  if (isValidElement<ElementLikeProps>(render)) {
    // The element's ref is already part of `ref`.
    const { ref: _ignored, ...elementProps } = render.props as Record<string, unknown>;
    return cloneElement(render, mergeProps(partProps, elementProps, controlled) as Partial<Props>);
  }
  const resolved = mergeProps(partProps, {}, controlled) as unknown as Props;
  if (typeof render === "function") {
    return render(resolved, state);
  }
  return createElement(defaultElement, resolved);
}

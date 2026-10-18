"use client";
import { isValidElement, useMemo } from "react";
import type { ReactNode, Ref } from "react";
import { mergeRefs } from "./merge-props.js";
import { renderElement } from "./render-element.js";
import type { ElementLikeProps, RenderElementOptions } from "./render-element.js";

export { rendersButton, resolveStateValue } from "./render-element.js";
export type { DataAttributes } from "./render-element.js";

export interface UseRenderOptions<Props extends ElementLikeProps, State> extends Omit<
  RenderElementOptions<Props, State>,
  "ref"
> {
  /** The library's own ref, if the part needs the DOM node. */
  ref?: Ref<unknown> | undefined;
}

/**
 * Resolves `render` and the function-form `className` / `style` / `children` of a part against
 * its state and produces the element (conventions 1.2, 1.3, 1.4). The pure work is
 * `renderElement` (`render-element.ts`); this hook adds the memoised ref merge.
 */
export function useRender<Props extends ElementLikeProps, State>(
  options: UseRenderOptions<Props, State>,
): ReactNode {
  const { render, props, ref } = options;

  const consumerRef = (props as ElementLikeProps).ref;
  const elementRef = isValidElement<ElementLikeProps>(render) ? render.props.ref : undefined;
  // Memoised so that the callback ref keeps its identity across renders and React does not
  // detach and re-attach the node every time.
  const mergedRef = useMemo(
    () => mergeRefs(ref, consumerRef, elementRef),
    [ref, consumerRef, elementRef],
  );

  return renderElement<Props, State>({ ...options, ref: mergedRef });
}

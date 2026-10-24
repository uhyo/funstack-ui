"use client";
import { useCallback, useRef } from "react";
import type { RefCallback, RefObject } from "react";
import { useElementCheck } from "../internal/use-element-check.js";

const isDev = process.env.NODE_ENV !== "production";

export interface SelectPartRef<E extends Element> {
  /** The library ref to pass to `useRender`. */
  readonly ref: RefCallback<E>;
  /** The mounted element. Read it from effects and handlers only. */
  readonly node: RefObject<E | null>;
}

/**
 * The library ref of a Select part: stores the node in `node` and, in development,
 * warns once per instance when the mounted element is not `<tag>` (conventions 1.2: Select's parts
 * keep their native elements) or when `position` reports a misplaced element (a message, or
 * `null` when the element is where HTML wants it). Ref callbacks run in the layout phase, when
 * the element's siblings are in place.
 */
export function useSelectPartRef<E extends Element>(
  component: string,
  tag: string,
  position?: (el: E) => string | null,
): SelectPartRef<E> {
  const node = useRef<E | null>(null);
  const checkTag = useElementCheck<E>(
    isDev &&
      ((el) =>
        el.tagName !== tag.toUpperCase()
          ? `${component}: expected to render a <${tag}> element but got ` +
            `<${el.tagName.toLowerCase()}>. The parser, the picker and <selectedcontent> cloning ` +
            `key on the native element; a \`render\` element must keep it.`
          : null),
  );
  const checkPosition = useElementCheck<E>(
    isDev &&
      ((el) => {
        const message = position?.(el) ?? null;
        return message === null ? null : `${component}: ${message}`;
      }),
  );
  const ref = useCallback(
    (el: E) => {
      node.current = el;
      checkTag?.(el);
      checkPosition?.(el);
      return () => {
        node.current = null;
      };
    },
    [checkTag, checkPosition],
  );
  return { ref, node };
}

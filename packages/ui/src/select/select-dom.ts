"use client";
import { useCallback, useRef } from "react";
import type { RefCallback, RefObject } from "react";

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
  const warnedTag = useRef(false);
  const warnedPosition = useRef(false);
  const ref = useCallback(
    (el: E) => {
      node.current = el;
      if (isDev && !warnedTag.current && el.tagName !== tag.toUpperCase()) {
        warnedTag.current = true;
        console.error(
          `${component}: expected to render a <${tag}> element but got ` +
            `<${el.tagName.toLowerCase()}>. The parser, the picker and <selectedcontent> cloning ` +
            `key on the native element; a \`render\` element must keep it.`,
        );
      }
      if (isDev && position && !warnedPosition.current) {
        const message = position(el);
        if (message !== null) {
          warnedPosition.current = true;
          console.error(`${component}: ${message}`);
        }
      }
      return () => {
        node.current = null;
      };
    },
    // `position` is a module-level function at every call site, so the callback is stable.
    [component, tag, position],
  );
  return { ref, node };
}

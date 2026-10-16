import type { CSSProperties, Ref, RefCallback } from "react";

type AnyProps = Record<string, unknown>;

/**
 * ARIA id-reference lists are merged as token lists rather than overridden (conventions 1.2), so
 * a trigger can be described by more than the element the library wires it to.
 */
const ID_REFERENCE_LISTS = new Set([
  "aria-labelledby",
  "aria-describedby",
  "aria-controls",
  "aria-owns",
]);

function isIdReferenceList(key: string): boolean {
  return ID_REFERENCE_LISTS.has(key);
}

function isEventHandler(key: string, value: unknown): value is (...args: unknown[]) => void {
  return typeof value === "function" && /^on[A-Z]/.test(key);
}

function isObjectRef<T>(ref: unknown): ref is { current: T | null } {
  return typeof ref === "object" && ref !== null && "current" in ref;
}

function attachRef<T>(ref: Ref<T> | undefined, node: T): (() => void) | undefined {
  if (ref === null || ref === undefined) return undefined;
  if (typeof ref === "function") {
    const cleanup = ref(node);
    return typeof cleanup === "function" ? cleanup : () => ref(null);
  }
  if (isObjectRef<T>(ref)) {
    ref.current = node;
    return () => {
      ref.current = null;
    };
  }
  return undefined;
}

/**
 * Merges several refs into one callback ref. The callback returns a cleanup function (React 19),
 * so each inner ref is detached through its own cleanup (callback refs that returned one) or by
 * being set to `null`.
 */
export function mergeRefs<T>(...refs: readonly (Ref<T> | undefined)[]): RefCallback<T> {
  return (node: T) => {
    const cleanups = refs.map((ref) => attachRef(ref, node));
    return () => {
      for (const cleanup of cleanups) cleanup?.();
    };
  };
}

/** Joins two space-separated id lists, `first` tokens first, without duplicates. */
export function mergeTokenLists(first: unknown, second: unknown): string {
  const tokens: string[] = [];
  for (const list of [first, second]) {
    if (typeof list !== "string") continue;
    for (const token of list.split(/\s+/)) {
      if (token !== "" && !tokens.includes(token)) tokens.push(token);
    }
  }
  return tokens.join(" ");
}

/**
 * Layers `over` onto `under`, with the rules shared by every layer of the merge:
 *
 * - `className`: concatenated (`under` first).
 * - `style`: merged, `over` wins per property.
 * - `ref`: both attached.
 * - Event handlers: both run; `overFirst` says whether `over`'s runs before `under`'s.
 * - ARIA id-reference lists: token-merged; `overFirst` says whose tokens come first.
 * - Everything else: `over` wins when it defines the prop (`undefined` is "not defined").
 */
function layer(under: AnyProps, over: AnyProps, overFirst: boolean): AnyProps {
  const result: AnyProps = { ...under };

  for (const key of Object.keys(over)) {
    const overValue = over[key];
    const underValue = under[key];

    if (overValue === undefined) continue;

    if (key === "className") {
      result[key] =
        typeof underValue === "string" && underValue !== ""
          ? `${underValue} ${String(overValue)}`
          : overValue;
    } else if (key === "style") {
      result[key] = {
        ...(underValue as CSSProperties | undefined),
        ...(overValue as CSSProperties),
      };
    } else if (key === "ref") {
      result[key] =
        underValue === undefined || underValue === null
          ? overValue
          : mergeRefs(underValue as Ref<unknown>, overValue as Ref<unknown>);
    } else if (isEventHandler(key, overValue) && isEventHandler(key, underValue)) {
      const [first, second] = overFirst ? [overValue, underValue] : [underValue, overValue];
      result[key] = (...args: unknown[]) => {
        first(...args);
        second(...args);
      };
    } else if (isIdReferenceList(key) && typeof underValue === "string") {
      result[key] = overFirst
        ? mergeTokenLists(overValue, underValue)
        : mergeTokenLists(underValue, overValue);
    } else {
      result[key] = overValue;
    }
  }

  return result;
}

/**
 * Merges the props for a part's element in the order of conventions 1.2: the part's pass-through
 * props, then the `render` element's props, then the library-controlled attributes on top.
 *
 * - The `render` element wins over pass-through props (`aria-label`, `data-*` from the part's own
 *   props, `type`, ...); the library-controlled attributes (`role`, computed `aria-*` state, id
 *   wiring, `data-*` state, the library's handlers) win over the element.
 * - `className` is concatenated (part, element), `style` merged with the element winning.
 * - Event handlers all run: the element's first, then the part's pass-through one, then the
 *   library's.
 * - `aria-labelledby` / `aria-describedby` / `aria-controls` / `aria-owns` are merged as token
 *   lists, the element's tokens first.
 * - `ref`s are all attached.
 */
export function mergeProps<P extends AnyProps>(
  partProps: P,
  elementProps: AnyProps,
  libraryProps: AnyProps = {},
): P {
  // The render element's handlers and tokens come first in both layers.
  return layer(layer(partProps, elementProps, true), libraryProps, false) as P;
}

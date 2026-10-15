import type { CSSProperties, Ref, RefCallback } from "react";

type AnyProps = Record<string, unknown>;

/**
 * Attribute names the library controls. When a `render` element also sets them, the library's
 * value wins (conventions 1.2): `role`, `aria-*` state and `data-*` state.
 */
function isLibraryControlled(key: string): boolean {
  return key === "role" || key.startsWith("aria-") || key.startsWith("data-");
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

/**
 * Merges the library's props for an element with the props of a `render` element.
 *
 * - `className`: both are kept (library first, element second).
 * - `style`: merged, the element's properties win.
 * - Event handlers: both run, the element's first, then the library's.
 * - `ref`: both are attached.
 * - `role`, `aria-*`, `data-*`: the library wins.
 * - Everything else: the element wins when it defines the prop.
 */
export function mergeProps<P extends AnyProps>(libraryProps: P, elementProps: AnyProps): P {
  const result: AnyProps = { ...libraryProps };

  for (const key of Object.keys(elementProps)) {
    const elementValue = elementProps[key];
    const libraryValue = libraryProps[key];

    if (elementValue === undefined) continue;

    if (key === "className") {
      result[key] =
        typeof libraryValue === "string" && libraryValue !== ""
          ? `${libraryValue} ${String(elementValue)}`
          : elementValue;
    } else if (key === "style") {
      result[key] = {
        ...(libraryValue as CSSProperties | undefined),
        ...(elementValue as CSSProperties),
      };
    } else if (key === "ref") {
      result[key] =
        libraryValue === undefined || libraryValue === null
          ? elementValue
          : mergeRefs(libraryValue as Ref<unknown>, elementValue as Ref<unknown>);
    } else if (isEventHandler(key, elementValue) && isEventHandler(key, libraryValue)) {
      result[key] = (...args: unknown[]) => {
        elementValue(...args);
        libraryValue(...args);
      };
    } else if (isLibraryControlled(key) && libraryValue !== undefined) {
      // library wins; keep result[key] as is
    } else {
      result[key] = elementValue;
    }
  }

  return result as P;
}

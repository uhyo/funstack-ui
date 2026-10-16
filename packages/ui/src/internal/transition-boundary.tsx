"use client";
import { useEffect, useRef, ViewTransition } from "react";
import type { ReactNode, ViewTransitionClass } from "react";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Wraps a part's output in `<ViewTransition default={transition}>` **only when the consumer
 * passed `transition`** (conventions 5.1). With `transition === undefined` the node is returned
 * unwrapped and the part renders no boundary at all.
 *
 * Reason (docs/research/view-transition-mount-cost.md, issue #35): react-dom 19.3 starts a
 * document view transition whenever a `<ViewTransition>` mounts or is revealed by `<Activity>` in
 * a transition-lane commit, whatever its class resolves to (`"none"` included). The browser's
 * 250 ms root cross-fade then runs and every later transition commit waits for it. Exits and
 * updates of a `"none"` boundary are free, so an explicit `transition="none"` keeps the boundary
 * and lets a consumer switch between `"none"` and a class without remounting.
 *
 * The boundary stays the outermost node of the part's output, so a part that is the top of an
 * inserted subtree gets enter / exit. A plain function (not a component), so it adds no fiber
 * between the boundary and the element.
 */
export function transitionBoundary(
  transition: ViewTransitionClass | undefined,
  node: ReactNode,
): ReactNode {
  if (transition === undefined) return node;
  return <ViewTransition default={transition}>{node}</ViewTransition>;
}

/**
 * {@link transitionBoundary} plus the development warning for a non-static `transition`
 * (conventions 5.1): changing it between `undefined` and a value changes the element type at the
 * part's root, so React remounts the part's subtree (DOM and state lost). Warns once per
 * instance, from an effect. `part` is the public name used in the message (`"Tabs.Panel"`).
 *
 * Pass the *effective* value: a part that ignores `transition` in some mode (Accordion, Dialog
 * JS-free mode) passes `undefined` there.
 */
export function useTransitionBoundary(
  part: string,
  transition: ViewTransitionClass | undefined,
  node: ReactNode,
): ReactNode {
  const hasBoundary = transition !== undefined;
  const initial = useRef(hasBoundary);
  const warned = useRef(false);
  useEffect(() => {
    if (!isDev || warned.current || hasBoundary === initial.current) return;
    warned.current = true;
    console.error(
      `${part}: \`transition\` changed between undefined and a value after mount. The part ` +
        "renders a <ViewTransition> only when `transition` is given, so this remounts its " +
        'subtree (DOM and state are lost). Keep `transition` static; use `transition="none"` ' +
        "to switch animation off without removing the boundary.",
    );
  }, [hasBoundary, part]);
  return transitionBoundary(transition, node);
}

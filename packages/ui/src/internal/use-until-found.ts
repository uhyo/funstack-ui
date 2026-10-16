"use client";
import { useEffect, useEffectEvent, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";

export interface UseUntilFoundOptions {
  /**
   * The element should currently be `hidden="until-found"`. The part renders `hidden={active}`
   * itself as well, so server-rendered HTML hides it (as `hidden=""`) before hydration.
   */
  active: boolean;
  /** Called with the `beforematch` event when find-in-page or a text fragment reveals it. */
  onMatch: (event: Event) => void;
}

/**
 * The single home of the `hidden="until-found"` workaround (conventions 7.4).
 *
 * react-dom 19.3 serialises `hidden` as a boolean attribute (`hidden=""` on client and server),
 * so the part renders `hidden={active}` and this hook upgrades the attribute to `"until-found"`
 * through a ref in a layout effect. The upgrade is re-asserted after **every** render while
 * `active`: when the browser reveals the element it removes the attribute itself, and if the
 * resulting action is rejected React sees no prop change and would leave the element visible.
 *
 * `beforematch` has no React prop, so a native listener is attached in an effect through the
 * returned ref (conventions 2.6, 7.4). Attach the ref to the element that renders
 * `hidden={active}`.
 */
export function useUntilFound<E extends HTMLElement>(
  options: UseUntilFoundOptions,
): RefObject<E | null> {
  const { active } = options;
  const node = useRef<E | null>(null);
  const onMatch = useEffectEvent((event: Event) => {
    options.onMatch(event);
  });

  // No dependency array on purpose: re-assert after every commit of the owner (see above).
  useLayoutEffect(() => {
    const element = node.current;
    if (element !== null && active && element.getAttribute("hidden") !== "until-found") {
      element.setAttribute("hidden", "until-found");
    }
  });

  // Re-subscribed after every commit so a swapped element (a changed `render`) is covered.
  useEffect(() => {
    const element = node.current;
    if (element === null) return;
    const listener = (event: Event) => onMatch(event);
    element.addEventListener("beforematch", listener);
    return () => element.removeEventListener("beforematch", listener);
  });

  return node;
}

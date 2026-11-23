"use client";
import { useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";

/**
 * Reports an action rejection that React would drop (conventions 2.4), for `useControllableAction`
 * and `useActionTrigger`. React routes a transition's rejection only by unwrapping the newest
 * thenable of a `useTransition` in a render of the component that owns it, so two rejections reach
 * no Error Boundary:
 *
 * - a **superseded** run's (a later run of the same hook replaced its thenable), and
 * - the **latest** run's once the owner is **gone** (unmounted, or hidden by `<Activity>`): no
 *   render reads it (#152).
 *
 * The library passes them to the global `reportError` instead, as React's standalone
 * `startTransition` does with every rejection: a window `error` event, seen by monitoring tools
 * and by test runners, while the UI stays up. `console.error` where there is no `reportError`.
 */
export function reportDropped(error: unknown): void {
  if (typeof reportError === "function") reportError(error);
  else console.error(error);
}

/**
 * Whether the calling component's effects are connected: `true` from its mount layout effect until
 * that effect is cleaned up, which happens on unmount and when an `<Activity>` hides it. Read from
 * action continuations only, to decide between rethrowing a latest rejection (React routes it to
 * the boundary) and `reportDropped`.
 */
export function useConnected(): RefObject<boolean> {
  const connected = useRef(false);
  useLayoutEffect(() => {
    connected.current = true;
    return () => {
      connected.current = false;
    };
  }, []);
  return connected;
}

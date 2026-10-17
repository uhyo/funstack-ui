"use client";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const clientSnapshot = () => false;
const serverSnapshot = () => true;

/**
 * Whether this render hydrates server HTML: `true` in the render that hydrates the component
 * (React uses `useSyncExternalStore`'s server snapshot there, also inside a Suspense boundary that
 * hydrates after its parent) and `false` in a client-created render, including a hydration that
 * fell back to client rendering. After a hydration React re-renders once with the client snapshot
 * (scheduled from a passive effect), so read the value captured by the **mount layout effect**,
 * which belongs to the hydration render (design/components/select.md 6.2).
 */
export function useHydratedMount(): boolean {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}

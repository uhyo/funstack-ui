"use client";
import { useSyncExternalStore } from "react";

/** Engine capabilities never change while the page lives. */
const subscribeNever = () => () => {};

/**
 * Whether the native `focusgroup` path is on: the `experimental_focusgroup` flag is set and the
 * engine implements it. Detected only with the flag, and never during SSR or hydration
 * (conventions 8): the server snapshot is `false`, so hydration markup matches the server and
 * React re-renders with the client answer afterwards. The IDL attribute is camel-cased
 * `focusGroup` (`"focusgroup" in HTMLElement.prototype` is always false).
 */
export function useNativeFocusgroup(flag: boolean): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => flag && "focusGroup" in HTMLElement.prototype,
    () => false,
  );
}

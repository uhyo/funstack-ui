"use client";
import { useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";

/**
 * Whether the calling component's effects are connected: `true` from its mount layout effect until
 * that effect is cleaned up, which happens on unmount, when an `<Activity>` hides it (`keepMounted`
 * included) and when a Suspense boundary above it re-suspends and shows its fallback. Read from
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

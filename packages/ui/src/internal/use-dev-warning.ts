"use client";
import { useEffect, useRef } from "react";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Logs `message` through `console.error` once per component instance, the first time
 * `condition` is true. Runs in an effect (never during render) so the warning cannot fire for a
 * render that is discarded.
 */
export function useDevWarning(condition: boolean, message: string): void {
  const warned = useRef(false);
  useEffect(() => {
    if (!isDev || !condition || warned.current) return;
    warned.current = true;
    console.error(message);
  }, [condition, message]);
}

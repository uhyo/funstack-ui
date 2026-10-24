"use client";
import { useEffect, useRef } from "react";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Logs `message` through `console.error` once per component instance, the first time
 * `condition` is true. Runs in an effect (never during render) so the warning cannot fire for a
 * render that is discarded.
 *
 * Pass the message as `isDev && "..."` with the calling module's own `isDev` constant: the text
 * then folds away in a production build (`src/__tests__/production-bundle.test.ts` checks it).
 * In production the hook is a no-op.
 */
export const useDevWarning: (condition: boolean, message: string | false) => void = isDev
  ? useDevWarningDev
  : noop;

function useDevWarningDev(condition: boolean, message: string | false): void {
  const warned = useRef(false);
  useEffect(() => {
    if (!condition || message === false || warned.current) return;
    warned.current = true;
    console.error(message);
  }, [condition, message]);
}

function noop(): void {}

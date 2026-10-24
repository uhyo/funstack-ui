"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/** Reports an error that cannot reach a boundary (conventions 2.4: never swallow). */
function report(error: unknown): void {
  if (typeof reportError === "function") reportError(error);
  else console.error(error);
}

/**
 * Surfaces the rejections of superseded transitions (conventions 2.4) for `useControllableAction`
 * and `useActionTrigger`. React keeps only the newest thenable per `useTransition`, so a rejection
 * from a run that a later run superseded would be dropped entirely (no boundary, no
 * `reportError`). The caller rethrows the latest run's rejection itself (React's own route to the
 * boundary) and hands any other to the returned `capture`: the first is thrown from render, so it
 * reaches the same nearest Error Boundary; later ones of the burst are reported. Nothing is thrown
 * once unmounted (React drops its own thenables the same way).
 *
 * Call it **before `useTransition`**: React retries an errored render with every pending lane,
 * and in that retry `useTransition` unwraps the still-pending action thenable and suspends, which
 * would hold the boundary commit until the newer action settles.
 */
export function useSupersededRejection(): (error: unknown) => void {
  const [superseded, setSuperseded] = useState<{ readonly error: unknown } | null>(null);
  const captured = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const capture = useCallback((error: unknown): void => {
    if (!mounted.current) return;
    if (captured.current) {
      // One boundary reset per burst is enough; later errors are still reported.
      report(error);
      return;
    }
    captured.current = true;
    // Called after an await, outside the transition: an urgent update, so the owner re-renders
    // promptly and throws.
    setSuperseded({ error });
  }, []);

  if (superseded !== null) throw superseded.error;
  return capture;
}

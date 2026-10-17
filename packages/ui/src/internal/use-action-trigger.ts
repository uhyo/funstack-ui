"use client";
import { useEffect, useRef, useState, useTransition } from "react";

export interface ActionTrigger {
  /** A run started through this hook is in flight (the part's own transition). */
  readonly pending: boolean;
  /**
   * Runs `work` inside the part's own transition and, once it resolves, `then` (still inside the
   * transition: a Close part's close, a menu item's close). A rejection skips `then` and reaches
   * the nearest Error Boundary above the part, also when a later run superseded this one. With
   * `openGeneration` (the hook's argument), `then` is skipped when a newer open of the overlay
   * started after the run began.
   */
  readonly run: (work: () => unknown, then?: () => void) => void;
}

/** Reports an error that cannot reach a boundary (conventions 2.4: never swallow). */
function report(error: unknown): void {
  if (typeof reportError === "function") reportError(error);
  else console.error(error);
}

/**
 * The transition of a pure-trigger part: an `action` with no state of its own (`Dialog.Close`,
 * `Popover.Close`, `Menu.Item`; conventions 3.4). Same superseded-rejection surfacing as
 * `useControllableAction`: React keeps only the newest thenable per `useTransition`, so the
 * rejection of a run that a later run superseded would be dropped. The hook catches it and throws
 * it from render, so it reaches the same boundary as the latest run's rejection does.
 */
export function useActionTrigger(openGeneration?: () => number): ActionTrigger {
  // Thrown before `useTransition` on purpose (see use-controllable-action.ts): in the retry of
  // an errored render `useTransition` would suspend on the newer run's pending thenable.
  const [supersededError, setSupersededError] = useState<{ readonly error: unknown } | null>(null);
  const hasSupersededError = useRef(false);
  if (supersededError !== null) throw supersededError.error;

  const [pending, startOwnTransition] = useTransition();
  const latest = useRef(0);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = (work: () => unknown, then?: () => void): void => {
    const id = ++latest.current;
    // The open this run belongs to (design/components/popover.md, review M2 / PO rule): if the
    // user dismisses and re-opens while the action runs, its close must not close the new open.
    const generation = openGeneration?.();
    startOwnTransition(async () => {
      try {
        await work();
      } catch (error) {
        // The latest run's rejection takes React's own route to the boundary.
        if (id === latest.current) throw error;
        if (!mounted.current) return;
        if (hasSupersededError.current) {
          report(error);
          return;
        }
        hasSupersededError.current = true;
        // After an await, outside the transition: urgent, so the part re-renders and throws.
        setSupersededError({ error });
        return;
      }
      if (openGeneration !== undefined && openGeneration() !== generation) return;
      then?.();
    });
  };

  return { pending, run };
}

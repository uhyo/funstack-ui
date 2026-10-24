"use client";
import { useEffect, useRef, useState, useTransition } from "react";

export interface ActionTriggerOptions {
  /**
   * Open generation of the overlay a `then` belongs to: `then` is skipped when a newer open of
   * the overlay started after the run began.
   */
  readonly openGeneration?: (() => number) | undefined;
  /**
   * Ignore `run` while a run is in flight (conventions 2.5): `run` returns `false` and starts
   * nothing. In flight means the hook's synchronous in-flight counter is non-zero (it also sees
   * two activations in one task, before React re-rendered); the last render's `pending` is not
   * consulted, so a click in a settled-but-held commit window runs. Default `true`: every pure
   * trigger ignores re-entry. Only the continuous controls (`Slider`, `NumberField`)
   * pass `false`, because a step is not a re-entry: every step must run.
   */
  readonly ignoreWhilePending?: boolean | undefined;
}

export interface ActionTrigger {
  /** A run started through this hook is in flight (the part's own transition). */
  readonly pending: boolean;
  /**
   * Runs `work` inside the part's own transition and, once it resolves, `then` (still inside the
   * transition: a Close part's close, a menu item's close). A rejection skips `then` and reaches
   * the nearest Error Boundary above the part, also when a later run superseded this one. With
   * `openGeneration`, `then` is skipped when a newer open of the overlay started after the run
   * began. Returns `false` when the run was ignored (a run is in flight and `ignoreWhilePending`
   * is on, the default), so the part can
   * `preventDefault()` the activation, and `true` otherwise.
   */
  readonly run: (work: () => unknown, then?: () => void) => boolean;
}

/** Reports an error that cannot reach a boundary (conventions 2.4: never swallow). */
function report(error: unknown): void {
  if (typeof reportError === "function") reportError(error);
  else console.error(error);
}

/**
 * The transition of a pure-trigger part: an `action` with no state of its own (`Button`,
 * `Dialog.Close`, `Popover.Close`, `Menu.Item`, `Toast.Action`; conventions 3.4). A second `run`
 * while one is in flight is ignored by default (conventions 2.5, design/components/button.md 16).
 *
 * With `ignoreWhilePending: false` (the continuous controls' steps) runs overlap, and the hook
 * surfaces superseded rejections as `useControllableAction` does: React keeps only the newest
 * thenable per `useTransition`, so the rejection of a run that a later run superseded would be
 * dropped. The hook catches it and throws it from render, so it reaches the same boundary as the
 * latest run's rejection does.
 */
export function useActionTrigger(options: ActionTriggerOptions = {}): ActionTrigger {
  const { openGeneration, ignoreWhilePending = true } = options;

  // Thrown before `useTransition` on purpose (see use-controllable-action.ts): in the retry of
  // an errored render `useTransition` would suspend on the newer run's pending thenable.
  const [supersededError, setSupersededError] = useState<{ readonly error: unknown } | null>(null);
  const hasSupersededError = useRef(false);
  if (supersededError !== null) throw supersededError.error;

  const [pending, startOwnTransition] = useTransition();
  const latest = useRef(0);
  const mounted = useRef(false);
  // Runs whose work has not settled yet. Updated synchronously, so a second activation in the
  // same task (React's `pending` is still the stale render value) is seen (conventions 2.5).
  const inFlight = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = (work: () => unknown, then?: () => void): boolean => {
    // The own counter only, not the rendered `pending` (design/components/button.md 5.2): after
    // the work settled, a commit held by entanglement must not drop a new activation.
    if (ignoreWhilePending && inFlight.current > 0) return false;
    inFlight.current++;
    const id = ++latest.current;
    // The open this run belongs to (design/components/popover.md 3.4): if the
    // user dismisses and re-opens while the action runs, its close must not close the new open.
    const generation = openGeneration?.();
    startOwnTransition(async () => {
      try {
        await work();
      } catch (error) {
        inFlight.current--;
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
      inFlight.current--;
      if (openGeneration !== undefined && openGeneration() !== generation) return;
      then?.();
    });
    return true;
  };

  return { pending, run };
}

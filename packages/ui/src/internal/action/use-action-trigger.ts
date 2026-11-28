"use client";
import { useRef, useTransition } from "react";
import { isHandledRejection } from "./call-action.js";
import { reportDropped } from "./report-dropped.js";
import { useConnected } from "./use-connected.js";

export interface ActionTriggerOptions {
  /**
   * Open generation of the overlay a `then` belongs to: `then` is skipped when a newer open of
   * the overlay started after the run began.
   */
  readonly openGeneration?: (() => number) | undefined;
  /**
   * Ignore `run` while a run is in flight (conventions 2.5.1): `run` returns `false` and starts
   * nothing. In flight means the hook's synchronous in-flight counter is non-zero (it also sees
   * two activations in one task, before React re-rendered); the last render's `pending` is not
   * consulted, so a click in a settled-but-held commit window runs. Default `false`: runs
   * overlap, as with React's own `useTransition`. A pure trigger passes
   * `(whilePending ?? <its default>) === "ignore"`, read per render (#146), through
   * `usePureTrigger`.
   */
  readonly ignoreWhilePending?: boolean | undefined;
}

export interface ActionTrigger {
  /** A run started through this hook is in flight (the part's own transition). */
  readonly pending: boolean;
  /**
   * Runs `work` inside the part's own transition and, once it resolves, `then` (still inside the
   * transition: a Close part's close, a menu item's close). `work` calls a consumer's action
   * through `callAction`, so an action that called `details.reject()` counts as rejected: `then`
   * is skipped and nothing reaches a boundary or `reportError` (conventions 2.4.1). With overlapping runs, `then` runs
   * once, when the last run in flight settles, and only if the latest run resolved: it is the
   * latest run's `then` (#146 review F1). A rejection skips `then` and reaches
   * the nearest Error Boundary above the part; a run that a later run superseded, or any run
   * once the part unmounted or was hidden by `<Activity>`, passes its rejection to `reportError`
   * instead (conventions 2.4). With
   * `openGeneration`, `then` is skipped when a newer open of the overlay started after the run
   * began. Returns `false` when the run was ignored (a run is in flight and `ignoreWhilePending`
   * is on), so the part can
   * `preventDefault()` the activation, and `true` otherwise.
   */
  readonly run: (work: () => unknown, then?: () => void) => boolean;
}

/**
 * The transition of a pure-trigger part: an `action` with no state of its own (`Button`,
 * `Dialog.Close`, `Popover.Close`, `Menu.Item`, `Toast.Action`; conventions 3.4), and the steps
 * of the continuous controls (`Slider`, `NumberField`). A second `run` while one is in flight is
 * ignored only with `ignoreWhilePending` (a part whose `whilePending` is `"ignore"`, conventions
 * 2.5.1).
 *
 * Without it (`whilePending="run"`, the steps) runs overlap, and the hook handles superseded
 * rejections as `useControllableAction` does: React keeps only the newest
 * thenable per `useTransition`, so the rejection of a run that a later run superseded reaches no
 * boundary. The hook passes it to `reportError` (`reportDropped`); the latest run's rejection
 * is rethrown inside the transition and reaches the boundary. In both modes, a latest rejection
 * that arrives after the part unmounted or was hidden by `<Activity>` is reported too (#152):
 * React would route it only through a render of the part.
 */
export function useActionTrigger(options: ActionTriggerOptions = {}): ActionTrigger {
  const { openGeneration, ignoreWhilePending = false } = options;

  const [pending, startOwnTransition] = useTransition();
  const latest = useRef(0);
  // Runs whose work has not settled yet. Updated synchronously, so a second activation in the
  // same task (React's `pending` is still the stale render value) is seen (conventions 2.5).
  const inFlight = useRef(0);
  const connected = useConnected();
  // The latest run's continuation once it resolved, waiting for the other runs in flight to
  // settle. Cleared by every new run: only the latest run's outcome decides (#146 review F1).
  const resolvedThen = useRef<(() => void) | null>(null);

  // A run settled. When it was the last in flight, the latest run's continuation runs if that
  // run resolved; a rejected latest run (or a newer run since) left nothing to run.
  const settled = () => {
    inFlight.current--;
    if (inFlight.current > 0) return;
    const continuation = resolvedThen.current;
    resolvedThen.current = null;
    continuation?.();
  };

  const run = (work: () => unknown, then?: () => void): boolean => {
    // The own counter only, not the rendered `pending` (design/components/button.md 5.2): after
    // the work settled, a commit held by entanglement must not drop a new activation.
    if (ignoreWhilePending && inFlight.current > 0) return false;
    inFlight.current++;
    const id = ++latest.current;
    // The open this run belongs to (design/components/popover.md 3.4): if the
    // user dismisses and re-opens while the action runs, its close must not close the new open.
    const generation = openGeneration?.();
    resolvedThen.current = null;
    startOwnTransition(async () => {
      try {
        await work();
      } catch (error) {
        // The work's action called `details.reject()` (`callAction`, 2.4.1): as a rejection,
        // `then` does not run, but nothing is rethrown or reported.
        if (isHandledRejection(error)) {
          settled();
          return;
        }
        // The latest run's rejection takes React's own route to the boundary while the part is
        // there to render it; otherwise React would drop it, as it drops a superseded one (2.4).
        const rethrow = id === latest.current && connected.current;
        if (!rethrow) reportDropped(error);
        settled();
        if (rethrow) throw error;
        return;
      }
      if (id === latest.current && then !== undefined) {
        resolvedThen.current = () => {
          if (openGeneration !== undefined && openGeneration() !== generation) return;
          then();
        };
      }
      settled();
    });
    return true;
  };

  return { pending, run };
}

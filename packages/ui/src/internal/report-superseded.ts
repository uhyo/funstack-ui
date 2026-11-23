/**
 * Reports the rejection of a superseded run (conventions 2.4) for `useControllableAction` and
 * `useActionTrigger`. React keeps only the newest thenable per `useTransition`, so the rejection
 * of a run that a later run superseded reaches no Error Boundary; React drops it. The library
 * passes it to the global `reportError` instead, as React's standalone `startTransition` does
 * with every rejection: a window `error` event, seen by monitoring tools and by test runners,
 * while the UI stays up and shows the latest intent. The latest run's rejection is not passed
 * here: the caller rethrows it inside the transition, React's own route to the boundary.
 */
export function reportSuperseded(error: unknown): void {
  if (typeof reportError === "function") reportError(error);
  else console.error(error);
}

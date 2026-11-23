/** Whether `value` is a thenable (a promise, or anything with a callable `then`). */
function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

/**
 * Calls an `on*` handler under the rule every handler the library defines follows (conventions
 * 2.1, #148): synchronously, in the caller's event, not awaited and with no pending state. A
 * synchronous throw is caught and passed to `reportError`, so the library's own bookkeeping after
 * the call still runs; a returned thenable gets a rejection handler that passes the reason to
 * `reportError`. Nothing reaches an Error Boundary, and a returned promise is never a warning.
 * Used by `onOpenChange` (the overlay Roots), a toast's `onClose` and Combobox's
 * `onInputValueChange`. A missing handler is a no-op.
 *
 * Directive-free: no client-only API (it does not import `report-dropped.ts`, a client module,
 * and repeats its two-line `reportError` fallback instead).
 */
export function callUrgentHandler<Args extends readonly unknown[]>(
  handler: ((...args: Args) => unknown) | undefined,
  ...args: Args
): void {
  if (handler === undefined) return;
  let result: unknown;
  try {
    result = handler(...args);
  } catch (error) {
    report(error);
    return;
  }
  if (isThenable(result)) result.then(undefined, report);
}

/** `reportError`, or `console.error` where it does not exist (jsdom), as `reportDropped`. */
function report(error: unknown): void {
  if (typeof reportError === "function") reportError(error);
  else console.error(error);
}

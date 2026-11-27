// No directive: a scheduling helper with no React (conventions 7.1).

/**
 * Runs `callback` once `event` has been fully dispatched (internal-hooks.md 3.8 rule 5): in a
 * microtask when the dispatch is already over by then (a scripted `dispatchEvent`), else in a
 * task (an event the user caused, where a microtask checkpoint follows every listener). Returns
 * a function that cancels the call.
 */
export function afterDispatch(event: Event, callback: () => void): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  queueMicrotask(() => {
    if (cancelled) return;
    if (event.eventPhase === Event.NONE) callback();
    else timer = setTimeout(callback, 0);
  });
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}

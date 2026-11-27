/**
 * Calls `callback` once `event` has finished dispatching (design/internal-hooks.md 3.8 rule 5):
 * every listener has run, and so has whatever the platform does after the dispatch (a form's
 * reset algorithm). Returns a function that cancels the call.
 *
 * A microtask first. After an event dispatched from script (`form.reset()`, `dispatchEvent`)
 * the dispatch is over by then (`eventPhase` is `NONE`), so the callback runs there, in the same
 * task. After an event the browser dispatches from a task (a click on a reset button), a
 * microtask checkpoint follows each listener, so the microtask runs mid-dispatch: the callback
 * waits for a task (`setTimeout(…, 0)`). `eventPhase` rather than `window.event`, which is not
 * set for a listener in a shadow tree.
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
    if (timer !== undefined) clearTimeout(timer);
  };
}

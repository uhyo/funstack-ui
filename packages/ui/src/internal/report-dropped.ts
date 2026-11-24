// No directive: no client-only API, so directive-free modules (`call-urgent-handler.ts`) import
// it too (conventions 7.1). `useConnected` lives in `use-connected.ts`.

/**
 * Reports an action rejection that React would drop (conventions 2.4), for `useControllableAction`
 * and `useActionTrigger`. React routes a transition's rejection only by unwrapping the newest
 * thenable of a `useTransition` in a render of the component that owns it, so two rejections reach
 * no Error Boundary:
 *
 * - a **superseded** run's (a later run of the same hook replaced its thenable), and
 * - the **latest** run's once the owner is **gone**: unmounted, or hidden (a consumer's
 *   `<Activity>`, the library's `keepMounted` overlays in `overlay-popup.tsx`, Toast's Suspense
 *   guard, any Suspense boundary showing its fallback): no render reads it (#152). Hidden counts
 *   as gone: the rejection is reported once and does not reach the boundary on re-show, where
 *   React would deliver it (a deliberate deviation, conventions resolved question 43).
 *
 * The library passes them to the global `reportError` instead, as React's standalone
 * `startTransition` does with every rejection: a window `error` event, seen by monitoring tools
 * and by test runners, while the UI stays up. `console.error` where there is no `reportError`. `callUrgentHandler` uses the same fallback for
 * an `on*` handler's throw or rejection.
 */
export function reportDropped(error: unknown): void {
  if (typeof reportError === "function") reportError(error);
  else console.error(error);
}

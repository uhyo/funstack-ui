// No "use client" directive: a plain module-level store, no React and no DOM calls
// (design/components/toast.md 4.3, conventions 3.5 "module-level registry").
//
// The stack of open modal `<dialog>` elements the library's Dialog opened. A top-layer element
// outside the topmost modal dialog is inert and absent from the accessibility tree, so Toast's
// Viewport portals its region into the topmost one. Writers (`use-modal-registration.ts`) run
// in layout effects and platform event listeners, never during render; readers subscribe through
// `useSyncExternalStore` with a server snapshot of `null`. Never the source of truth for a
// component's own state.

const stack: Element[] = [];
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of [...listeners]) listener();
}

/** Records `dialog` as the topmost open modal dialog (moves it to the top if already present). */
export function pushModal(dialog: Element): void {
  const index = stack.indexOf(dialog);
  if (index !== -1 && index === stack.length - 1) return;
  if (index !== -1) stack.splice(index, 1);
  stack.push(dialog);
  notify();
}

/** Forgets `dialog` (closed or unmounted). */
export function removeModal(dialog: Element): void {
  const index = stack.indexOf(dialog);
  if (index === -1) return;
  stack.splice(index, 1);
  notify();
}

export function subscribeModals(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The topmost open modal dialog the library opened, or `null`. */
export function getTopmostModal(): Element | null {
  return stack.at(-1) ?? null;
}

/** The server snapshot: nothing is open on the server. */
export function getServerTopmostModal(): Element | null {
  return null;
}

// Directive-free: the module-level first-invalid collector (design/components/field-form.md 2.5).
import { sortByDocumentOrder } from "./validity.js";

interface Batch {
  readonly targets: HTMLElement[];
  /** `document.activeElement` when the first target arrived. */
  readonly activeBefore: Element | null;
}

/** The submission attempt in progress: every target added during the current task. */
let batch: Batch | null = null;

/**
 * Adds a control whose `invalid` event a Field cancelled during a submission attempt, and
 * focuses the first collected control in document order in a microtask, so the result does not
 * depend on the browser's dispatch order or on how many forms are on the page.
 *
 * The batch lives until the end of the task (a `setTimeout`), not just one microtask: when the
 * browser dispatches the `invalid` events itself (a click on a submit button), it runs a
 * microtask checkpoint after each listener, so the microtask of the first event runs before the
 * second event fires. Every add therefore queues a focus of the batch's first target; later ones
 * re-focus the same element, which is a no-op.
 *
 * Skips the focus when focus moved during the attempt to an element that is not one of the
 * collected targets: a plain `<input required>` with no Field kept the platform's behaviour
 * (bubble and focus), and the library does not fight it.
 */
export function collectInvalid(target: HTMLElement | null): void {
  if (target === null) return;
  if (batch === null) {
    batch = { targets: [], activeBefore: target.ownerDocument.activeElement };
    setTimeout(() => {
      batch = null;
    }, 0);
  }
  const current = batch;
  if (!current.targets.includes(target)) current.targets.push(target);
  queueMicrotask(() => focusFirst(current));
}

function focusFirst({ targets, activeBefore }: Batch): void {
  const connected = targets.filter((t) => t.isConnected);
  if (connected.length === 0) return;
  const active = connected[0]!.ownerDocument.activeElement;
  if (active !== activeBefore && active !== null && !connected.includes(active as HTMLElement)) {
    return;
  }
  const first = sortByDocumentOrder(connected, (t) => t)[0]!;
  if (active !== first) first.focus();
}

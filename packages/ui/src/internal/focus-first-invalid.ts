// Directive-free: the module-level first-invalid collector (design/components/field-form.md 2.5).
import { announce } from "./announce.js";
import { sortByDocumentOrder } from "./dom-order.js";

interface Batch {
  /** The elements whose `invalid` event was collected (a group's members, not its target). */
  readonly sources: Set<Element>;
  readonly targets: HTMLElement[];
  /** The message each target's Field shows, for the announcement when focus does not move. */
  readonly messages: Map<HTMLElement, string>;
  /** `document.activeElement` when the first target arrived. */
  readonly activeBefore: Element | null;
  /** The batch moved focus (later microtasks then re-focus, never announce). */
  moved: boolean;
  /** The target already announced. */
  announced: HTMLElement | null;
}

/** The submission attempt in progress: every target added during the current task. */
let batch: Batch | null = null;

/**
 * Adds a control whose `invalid` event (fired on `source`) a Field cancelled during a submission
 * attempt, and focuses the first collected control in document order in a microtask, so the
 * result does not depend on the browser's dispatch order or on how many forms are on the page.
 *
 * The batch lives until the end of the task (a `setTimeout`), not just one microtask: when the
 * browser dispatches the `invalid` events itself (a click on a submit button), it runs a
 * microtask checkpoint after each listener, so the microtask of the first event runs before the
 * second event fires. Every add therefore queues a focus of the batch's first target; later ones
 * re-focus the same element, which is a no-op.
 *
 * A second `invalid` for the same `source` (the element the event fired on) starts a new batch:
 * one validation fires it once per element, so it belongs to the next attempt, even when that
 * attempt comes before the timer (two attempts in one task, or a test that does not yield to
 * timers between them). Joining the old batch would compare focus with the old attempt's.
 *
 * Skips the focus when focus moved during the attempt to an element that is not one of the
 * collected targets: a plain `<input required>` with no Field kept the platform's behaviour
 * (bubble and focus), and the library does not fight it.
 */
export function collectInvalid(target: HTMLElement | null, message: string, source: Element): void {
  if (target === null) return;
  if (batch !== null && batch.sources.has(source)) batch = null;
  if (batch === null) {
    const created: Batch = {
      sources: new Set(),
      targets: [],
      messages: new Map(),
      activeBefore: target.ownerDocument.activeElement,
      moved: false,
      announced: null,
    };
    batch = created;
    setTimeout(() => {
      if (batch === created) batch = null;
    }, 0);
  }
  const current = batch;
  current.sources.add(source);
  if (!current.targets.includes(target)) current.targets.push(target);
  current.messages.set(target, message);
  queueMicrotask(() => focusFirst(current));
}

/**
 * Tests only: forget the submission attempt in progress. Its timer is a task away, and the next
 * test can start before it runs (no task in between); its attempt would then join this one and
 * compare focus with an element of the previous test.
 */
export function resetInvalidBatch(): void {
  batch = null;
}

function focusFirst(current: Batch): void {
  const { targets, activeBefore } = current;
  const connected = targets.filter((t) => t.isConnected);
  if (connected.length === 0) return;
  const active = connected[0]!.ownerDocument.activeElement;
  if (active !== activeBefore && active !== null && !connected.includes(active as HTMLElement)) {
    return;
  }
  const first = sortByDocumentOrder(connected, (t) => t)[0]!;
  if (active !== first) {
    current.moved = true;
    first.focus();
  } else if (!current.moved && current.announced !== first) {
    // Focus was already on the first invalid control (an implicit submission with Enter): the
    // cancelled bubble was the only announcement, so speak the message instead.
    current.announced = first;
    announce(first, current.messages.get(first) ?? "");
  }
}

// The one rule of every Escape the library handles in JS (conventions 15). No "use client"
// directive: reads and schedules on a DOM event only.
import { afterDispatch } from "./after-dispatch.js";
import { documentOf } from "./event-document.js";

/** The fields of a `keydown` the rule reads; a DOM `KeyboardEvent` (React's `nativeEvent`). */
type KeyLike = Pick<KeyboardEvent, "key" | "isComposing" | "keyCode">;

/** The Escapes a layer of the library took (conventions 15 rule 3), read past the dispatch. */
const consumed = new WeakSet<object>();

/**
 * Whether a `keydown` belongs to an IME composition: `isComposing`, or `keyCode === 229` /
 * `key === "Process"`, which engines report for a key the IME took (WebKit fires
 * `compositionend` before the key that ends the composition, so that keydown has
 * `isComposing === false`). The one IME guard of every key handler (conventions 15).
 */
export function isComposingKey(event: KeyLike): boolean {
  return event.isComposing || event.keyCode === 229 || event.key === "Process";
}

/**
 * Whether a `keydown` is an Escape the library may act on (conventions 15): `key === "Escape"`,
 * not part of an IME composition (there Escape cancels the composition), and not consumed
 * already (innermost first: an inner handler prevented it, or a layer took it, `consumeEscape`).
 * An Escape first settles the earlier ones (`settleEarlierEscapes`, #195), so what its record
 * step reads (a layer's open state, the stand-down snapshot) follows their decisions. So call
 * it only while `event` is being dispatched: on an event already decided it would decide the
 * Escapes pending after it, out of turn.
 */
export function isEscapeRequest(event: KeyLike & Pick<Event, "defaultPrevented">): boolean {
  if (event.key === "Escape") settleEarlierEscapes(event);
  return isRequest(event);
}

/** `isEscapeRequest` without the settle step: what a decision reads of its own event. */
function isRequest(event: KeyLike & Pick<Event, "defaultPrevented">): boolean {
  return (
    event.key === "Escape" &&
    !event.defaultPrevented &&
    !consumed.has(event) &&
    !isComposingKey(event)
  );
}

/**
 * Takes an Escape for the layer that closed on it or consumed it (conventions 15 rule 3):
 * `preventDefault()` (an enclosing close watcher sees a canceled `keydown`), plus a mark the
 * other layers of the library read through `isEscapeRequest`, also after the dispatch, where
 * preventing no longer does anything (and is not done: the event stays as the page left it).
 */
export function consumeEscape(event: Event): void {
  if (event.eventPhase !== Event.NONE) event.preventDefault();
  consumed.add(event);
}

interface Decider {
  readonly decide: () => void;
  readonly global: boolean;
  /** Closes nothing shown and never consumes (`{ cancel: true }`): decides first. */
  readonly cancelOnly: boolean;
  cancelled: boolean;
}

/** The layers that recorded one event, in record order, and the end of its wait. */
interface Entry {
  readonly deciders: Decider[];
  /** Removes the window listener and cancels the late path, without deciding. */
  readonly dispose: () => void;
  /** Decides now, once: what the window listener or the late path does. */
  readonly run: () => void;
}

const entries = new WeakMap<Event, Entry>();

/** The events whose decision is pending, in the order they were first recorded. */
const pendingEvents = new Set<Event>();

/**
 * Decides now the pending Escapes recorded before `event` whose dispatch is over (conventions 15
 * rule 4, #195): only on the late path, a second key press dispatched before the first one's
 * task. They run in record order, each in the order of rule 4, as their tasks would have run
 * them, so each Escape still closes one layer and a later one reads the layers the earlier ones
 * closed. An Escape dispatched inside another's dispatch leaves that one pending.
 */
function settleEarlierEscapes(event: object): void {
  for (const earlier of pendingEvents) {
    if (earlier === event) return;
    if (earlier.eventPhase === Event.NONE) entries.get(earlier)?.run();
  }
}

/**
 * The window an event target belongs to: a window (read back through its document, which jsdom
 * needs: the listener's `currentTarget` there is not the global object), a document's, or a
 * node's document's.
 */
function windowOf(target: EventTarget | null): Window | null {
  if (target === null) return null;
  if (!("nodeType" in target)) return (target as Window).document?.defaultView ?? null;
  return documentOf(target)?.defaultView ?? null;
}

export interface DecideEscapeLastOptions {
  /**
   * A layer that closes on Escape wherever focus is (a shown or coming HoverCard, a shown
   * Tooltip), recorded on the window: it decides before the layers the Escape came from.
   */
  readonly global?: boolean;
  /**
   * A decision that only cancels a coming open (a Trigger's cancel, conventions 15 rule 3):
   * it closes nothing shown and never consumes, so it decides first, before the global layers,
   * and another layer's consume does not skip it. A `preventDefault()` by the page still does.
   */
  readonly cancel?: boolean;
}

/** The first record of `event`: one window listener and one late path for all its layers. */
function createEntry(event: KeyboardEvent): Entry {
  const deciders: Decider[] = [];
  const win = windowOf(event.currentTarget);
  let cancelLate: () => void = () => {};
  const dispose = (): void => {
    win?.removeEventListener("keydown", onWindow);
    cancelLate();
    entries.delete(event);
    pendingEvents.delete(event);
  };
  const run = (): void => {
    if (entries.get(event) !== entry) return;
    dispose();
    const ordered = [
      ...deciders.filter((decider) => decider.cancelOnly),
      ...deciders.filter((decider) => !decider.cancelOnly && decider.global),
      ...deciders.filter((decider) => !decider.cancelOnly && !decider.global).reverse(),
    ];
    for (const decider of ordered) {
      if (!isRequest(event)) return;
      if (!decider.cancelled) decider.decide();
    }
  };
  function onWindow(windowEvent: Event): void {
    if (windowEvent === event) run();
  }
  settleEarlierEscapes(event);
  const entry: Entry = { deciders, dispose, run };
  entries.set(event, entry);
  pendingEvents.add(event);
  win?.addEventListener("keydown", onWindow);
  cancelLate = afterDispatch(event, run);
  return entry;
}

/**
 * Records an Escape for a layer and decides it last (conventions 15 rule 4). Call it from the
 * layer's capture `keydown` listener, after `isEscapeRequest` and the layer's stand-down
 * snapshot. The decision runs once per event for all its recorded layers together: in a bubble
 * `keydown` listener added to the window for this event only (after every element, document
 * and earlier window listener), or after the dispatch (`afterDispatch`) when a
 * `stopPropagation()` kept the event from the window. Order: the cancel-only deciders, then the
 * global layers in record order, then the others innermost first (reverse record order); each
 * `decide` only while the event is
 * still an Escape request, so one Escape closes one layer. The same `decide` recorded twice for
 * an event is ignored. Returns a function that cancels this layer's decision (an unmount
 * between the record and the decision); once every layer of the event cancelled, the window
 * listener and the late path go too.
 */
export function decideEscapeLast(
  event: KeyboardEvent,
  decide: () => void,
  options?: DecideEscapeLastOptions,
): () => void {
  const entry = entries.get(event) ?? createEntry(event);
  let decider = entry.deciders.find((recorded) => recorded.decide === decide);
  if (decider === undefined) {
    decider = {
      decide,
      global: options?.global ?? false,
      cancelOnly: options?.cancel ?? false,
      cancelled: false,
    };
    entry.deciders.push(decider);
  }
  const own = decider;
  return () => {
    own.cancelled = true;
    if (entries.get(event) === entry && entry.deciders.every((recorded) => recorded.cancelled)) {
      entry.dispose();
    }
  };
}

/** One layer listener's pending decisions (`createEscapeRecord`). */
export interface EscapeRecord {
  /**
   * `decideEscapeLast(event, decide, options)`, keeping its cancel. The same event recorded
   * again is ignored; a new event keeps the pending decision of an earlier one, which decides
   * first (`settleEarlierEscapes`, #195), and does not cancel it.
   */
  readonly record: (
    event: KeyboardEvent,
    decide: () => void,
    options?: DecideEscapeLastOptions,
  ) => void;
  /** Cancels the pending decisions: the listener's cleanup (conventions 15 rule 4). */
  readonly cancel: () => void;
}

/** The holder a layer's Escape listener keeps its pending decisions in, for its cleanup. */
export function createEscapeRecord(): EscapeRecord {
  const pending = new Map<KeyboardEvent, () => void>();
  const cancel = (): void => {
    for (const cancelDecision of pending.values()) cancelDecision();
    pending.clear();
  };
  const record: EscapeRecord["record"] = (event, decide, options) => {
    if (pending.has(event)) return;
    // Forgets the events already decided: a decider skipped after a consume is never called.
    for (const earlier of pending.keys()) if (!entries.has(earlier)) pending.delete(earlier);
    const cancelDecision = decideEscapeLast(
      event,
      () => {
        pending.delete(event);
        decide();
      },
      options,
    );
    pending.set(event, cancelDecision);
  };
  return { record, cancel };
}

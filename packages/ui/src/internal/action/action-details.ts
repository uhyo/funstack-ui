import type { ActionDetails, Rejectable } from "../types.js";

function isDev(): boolean {
  return process.env.NODE_ENV !== "production";
}

function rejectVirtualWrite(key: "event" | "reject"): never {
  throw new TypeError(
    key === "event"
      ? "`details.event` is a read-only virtual property; it cannot be assigned or defined. " +
          "Keep the DOM event out of `details` so that it stays serialisable."
      : "`details.reject` is a read-only virtual property; it cannot be assigned or defined.",
  );
}

/** The per-details slot that `attachReject` fills: the `reject` an action's details serves. */
interface RejectSlot {
  reject: (() => void) | undefined;
}

/** The slot of every details object `createActionDetails` built. */
const slots = new WeakMap<object, RejectSlot>();

function isVirtual(key: string | symbol): key is "event" | "reject" {
  return key === "event" || key === "reject";
}

/**
 * Builds the `details` argument of an action or a handler (conventions 2.2).
 *
 * `fields` is a plain, extensible object of serialisable component-specific fields. `event` is a
 * virtual, non-own property served by a Proxy: `details.event` and `"event" in details` work,
 * while `Object.keys`, spread, `JSON.stringify` and React's Server Function serialiser see only
 * the real fields. That is what lets a Server Function be passed directly as an action.
 *
 * `reject` (conventions 2.4.1) is the second virtual property, served the same way once
 * `attachReject` gave the object one, which `callAction` does when it calls an action with it. A
 * handler's details never gets one: `details.reject` is `undefined` and `"reject" in details` is
 * `false` there.
 *
 * Writing `event` or `reject` (`details.event = x`, `Object.defineProperty(details, "event",
 * ...)`) is rejected so that an own, enumerable one can never appear: in development it throws a
 * `TypeError`; in production an assignment is ignored and a `defineProperty` is declined (which
 * makes `Object.defineProperty` throw and `Reflect.defineProperty` return `false`).
 *
 * No `"use client"` directive: this file uses no client-only API, so it is importable from
 * anywhere (conventions 7.1).
 */
export function createActionDetails<T extends object>(
  event: Event | undefined,
  fields: T,
): T & ActionDetails {
  const slot: RejectSlot = { reject: undefined };
  const details = new Proxy(fields, {
    get: (target, key, receiver) =>
      key === "event" ? event : key === "reject" ? slot.reject : Reflect.get(target, key, receiver),
    has: (target, key) =>
      key === "event" ||
      (key === "reject" && slot.reject !== undefined) ||
      Reflect.has(target, key),
    set: (target, key, value, receiver) => {
      if (isVirtual(key)) {
        if (isDev()) rejectVirtualWrite(key);
        return true;
      }
      return Reflect.set(target, key, value, receiver);
    },
    defineProperty: (target, key, descriptor) => {
      if (isVirtual(key)) {
        if (isDev()) rejectVirtualWrite(key);
        return false;
      }
      return Reflect.defineProperty(target, key, descriptor);
    },
  }) as T & ActionDetails;
  slots.set(details, slot);
  return details;
}

/**
 * Gives `details` the `reject` an action calls (conventions 2.4.1) and returns the object to pass
 * to the action. The same object when `createActionDetails` built it, so the library's own maps
 * keyed by a dispatch's details (Menu's close continuations, Combobox's dispatch records) still
 * find it; a later call (a library wrapper that calls the consumer's action through `callAction`
 * again) replaces the earlier `reject`. Any other object is copied into a new details object.
 * Internal: `callAction` is the only caller.
 */
export function attachReject<D extends ActionDetails>(
  details: D,
  reject: () => void,
): D & Rejectable {
  let target: object = details;
  let slot = slots.get(target);
  if (slot === undefined) {
    const { event, ...fields } = details;
    target = createActionDetails(event, fields);
    slot = slots.get(target) as RejectSlot;
  }
  slot.reject = reject;
  return target as D & Rejectable;
}

import type { ActionDetails } from "./types.js";

function isDev(): boolean {
  return process.env.NODE_ENV !== "production";
}

function rejectEventWrite(): never {
  throw new TypeError(
    "`details.event` is a read-only virtual property; it cannot be assigned or defined. " +
      "Keep the DOM event out of `details` so that it stays serialisable.",
  );
}

/**
 * Builds the `details` argument of an action (conventions 2.2).
 *
 * `fields` is a plain, extensible object of serialisable component-specific fields. `event` is a
 * virtual, non-own property served by a Proxy: `details.event` and `"event" in details` work,
 * while `Object.keys`, spread, `JSON.stringify` and React's Server Function serialiser see only
 * the real fields. That is what lets a Server Function be passed directly as an action.
 *
 * Writing `event` (`details.event = x`, `Object.defineProperty(details, "event", ...)`) is
 * rejected so that an own, enumerable `event` can never appear: in development it throws a
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
  return new Proxy(fields, {
    get: (target, key, receiver) => (key === "event" ? event : Reflect.get(target, key, receiver)),
    has: (target, key) => key === "event" || Reflect.has(target, key),
    set: (target, key, value, receiver) => {
      if (key === "event") {
        if (isDev()) rejectEventWrite();
        return true;
      }
      return Reflect.set(target, key, value, receiver);
    },
    defineProperty: (target, key, descriptor) => {
      if (key === "event") {
        if (isDev()) rejectEventWrite();
        return false;
      }
      return Reflect.defineProperty(target, key, descriptor);
    },
  }) as T & ActionDetails;
}

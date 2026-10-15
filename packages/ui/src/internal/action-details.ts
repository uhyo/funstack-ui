import type { ActionDetails } from "./types.js";

/**
 * Builds the `details` argument of an action (conventions 2.2).
 *
 * `fields` is a plain, extensible object of serialisable component-specific fields. `event` is a
 * virtual, non-own property served by a Proxy: `details.event` and `"event" in details` work,
 * while `Object.keys`, spread, `JSON.stringify` and React's Server Function serialiser see only
 * the real fields. That is what lets a Server Function be passed directly as an action.
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
  }) as T & ActionDetails;
}

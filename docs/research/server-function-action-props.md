# Server Functions as action props: what `details` may contain

Research date: **2026-10-15**. GitHub issue #17. Follows up `design/components/toggle.md`
"Conventions feedback" #2 and `design/conventions.md` sections 2 and 7.

Question: can a Server Component pass a Server Function straight into an action prop
(`<Toggle pressedChangeAction={setFavorite}>`) when the library calls the action as
`(next, details)` and `details.event` is a DOM `Event`?

Everything below was measured with the probe
`memo/platform-researcher/probes/03-server-function-action-details.mjs` against
`react-server-dom-webpack@19.3.1` (browser client + server builds, development and production),
plus a reading of the reply serialiser source. Outputs are saved next to the probe.

## Summary and verdict

**Verdict: adopt**, with one change to the `details` shape.

- A DOM `Event` as an **own enumerable property** of `details` is rejected by React's reply
  serialiser. Without a temporary-reference set the call **throws** on the client (dev message
  "Only plain objects, and a few built-ins, can be passed to Server Functions. Classes or null
  prototypes are not supported."; production error #499). With a temporary-reference set it is
  replaced by an opaque `$T` reference and the server sees a proxy that throws on any property
  access ("Cannot access shiftKey on the server").
- Every framework surveyed (Next.js, React Router, Parcel, Waku, the Vite RSC starter) *does*
  create a temporary-reference set, so today the direct pass "works" as long as the Server
  Function never reads `details.event`. That is accidental: the React docs list "Events from
  event handlers" as unsupported arguments, and nothing in dev warns about it.
- Making `event` **non-enumerable** serialises cleanly but logs a misleading dev-only
  `console.error` on every call ("Classes or other objects with methods are not supported"),
  because the serialiser's plain-object check requires every own property to be enumerable.
  A class instance, a null-prototype object or a symbol-keyed property are all rejected too.
- Detecting a Server Function on the client is **not possible**: the browser-side reference is
  a plain function with only `length` and `name` as own properties (`$$typeof`/`$$id` exist
  only on the server side). The library cannot special-case it.
- **Recommended shape: `details` is a plain object holding only serialisable fields, and
  `event` is a *virtual* property served by a `Proxy` `get`/`has` trap.** `details.event`
  reads and `"event" in details` work unchanged on the client; `Object.keys`, spread,
  `JSON.stringify`, and React's serialiser all see only the serialisable fields; no dev warning
  fires; a Server Function receives `details` with `event` absent (`undefined`). The
  `ActionDetails` type is unchanged.

## 1. The precise serialisation rule (react-server-dom 19.3.1 client)

`encodeReply(args)` runs `JSON.stringify(args, resolveToJSON)` (`serializeModel`). So the
first filter is JSON.stringify itself, which visits **own, enumerable, string-keyed** properties
only, invoking getters and `toJSON`. Then, per visited object value, `resolveToJSON` applies:

| Value | Without temporary references | With temporary references (all surveyed frameworks) |
| --- | --- | --- |
| Plain object (prototype is `Object.prototype`, or a null-prototype "root" look-alike) | serialised | serialised |
| Object whose prototype chain is longer (`Event`, any class instance), or `Object.create(null)` | **throws** (dev message above; prod #499) | replaced by `"$T"`; server gets an opaque proxy |
| Built-ins: `Date`, `Map`, `Set`, typed arrays, `ArrayBuffer`, `Blob`, `FormData`, iterables, `ReadableStream`, async iterables | special-cased, serialised | same |
| Function that is a known Server Function reference | serialised as `$h` reference | same |
| Any other function | **throws** "Client Functions cannot be passed directly to Server Functions" | `"$T"` |
| Symbol value | **throws** unless `Symbol.for` | `"$T"` |
| `undefined` | `"$undefined"` (round-trips as `undefined`) | same |

Development-only `console.error` (serialisation still proceeds) for a plain object that:

- has any **non-enumerable own property** (except React's `key`/`ref` getters): "Only plain
  objects can be passed to Server Functions from the Client. Classes or other objects with
  methods are not supported." (`isSimpleObject` checks `Object.getOwnPropertyNames` +
  `enumerable`.)
- has any **own symbol-keyed property** (enumerable or not): "...Objects with symbol properties
  like X are not supported."
- has a `toJSON` method, or whose `Object.prototype.toString` tag is not `Object`.

The production build keeps the throw / `$T` behaviour and drops the `console.error` checks.

The prototype test, verbatim from the browser client:

```js
parentReference = getPrototypeOf(value);
if (parentReference !== ObjectPrototype$1 &&
    (null === parentReference || null !== getPrototypeOf(parentReference))) {
  if (void 0 === temporaryReferences) throw Error("Only plain objects, and a few built-ins, ...");
  return "$T";
}
```

On the server, `decodeReply` turns `$T` into a `Proxy` whose every property read throws
"Cannot access <name> on the server. You cannot dot into a temporary client reference from a
server component." Calling it throws too. `typeof details.event` there is `"function"`.

## 2. Probe results

Args were `[true, details]`, called through `createServerReference` + `encodeReply` and decoded
with `decodeReply`, both with and without a temporary-reference set. Dev and prod agree except
for the `console.error` column (prod never logs).

| # | `details` | No temp refs | With temp refs | Dev `console.error` |
| --- | --- | --- | --- | --- |
| 1 | `{ event: MouseEvent }` | **throws** | OK, wire `{"event":"$T"}`; server `details.event` is an opaque proxy | none |
| 1b | same, Server Function reads `details.event.shiftKey` | throws (client) | **throws on the server** "Cannot access shiftKey" | none |
| 2 | `event` as non-enumerable data property | OK, wire `{}` | OK, wire `{}` | **yes** ("Classes or other objects with methods") |
| 3 | `event` as enumerable getter | throws | OK, `$T` | none (getter is invoked, event serialised like #1) |
| 3b | `event` as non-enumerable getter | OK, `{}` | OK, `{}` | **yes** (as #2) |
| 4 | class instance `new ActionDetails(event)` | throws | whole `details` becomes `$T`; any field read throws on server | none |
| 4b | class instance with no fields | throws | same as #4 | none |
| 5 | `{ reason: "click", shiftKey: true }` | OK | OK | none |
| 6 | `{ event: undefined }` | OK, wire `{"event":"$undefined"}`; server sees `undefined` | OK | none |
| 7 | symbol-keyed `event` | OK, `{}` | OK, `{}` | **yes** ("symbol properties") |
| 8 | event as third positional argument | throws | OK, wire `[true,{},"$T"]` | none |
| 9 | `Proxy` over `{}` with `get`/`has` traps for `event` | OK, `{}` | OK, `{}` | **none** |
| 10 | null-prototype object | throws | `$T` | none |
| 11 | frozen plain object | OK | OK | none |
| 12 | plain `{}` with event in a side `WeakMap` | OK | OK | none |

Detection probe (browser client, `createServerReference`): own properties are `["length",
"name"]` in dev (`["length", "name", "prototype"]` in prod); `$$typeof` and `$$id` are
`undefined`; `bind` is inherited; the function source is `(...args) => server(...args)` in dev
and `function action()` in prod. A `.bind()`ed reference is an ordinary bound function. There is
no public marker. (The *SSR* client build does add `$$FORM_ACTION` and `$$IS_SIGNATURE_EQUAL`,
but in that environment `callServer` throws "Server Functions cannot be called during initial
render", so it is irrelevant to action props.)

## 3. Framework survey: who passes `temporaryReferences`?

| Framework | `callServer` creates a temporary-reference set? | Source |
| --- | --- | --- |
| Next.js (canary) | Yes, and additionally **omits trailing arguments the Server Function does not use** (`omitUnusedArgs`), so `details` is never sent when the function is declared `(id, next)` | `packages/next/src/client/components/router-reducer/reducers/server-action-reducer.ts`, `packages/next/src/shared/lib/server-reference-info.ts` |
| React Router (RSC) | Yes (`createCallServer`) | `packages/react-router/lib/rsc/browser.tsx` |
| Parcel (`@parcel/rsc`) | Yes (`fetchRSC`) | `packages/utils/rsc/src/client.tsx` |
| Waku | Yes | `packages/waku/src/minimal/client-runtime.tsx` |
| Vite `@vitejs/plugin-rsc` | User-supplied `setServerCallback`; the starter example creates one | `packages/plugin-rsc/examples/starter/src/framework/entry.browser.tsx` |

So an enumerable `details.event` does not crash in any of these today. It still must not be
the documented contract: the React reference explicitly lists "Events from event handlers" under
unsupported Server Function arguments, a custom `callServer` without the set throws, and a
Server Function that touches `details.event` throws on the server with a message that points at
nothing in the consumer's code.

## 4. Options evaluated

| Option | Serialises? | Dev warning? | `details.event` DX | Verdict |
| --- | --- | --- | --- | --- |
| (a) plain object, `event` non-enumerable | yes, `{}` | **yes, misleading, every call** | unchanged | reject |
| (b) class instance | no (throws / whole object opaque) | n/a | unchanged | reject |
| (c) strip `details` when the action is a Server Function | n/a | n/a | n/a | **impossible**: no client-side marker |
| (d) keep `{ event }` enumerable; document the client wrapper (status quo) | works only via temporary references | none | unchanged | fallback only |
| (e) plain object + `event` as a Proxy-served virtual property | yes, only real fields | **none** | unchanged (`details.event`, `"event" in details`) | **recommend** |
| side channel `getEvent(details)` | yes | none | worse: extra import | not needed given (e) |
| event as third positional argument | same problems as `{ event }` | none | worse | reject |

## 5. Recommended `details` shape for v0

```ts
// packages/ui/src/internal/action-details.ts ("use client")
export interface ActionDetails {
  /** The DOM event that caused the action, or undefined for programmatic changes.
   *  Not an own property: it is readable, but not copied by spread/keys/JSON and
   *  never sent to a Server Function. */
  readonly event: Event | undefined;
}

export function createActionDetails<T extends object>(event: Event | undefined, fields: T): T & ActionDetails {
  return new Proxy(fields, {
    get: (target, key, receiver) => (key === "event" ? event : Reflect.get(target, key, receiver)),
    has: (target, key) => key === "event" || Reflect.has(target, key),
  }) as T & ActionDetails;
}
```

Contract to document in conventions section 2.2:

1. `details` is always a plain object of serialisable fields (strings, numbers, booleans,
   `undefined`). Component-specific fields such as `reason` are ordinary own properties.
2. `event` is a **virtual** property: `details.event` and `"event" in details` work;
   `Object.keys(details)`, `{ ...details }`, `JSON.stringify(details)` and
   `structuredClone(details)` do not include it (`structuredClone` of the Proxy throws
   `DataCloneError`; of a plain `{ event }` it would throw too in browsers). Test assertions
   must read `details.event` rather than `toEqual({ event: ... })`.
3. Therefore a Server Function may be passed directly as any action prop. It receives
   `(next, details)` with `details.event === undefined` and every other field intact, in every
   RSC framework, with no dev warning. The thin client wrapper in `toggle.md` 2.2 becomes
   optional, kept only as the way to drop or reshape arguments.
4. The `ActionDetails` type and the `(next, details)` signature do not change.

Cost: one `Proxy` allocation per dispatch (negligible next to a transition), and a devtools
display of `Proxy(Object) { reason: "click" }` without `event`, which the docs explain.

Why not (d) alone: it leaves the headline Server Component example in `toggle.md` section 9
depending on an undocumented framework behaviour and on the Server Function never inspecting
`details`. Why not (a): the warning fires on every direct call in development and names a cause
("objects with methods") that does not exist, which consumers will report as a library bug.

## 6. Caveats

- The Proxy should target an **extensible** plain object; readonly-ness comes from the
  TypeScript type, not `Object.freeze`. Correction (2026-10-16, reviewer probe): a frozen target
  does **not** break the `has` trap for `event` (`"event" in frozenDetails` is `true`, no throw).
  The Proxy invariants only constrain `has` returning `false` for non-configurable properties and
  the `getOwnPropertyDescriptor` / `ownKeys` traps. Without `set` / `defineProperty` traps,
  `details.event = x` would create an own enumerable `event` that then serialises, so the library
  helper adds both traps rejecting `"event"`.
- If a future react-server-dom version inspected `[[Get]]` for non-own keys the rule would
  change; `JSON.stringify` semantics (own enumerable keys only) are spec-stable, and the dev
  checks only use `getOwnPropertyNames` / `getOwnPropertySymbols`, so this is low risk.
- Next.js's unused-argument omission is a bundler-level optimisation specific to Next.js; the
  library must not rely on it.
- `details` reaching a Server Function via a bound reference (`serverFn.bind(null, id)` done on
  the server) behaves identically: bound args are prepended server-side and the client args are
  serialised with the same rules.

## References

- React reference, `"use server"` > "Serializable arguments and return values" (lists "Events
  from event handlers" as unsupported): https://react.dev/reference/rsc/use-server
- react-server-dom-webpack 19.3.1 client source, `processReply` / `resolveToJSON` /
  `isSimpleObject` (`cjs/react-server-dom-webpack-client.browser.development.js`, lines
  135-775) and server `decodeReply` / `createTemporaryReference` (`...server.browser.development.js`).
- React error #499: https://react.dev/errors/499
- Next.js `fetchServerAction` and `omitUnusedArgs`:
  https://github.com/vercel/next.js/blob/canary/packages/next/src/client/components/router-reducer/reducers/server-action-reducer.ts,
  https://github.com/vercel/next.js/blob/canary/packages/next/src/shared/lib/server-reference-info.ts
- React Router `createCallServer`: https://github.com/remix-run/react-router/blob/main/packages/react-router/lib/rsc/browser.tsx
- Parcel `fetchRSC`: https://github.com/parcel-bundler/parcel/blob/v2/packages/utils/rsc/src/client.tsx
- Waku client runtime: https://github.com/wakujs/waku/blob/main/packages/waku/src/minimal/client-runtime.tsx
- Vite RSC starter: https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-rsc/examples/starter/src/framework/entry.browser.tsx
- Probe and outputs: `memo/platform-researcher/probes/03-server-function-action-details.mjs`,
  `...dev-output.txt`, `...prod-output.txt`

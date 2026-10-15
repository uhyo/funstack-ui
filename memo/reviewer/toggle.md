# Reviewer memo: Toggle (#10), 2026-10-15

Reviewed commits ed6a1e2..f67f405 on master against `design/conventions.md`,
`design/components/toggle.md`, and the research docs. All of `pnpm test:run` (50 tests, run three
times uncached), `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` pass. `dist`
keeps `"use client"` on `toggle.mjs`, `use-controllable-action.mjs`, `use-render.mjs`; index files
and `action-details.mjs` are directive-free; exports map is the string form and the example
package typechecks against it.

Verdict: **acceptable with minor fixes** (one public-type fix, one example bug, one design-text
correction that needs the architect).

## Probes run (scratch tests, deleted afterwards)

1. **Overlapping actions, older one rejects** (both orders, uncontrolled and controlled
   update-on-success, root created with `onCaughtError`/`onUncaughtError`/`onRecoverableError`,
   `reportError` stub, `window` error listener, `unhandledRejection` listener, console.error
   unmocked): the older action's rejection is *swallowed by React*. Nothing fires. Only the newest
   dispatch's rejection reaches the boundary. Cause: `useTransition` stores one thenable per
   `startTransition` call as a state update; `basicStateReducer` keeps the last one; only the final
   state is unwrapped by `useThenable` in `updateTransition`. Earlier thenables are never read.
   Design 6.5 / conventions 2.4 claim unconditional propagation; that is wrong for overlaps.
2. **MutationObserver coalescing**: two `flushSync` commits in one task produce one MO callback.
   In the real row-17 scenario there are 3 layout-effect commits (mount, click, resolve) and 2 MO
   snapshots, so nothing is hidden today, but the test cannot detect an intermediate commit that
   lands in the same act flush as the final one. A `useLayoutEffect` recorder rendered via the
   `children` function sees every commit.
3. **Types**: `pressedChangeAction={(next) => save(next)}` with `save: () => Promise<Response>`
   is a type error (`Action` returns `void | Promise<void>`; the void-return special case does not
   apply to unions). `async (next) => save(next)` also errors. `aria-pressed="mixed"` *compiles*
   in JSX because TS skips excess-property checks for hyphenated attribute names; the `Omit` only
   bites for object literals. Runtime still wins (library spreads after `rest`). `commandfor` is a
   type error (no platform augmentation file yet; design section 3 says it is typed).
4. **Proxy**: `in` true, `hasOwn` false, descriptor undefined, keys/spread/JSON see only fields,
   prototype is `Object.prototype`, `structuredClone` throws `DataCloneError`. A *frozen* target
   does **not** break the `has` trap (the spec invariant only constrains `has` returning false and
   `getOwnPropertyDescriptor`/`ownKeys`); research doc section 6 and conventions 2.2 overstate
   this. No `set`/`defineProperty` trap: `details.event = x` creates an own enumerable `event`.
5. **mergeProps**: `aria-describedby` from Toggle props overrides the render element's instead of
   token-merging (conventions 1.2 carve-out not implemented); any `aria-*`/`data-*` pass-through
   prop from the Toggle beats the element's, not only library-controlled state.
6. **StrictMode**: dev warnings fire once; dispatch works.

# Developer memo: Toggle (#10), 2026-10-15

Implementation of `design/components/toggle.md` plus the shared internals it needs.

## What landed

- `packages/ui/src/internal/`
  - `types.ts`: `Action`, `ActionDetails`, `ChangeAction`, `StateValue`, `RenderProp` (re-exported
    from the root entry as public types).
  - `use-controllable-action.ts` ("use client"): committed / optimistic (reducer form) / own
    `useTransition`, post-await write of uncontrolled state guarded by a latest-dispatch counter,
    dev warnings (both props set; mode switch) in an effect.
  - `use-render.tsx` ("use client"): resolves `render` + function-form `className`/`style`/
    `children`, merges refs (memoised callback ref returning a cleanup).
  - `merge-props.ts`: element-form merge rules from conventions 1.2.
  - `data-attr.ts`, `transition-types.ts`: tiny helpers so the presence form and the
    `fsui-<component>[-<change>]` naming are spelled out once.
- `packages/ui/src/toggle/`: `Toggle`, tests for every row of design section 11.
- `packages/ui/src/__tests__/helpers.tsx`: `deferred`, `createSuspender`, `ErrorCatcher`,
  `renderBoth`, `expectPending`/`expectNotPending`, `setupUser`.
- `packages/ui/src/__tests__/directives.test.ts`: reads `dist/` to assert "use client" placement.
  `turbo.json` now has `test:run` depend on the package's own `build` so `dist` exists.
- tsdown: `unbundle: true`, `exports: true` (rewrites `package.json#exports` on build; the
  generated map is the string form, TS picks up the adjacent `.d.mts`), `checks.moduleLevelDirective:
  false` because rolldown warns about the directive even though unbundle preserves it.

## Decisions / gotchas

- Hook option shape: `controlled`, `defaultValue` (the `defaultX` prop verbatim, may be
  `undefined`), `initialValue` (fallback), `action`, `transitionTypes(next, prev) => string[]`,
  `warn: { component, prop }`. Keeping `defaultValue` verbatim is what lets the hook own the
  "both set" warning.
- `useRender` `props` type is `Omit<Props, className|style|children> & DataAttributes` because
  `data-*` keys are legal in JSX but not in `ButtonHTMLAttributes` object literals.
- Dev warnings live in `useEffect`, not render: oxlint's `react(refs)` rule flags reading refs in
  render. Behaviour is the same (once per instance).
- `process.env.NODE_ENV` is left in the library output. Vite replaces it in linked workspace
  packages in dev (verified: `const isDev = "development" !== "production"` in the served module)
  and in build.
- `@testing-library/user-event`: `import { userEvent }` (named); the default import does not
  typecheck under `nodenext`.
- `createSuspender` marks the promise `status: "fulfilled"` on `resolve()` so a pre-resolved key
  renders synchronously through `use()` (no initial fallback flash in tests).
- Overlap tests are uncontrolled-only on purpose: with the "update on success" controlled harness,
  the *parent's* write lands in completion order; latest-wins is a library guarantee only for
  uncontrolled state (conventions 2.5).

## Observed React 19.3.1 behaviour (all asserted in toggle.test.tsx)

- Overlap: both resolution orders end in the latest dispatched value; `data-pending` stays until
  all in-flight actions settle.
- Row 13: a consumer's `startTransition(setCommitted)` after the await, rendering suspending
  content inside a boundary that also wraps the Toggle, keeps the old content and the Toggle shows
  `data-pending` until the suspender resolves. No fallback flash.
- Row 17: MutationObserver sees only `aria-pressed="true"` commits (`pending` true then false).

## Not done / open

- `pnpm format:check` is red at the root because `design/*.md` (already at HEAD) and another
  agent's worktree under `.claude/worktrees/` are unformatted. Not my files; `design/` is not in
  oxfmt `ignorePatterns` while `docs/` and `memo/` are. Reported to the lead.
- Server Functions as actions (#17): the design landed (commit bc89308) while the Toggle was being
  built, so `internal/action-details.ts` (`createActionDetails`) was added and Toggle uses it;
  test row 21 covers the virtual `event`. The file carries no `"use client"` (conventions 7.1:
  no client-only API; a directive-free file is importable from anywhere), although the sketch in
  conventions 2.2 shows one. `expect.objectContaining({ event })` does not see a Proxy-served
  property; tests read `details.event` directly.

## Review fixes (2026-10-16, from `memo/reviewer/toggle.md`)

- `Action` returns `unknown` (conventions 2.2). `internal/types.test.ts` holds the `expectTypeOf`
  checks; `toggle.test.tsx` row 8 also renders a `(next) => save(next)` action returning
  `Promise<{ ok }>` and a sync action returning a number.
- **Superseded rejections** (conventions 2.4, 3.4): the hook wraps the `await` in try/catch. Latest
  dispatch rethrows (React's path); otherwise the first error is stored in `useState` and thrown
  from render; later ones go to `reportError` (fallback `console.error`); after unmount they are
  ignored (a `mounted` ref set in an effect). Tests: rows 12a/12b in both modes, a three-click
  burst (first error to the boundary, second to `reportError`, deterministic because the two
  catches run before React's microtask flush), and an unmount smoke test.
  - **Gotcha found while implementing**: the `throw` must come *before* `useTransition()` in the
    hook. When a render throws, React retries with `root.pendingLanes` (all of them), and in that
    retry `useTransition` unwraps the still-pending action thenable and suspends
    (`SuspendedOnAction`), so the boundary commit is held until the newer action settles. With the
    throw first, the retry never reaches `useTransition` and the boundary commits at once. The
    same holding happens to React's own latest-dispatch rejection when *another* component has a
    pending action; nothing to do about that in the library.
- **`mergeProps`** now takes three layers `(partProps, elementProps, libraryProps)` and
  `useRender` gained a `libraryProps` option. Toggle puts `...rest`, `type`, `disabled` in `props`
  (element wins, including `type`, per design section 3) and `aria-pressed`, `data-*` state and
  `onClick` in `libraryProps`. Handlers run element, part, library. The four ARIA id-list
  attributes are token-merged at every layer, element tokens first, deduped.
- **`createActionDetails`** has `set`/`defineProperty` traps for `event`: dev throws `TypeError`;
  prod `set` returns `true` (silently ignored; returning `false` would throw in strict-mode code),
  prod `defineProperty` returns `false` (`Object.defineProperty` throws natively,
  `Reflect.defineProperty` returns `false`; returning `true` for a non-configurable descriptor
  would violate a Proxy invariant anyway). `isDev()` is read per call so the prod branch is
  testable with `vi.stubEnv`.
- Row 17 uses a `useLayoutEffect` recorder rendered through `children`; it reads the button via
  its own span's `closest("button")` because a child's layout effect runs before the parent's
  `ref` is attached in the same commit.
- Rows 1/2 use fresh renders instead of rerendering across modes (no mode-switch warning in
  stderr). The unmount-while-pending test is named as a smoke test.
- Example veto demo uses a `useRef` call counter so every second save really fails.

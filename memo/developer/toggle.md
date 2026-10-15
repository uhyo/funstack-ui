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
- Server Functions as actions: nothing special done (#17).

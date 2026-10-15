# Developer memo: scaffold (2026-10-15)

- Monorepo mirrors ~/repos/funstack-router: pnpm + Turbo, oxlint, oxfmt, vitest (jsdom), tsdown.
- oxfmt formats markdown too, so `docs/`, `memo/`, `.claude/agents/` are in `ignorePatterns` to avoid
  rewriting prose other agents own.
- `packages/ui` uses `moduleResolution: nodenext`; relative imports need `.js` extensions, including in
  test files.
- `packageManager` is pinned to the locally installed pnpm (10.30.1), same major as the router repo.

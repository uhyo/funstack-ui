# Review: dev/219 (two copies under Vite RSC dev, duplicate-copy warning)

Reviewed 6b7af5b2 on origin/dev/219. Verdict: **acceptable with minor fixes** (one merge conflict
to resolve before landing).

Verified: `pnpm build`; full jsdom suite (136 files, 6148 tests) passes with zero
"parts from two copies" lines in the output, so this repo's module-sharing (`isolate: false`) and
isolated files produce no false warnings. A rolldown bundle of `src/index.ts` with
`NODE_ENV=production`, minified, contains none of `mounted-copies`, `Symbol.for`, the message, or
the registry: `useCopyCheck` folds to `noop`, and `registerMountedCopy`, the key and the token are
tree-shaken. `production-bundle.test.ts` passes and covers the message (`if (isDev && ...)`).

## Findings

1. **Medium: skill rule number clash.** Master has rule 19 from #221 (popups after their Trigger,
   not in `<p>`). The branch adds another 19 at the same place; a trial merge conflicts in
   `packages/ui/skills/funstack-ui-knowledge/SKILL.md` (and `design/CHANGELOG.md`). Renumber the
   Vite rule to 20 when rebasing; check nothing cites "rule 19" for the Vite rule.
2. **Low: the message prefix breaks conventions 7.x.** The rule says a message starts with the
   public part or function name; `@funstack/ui:` fits neither (no single part warns). It is the
   right prefix, but state the exception in 9.5 (or 7.x) so the rule stays true.
3. **Low: legitimate two-copy pages warn with no opt-out.** Two separately bundled apps on one
   page (micro-frontends, an embedded widget) never nest, yet warn. Dev-only and once per page,
   so acceptable; the message's "check that only one version is installed" is misleading there.
   Consider "if parts of the two copies are nested ..." wording.
4. **Low: consumer tests.** The library is externalized by vitest (Node's ESM cache), so
   `vi.resetModules` does not reload it; only a consumer who inlines it, resets modules and leaks
   a mounted tree (no auto cleanup with `globals: false`) can see a false warning. Fine as is.
5. **Note: an alternative not in the rejected list.** A `react-server` export condition per
   subpath whose server entry builds the namespace from a `"use client"` bare-specifier entry
   (`@funstack/ui/navigation-menu/client`) would let plugin-rsc proxy by specifier with ~40
   entries, not 185, and those can be put in `optimizeDeps.include`. It changes the exports map
   for every bundler and needs the directive-free parts handled; not a blocker, but worth listing
   in the CHANGELOG's "considered" or a follow-up issue. The upstream fix (FUNSTACK Static's
   `findClientPackages` ignoring `exclude`) remains the right primary fix.
6. **Note: upstream reports live only in the memo.** Per the agent rules, record them in a GitHub
   issue in this repo (or a comment on #219) so a human sees them.

Design points checked and fine: `Symbol.for` key and count-per-mounted-part design (server
render, StrictMode double effects, same-commit swap, unmount ordering all correct; passive
unmounts run before mounts in one commit); detection-only global state does not conflict with any
convention; `useEffect` only, no server cost (hook is a no-op call during SSR, never runs in the
`rsc` graph). Docs root-entry caveat matches the memo's evidence (FUNSTACK Static's include,
`tryOptimizedResolve`) and is correctly scoped to FUNSTACK Static.

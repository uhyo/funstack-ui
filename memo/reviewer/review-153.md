# Review: #153 (branch `tidy/153`, af689b4 + 026876e)

Verdict: **mergeable with one minor docs fix** (finding 1). No code regressions found.

## Checks run

- jsdom, branch worktree: `src/accordion src/checkbox-group src/internal`: 24 files, 707 tests pass.
  `format:check`, `lint` (no new warnings), `typecheck` pass.
- Mutation checks (each reverted after the run):
  - Accordion mount dispatch `whole: false`: 2 accordion tests fail (incl. the new one).
  - CheckboxGroup `{ whole: false }`: 4 reset tests fail (#150/#151).
  - Accordion `exclusive` read live: the new warning test fails.
  - `useControllableAction` ignores `whole` in the optimistic step only: both new hook tests fail;
    in the replay only: 7 tests fail (hook, Accordion, CheckboxGroup).
  - `useNativeGroupReconciliation` path swaps: equal-reset path "mount" -> 5 fail; late-member
    "reset" -> 2 fail; Root mount "reset" -> 1 fails.
  So the tests would fail without the change, on every path.

## Path audit

All four `onPlatformChange` call sites in use-native-group-reconciliation.ts pass the right path:
Root mount "mount", late member "mount", reset with `dispatchEqualReset` "reset", reset via
`reconcile` "reset". CheckboxGroup `dispatchPatch` callers: Item/Parent toggles default
`reset = false`; only `onPlatformChange` passes `path === "reset"`. `latestIsReset` uses the same
flag. Accordion: only `reconcileOnMount` passes `whole: true`; find-in-page reveal and activation
stay patches. Behaviour equals the old event-based inference on every existing path.

## Findings

1. **Minor (docs accuracy): design/conventions.md not updated.** 3.3 "Absolute dispatches"
   (around line 1201-1208) still says each reducer adopts `next` on `details.event` set / unset and
   "The two components use opposite tests on `details.event` on purpose". 3.4's reducer rule
   (around line 1330, "except for a dispatch it documents as absolute") also implies the reducer
   itself sees the absolute dispatch. After #153 the reducer never sees it; the dispatch carries
   `{ whole: true }`. conventions.md is the cross-component spec, so it should state the `whole`
   option (and that the mount/reset distinction comes from `NativeGroupPath`).
2. **Nit:** accordion-root.tsx:286 comment line is 118 chars (oxfmt does not reflow comments;
   the rest of the file stays near 100). accordion.md around line 465 has an unwrapped line too.
3. **Nit (tests):** the `exclusive` warning test covers uncontrolled library mode only; the JS-free
   `name` now also follows the mounted value (documented), untested. Not blocking.

## Conformance

- Matches ToggleGroup's `mountExclusive` pattern and warning wording; docs props table updated.
- `DispatchOptions` stays internal; public details types unchanged; CheckboxGroup consumer guidance
  (`details.event?.type === "reset"`) remains correct.

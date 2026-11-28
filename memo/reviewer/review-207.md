# Review of dev/207: `details.reject()` (#207)

Branch `origin/dev/207`, against conventions 2.4.1 (and decisions row 2, 2.2, 2.4), toast.md,
alert-dialog.md and the two #207 CHANGELOG entries.

Verdict: **acceptable with minor fixes.** No blocking finding.

Checks run in a worktree: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`,
jsdom (133 files, 6019 passed) and the Chromium browser project (46 files, 844 passed).

## Semantics (verified by reading)

- `callAction` reads `reject` once, at the synchronous return or when the thenable resolves; a
  throw after `reject()` propagates unchanged (sync and async paths); a second call is a no-op;
  a late call warns once per dispatch with the part prefix (9.5).
- Both hooks take the sentinel in their existing `catch` before the rethrow / `reportDropped`
  branch, so latest, superseded, unmounted and `<Activity>`-hidden all behave as 2.4.1 items 5-6.
  `useControllableAction` leaves `entry.resolved` false, so set-valued replay drops the change.
  `useActionTrigger` with `"run"`: an older run's sentinel only decrements `inFlight`; the
  latest run's `resolvedThen` still runs. Correct.
- Nested wrappers (Menu.CheckboxItem / RadioGroup, Combobox `runValueAction`, `useStepCommit`
  commit) attach a second `reject` to the same object and rethrow the sentinel to the hook:
  close skipped, Combobox text rolled back, `"dismiss"` revert step taken. Same as a rejection.
- Every dispatch builds its own details object, so replacing the slot cannot cross dispatches.
  No `on*` handler receives an action's details object (overlay `notifyClosed`, OTPField
  `onValueChange`, Combobox text handlers and Toast `onClose` each build a fresh one), so
  item 8 holds at run time as well as in types.
- The sentinel never leaves the library: the hooks are its only terminal catches, and
  `isHandledRejection` is not exported.
- Serialisation: `reject` is served by the `get`/`has` traps only, so it is not an own key,
  not in a spread and not in `JSON.stringify` (tested); writes refused like `event`.
- Types: `ChangeAction` intersects `Rejectable`; pure triggers and `completeAction` use
  `X & Rejectable`; named details types do not. `action-naming.test.ts` guards both directions
  with a self-test. A Server Function typed `(d: X) => …` stays assignable (contravariance).

## Findings

1. **Minor, docs.** `packages/docs/src/pages/MenuPage.tsx:389`: the `action` row of the props
   table still says only "A rejection keeps the menu open and reaches the nearest Error
   Boundary above the item"; the prose above it was updated, the table was not. Same gap in
   the Close-part rows of DrawerPage (`DrawerPage.tsx:329` prose names
   `DrawerCloseActionDetails` without `& Rejectable`). CLAUDE.md asks the props tables to
   follow the declarations.
2. **Minor, test naming.** `packages/ui/src/toast/toast.test.tsx:938`, `:1476`, `:1682` still
   say "the boundary above the Viewport". The assertions are still true (the harness puts the
   boundary there), but these are the phrases the amendment calls wrong; rename to "a boundary
   around the list" so the grep in the task stays clean and the tests do not read as advice.
   (`RoadmapPage.tsx:298` is history; toast.md 3.5 and conventions 2335 are about Suspense,
   correct as is.)
3. **Nit, tests.** The shared suites cast `(details as D & Rejectable).reject()` because the
   fixtures' action props are typed with the bare details. Harmless, but typing the fixture
   props as `D & Rejectable` would make the suites exercise the public type too.
4. **Nit, docs.** `ActionPropsPage` says of the Checkbox example "the message appears next to
   it"; `CheckboxReject.tsx` renders one message below the list.
5. **Nit, timing.** `callAction` adds one microtask (`Promise.resolve(result).then(outcome)`)
   between the action's promise resolving and the hook seeing it, and a `reject()` made in that
   microtask still counts. Not observable in practice; no change needed, noted only.

## Deviations reported by the developer

- No second builder (slot filled by `attachReject`): accepted; identity is required by Menu's
  `after` map and Combobox's `dispatchMeta`. The plain-object copy path is reachable only from
  tests (every production dispatch passes a `createActionDetails` object).
- No Tooltip / Select rows: confirmed, neither declares `openChangeAction`.
- All jsdom: accepted; the native `checked` / `value` rollback is observable there.

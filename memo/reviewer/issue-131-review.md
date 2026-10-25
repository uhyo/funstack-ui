# Review: #131 (wave 18) — branch origin/refactor/131-controls (63db1dd)

Commits: 0b443c2 (S8 useValueSet), 2c1de18 (T2 commit-action suite), 63db1dd (memo).
Verdict: **merge**. Nothing blocks; findings 1-3 are cheap memo/naming fixes worth folding in.

## What I checked

- S8: `internal/use-value-set.ts` vs the five removed memos. Same key (`JSON.stringify`), same
  `toSet(JSON.parse(key))`, `undefined` stays `undefined`, `null` -> `EMPTY_SET`. Behaviour of
  checkbox-group.md 5.1 (#108) unchanged. API `(string | readonly string[] | null | undefined) =>
  ValueSet | undefined` is sound for all three callers.
- New ToggleGroup row (toggle-group.test.tsx "controlled: an inline array with the same contents
  does not re-render Items"): counts Root renders (+1) and Item renders (+0); kills the
  identity-keyed mutant, which had no ToggleGroup killer before.
- T2: every removed row in slider.test.tsx and number-field.test.tsx compared with its suite row
  (git diff 6d70a91..branch). No assertion lost; each suite row is a superset (expectShown checks
  every mirror, plus no-"dismiss" on superseded rows, source/event on platform rows, "not at all
  when equal" for NumberField, React automatic reset in three modes for Slider, etc.).
- Gesture mapping: Slider keeps key presses (input+change) and the Track pointer for the
  pointer rows. NumberField keeps typed+blur for rejection/rollback, ArrowUp for
  overlap/superseded/suspending, ArrowUp-then-typed for "latest wins", Increment press for async
  commit/retry/post-await/no-snap. Exceptions in finding 2.
- isolate:false: drivers hold no mutable module state; `valueSetter` is read from the shared
  window's prototype (same object for every file of the worker); `mockTrack` spies are restored
  by the setup file's `vi.restoreAllMocks`. No leak.
- Baseline on the branch: 6 files, 695 tests pass (slider, number-field, toggle-group,
  checkbox-group, accordion, context-stability).

## Own mutation spot-checks (scratch worktree, 12 mutants)

| Mutant | Result |
|---|---|
| A useValueSet keyed on array identity | killed (TG new row, CBG #108 row, 3 Accordion context-stability rows) |
| B Slider platform path without the step | killed (22) |
| C Thumb never data-pending | killed (5) |
| D Slider dismiss also for a superseded commit (S2) | killed (2, the new no-dismiss asserts) |
| E NumberField dismiss in controlled mode | killed (3) |
| F Slider pending ignores stepPending | killed (4) |
| G NumberField pending ignores the commit | killed (7) |
| H NumberField held ignores stepPending | killed (no-snap row) |
| I Slider reset target = current value, not mount value | killed (9) |
| J NumberField button never data-pending | killed (6) |
| K Slider held ignores commitState.pending (= S5) | **survives** (finding 1) |
| L Slider held ignores stepPending | killed (no-snap row) |

S6/N7 (a channel without the shared capture): the reasoning holds. `useControllableAction` /
`useActionTrigger` create their own capture before their own `useTransition` when none is
passed; Slider calls `useControllableAction` first and NumberField `useActionTrigger` first, so
the private capture still runs before both transitions. Equivalent, but only because of the
current hook order (the comment "One capture for both channels" is what protects it).

## Findings

1. **Low — S5/N5 are not strictly equivalent.** slider-root.tsx:310 / number-field-root.tsx:345.
   The memo says "the optimistic value equals `live` while a commit pends". It does not in the
   rejection window: `runCommit` runs `stepTo(committed, null, "dismiss")` (setLive(committed),
   no stepHeld) while the commit transition is still pending, before the throw reaches the
   boundary. Probe (uncontrolled, no valueChangeAction, commit 40 -> 70 rejected, observer on the
   Thumb's style): original records `["40%"]` (one committed revert frame before the boundary
   replaces the control); mutant K records `["70%"]` (no revert frame). With a valueChangeAction
   both record `["40%"]` (stepPending holds). User-visible end state is identical (the boundary
   replaces the control), so not worth a row; correct the memo to "equivalent except for the
   transient pre-boundary revert frame".

2. **Low — memo claim "each NumberField row keeps its original gesture kind" is not quite true.**
   drivers/number-field.tsx:238-248 maps gesture 0 to an Increment press, so rows that used
   ArrowUp now press Increment: form.reset(), reset button + draft, React automatic reset,
   refusing controlled parent. "an async valueChangeAction is awaited in the step transition"
   moved from an adopting ArrowUp step to `pointerGesture` (Increment pointerdown) in three modes.
   Mount reconciliation now writes grouped text ("1,001") instead of "3". No coverage lost (the
   keyboard step+commit has its own "keyboard" rows; grouped parsing is arguably stronger), but
   fix the memo sentence.

3. **Low — suite describe title collides with the component file's own block.**
   commit-action-suite.tsx:233 `describe(driver.name, ...)` yields a second top-level "Slider" /
   "NumberField" block, with sub-blocks named like the file's own ("steps run in transitions",
   "overlap (uncontrolled)", "mount reconciliation (adopt)", ...). Reports and `-t` filters mix
   them. The existing suites use `${name}: value action conformance` (value-action-suite.tsx:258);
   use `${driver.name}: commit action conformance`.

4. **Nit — `AnyDriver` is a no-op alias.** commit-action-suite.tsx:87-93: it has the same
   parameters as `CommitActionDriver`, so "so the generic parameters stay internal" is not what
   it does. Drop it and use `CommitActionDriver<V, C, M, P>`.

5. **Nit — `sourceKey: string` plus a double cast.** commit-action-suite.tsx:80, 197-198. Typing
   it `keyof C & keyof M` would let the drivers' `"thumb"` / `"source"` be checked.

6. **Nit — Accordion `defaultValue` is the one set prop not going through the hook.**
   accordion-root.tsx:229 still builds `toSet(defaultValue)` each render. Harmless (read once by
   `useControllableAction`); `useValueSet(defaultValue)` would make the five call sites uniform.

7. **Nit — design docs.** accordion.md:889 and checkbox-group.md:491 describe the JSON-keyed
   `useMemo`; still accurate, could name `useValueSet` at the next internals sync (architect).

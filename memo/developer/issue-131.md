# Issue #131 (wave 18): commit-action suite (T2) and useValueSet (S8)

Branch `refactor/131-controls` (worktree under the session scratchpad), not merged.

## S8: `internal/use-value-set.ts`

- One hook `useValueSet(value)` replaces the five JSON-keyed `useMemo` sets: Accordion (value),
  ToggleGroup (value, defaultValue), CheckboxGroup (value, defaultValue). Accordion's
  `defaultValue` was never memoised (`toSet(defaultValue)` per render, read once by
  useControllableAction); left as it was.
- Mutation (memo keyed on the array identity instead of the contents): caught by the
  CheckboxGroup #108 row and three Accordion rows in context-stability.test.tsx, but **no
  ToggleGroup row**. Added "controlled: an inline array with the same contents does not re-render
  Items" to toggle-group.test.tsx (ToggleGroup's Root state object is not memoised, so the row
  counts Item renders, not state identity).

## T2: `__tests__/commit-action-suite.tsx`

- `describeCommitAction(driver)` + `CommitFixture` + `eachCommitMode`; drivers in
  `__tests__/drivers/slider.tsx` and `drivers/number-field.tsx`, which also hold the jsdom helpers
  both test files used (press, pointer, mockTrack, typeText, key, Parts …).
- Driver contract: gesture `i` dispatches `values[i + 1]` with `values[i]` shown; a row starting
  with gesture `i` renders `values[i]` as the initial value. NumberField: 1000 (grouped text
  "1,000") → press Increment → ArrowUp → ArrowUp → type "9" + blur, so each NumberField row keeps
  its original gesture kind (typed commit for rejection and rollback, keys for overlap and
  superseded). Slider: key presses 40 → 41 → 42 → 43 → 70.
- Union of assertions: every row asserts what either original asserted (expectShown covers
  `--slider-value`, Slider.Value text, the hidden input). Rows now running for both that only one
  had: "older rejects after newer resolved" (Slider), "disabled control follows a reset" and
  "latest defaultValue" (NumberField), React's automatic reset in all three modes (Slider had one),
  StrictMode "not at all when equal" (NumberField). Tests 276 → 290 for the two files.
- Lines: tests -1405 +100, suite and drivers +1059 (about 170 of them helpers moved out of the
  test files): net -246. Short of the audit's ~500 estimate; the suite keeps the full assertion
  union and three-mode coverage rather than golfing.

### Mutations (each against the new and the old test files)

27 mutants (S1-S13, N1-N14). The 20 the old files caught are all caught by suite rows (or the
new local row), usually by more rows than before. Survivors
of the old files:
- S2/N2 (dismiss revert for a superseded commit too): survived old and new; killed by adding a
  no-"dismiss" assertion to the two superseded-commit overlap rows.
- N14 (reset does not clear a draft when the value already is the target): survived; killed by a
  new NumberField row (reset with a draft at the target, then blur commits nothing).
- S5/N5 (`held` ignores the commit's pending): survive; equivalent in practice (the optimistic
  value equals `live` while a commit pends).
- S6 (Slider commit channel without the shared capture) / N7 (NumberField step channel without
  it): equivalent. The hook's own capture is created before both `useTransition`s when that
  channel's hook is called first (Slider calls useControllableAction first, NumberField
  useActionTrigger), which is all the shared capture is for. The other channel's mutant (S7, N6)
  is caught.

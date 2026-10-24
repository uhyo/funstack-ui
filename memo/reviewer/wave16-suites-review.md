# Review: wave16/suites (phase 3 suites, #106)

Branch head 360e46b (c124020 + the menu title commit), base master 3f65d32. Reviewed the whole
diff (value-action suite + drivers, native platform suite, hydrate/gate helpers, T7 rows, T13
trims). Mutations run in a private scratch copy (branch and master side by side); the worktree
was not modified.

## Verdict: merge (minor fixes optional, none blocking)

No coverage loss found. Every removed platform row maps to a suite row with equal or stronger
assertions (details JSON, event, DOM, committed, pending), and the removed hook rows are covered
by the suite in both modes. CI green on 69a15f5 (all three engines) and on 360e46b.

## Mutation comparison (master vs branch, failing rows)

Group hook / form reset (use-native-group-reconciliation.ts, use-form-reset.ts):
- no mount reconciliation: 54 / 50
- reset dispatched without its event: 22 / 30
- cancelled reset not honoured: 22 / 20
- reset reads readCurrent instead of readDefault: 1 / 1
- `equals` ignored: 85 / 91
- no late-member reconciliation: 13 / 13
- always dispatch (no base comparison): 214 / 222
- reset dispatched twice: 53 / 58
- mount reconciliation passes an event: branch 21 (all suite hydration rows of the 3 groups)
useNativeChecked:
- `group` guard removed from the mount report: 1 / 1 (the kept hook row; components never
  reach it, so the T13 trim was right to keep it, and its new control works)
- `group` guard removed from the reset: 1 / 1 (same)
- in-flight ignored at mount: branch 8 (hook row + Checkbox/Switch StrictMode rows)
- in-flight ignored at reset (use-native-checked.ts:153): 0 / 0 -> L3, pre-existing gap

The small decreases (54->50, 22->20) are the deleted hook-harness duplicates; every mutation is
still killed by several rows.

## T7 exactly-1 check
Justified: Button, Toolbar and ToggleGroup already asserted exactly 1 on master; the CheckboxGroup
row uses the same Root-wrapped late Item; CI run 40078582625 passed WebKit, Firefox, Chromium.

## Review ids
menu-context-trigger(.browser).test.tsx titles: fixed in 360e46b (9 titles). Comments still cite
"review M2/L6" (fine). Outside this branch, titles still carry ids: form.test.tsx:345, :662,
tooltip.test.tsx:932, number-field.test.tsx:831 (L4).

## Findings

L1. native-group-platform-suite.tsx:91 title "dispatches once under StrictMode, for several
pre-hydration changes": for RadioGroup and Select `setDomValue(values[2])` is one changed control
(a -> c), not several changes; only CheckboxGroup changes two boxes. Fix: title "dispatches once
under StrictMode" (or "... for a value two gestures away"), and keep the "two boxes" note in the
CheckboxGroup driver comment.

L2. Two gate idioms for late hydration: radio/checkbox/select use `hydrationGate()` (the memo
says 27 rows fail if `open()` does not mark the promise fulfilled), but
use-native-group-reconciliation.test.tsx:216 and checkable-input-suite.tsx:1213 still use a plain
`deferred()` as the client gate. Fix: use `hydrationGate()` there too, or say in `hydrationGate`'s
doc when a plain deferred is enough.

L3. Pre-existing gap (same on master): useNativeChecked's reset path ignoring
`latestInFlight` (use-native-checked.ts:153 -> `const base = checked`) fails no row. A Checkbox /
Switch row "form reset while an action is pending compares with the in-flight value" (like the
groups' two-synchronous-resets row) would close it. Not this branch's regression: record in #106
or a new issue.

L4. Review ids in titles outside the menu files (see above). Follow-up, not this branch.

N1. use-native-checked.test.tsx:257 "never reports with group: true" loops over [false, true]
with an if/else; an `it.each` (or two rows, control named) would read better. Nit.

N2. view-transition-mount.tsx:46-47 `unmount(); vt.restore();` are not in a `finally`: if the
mount poll fails, the startViewTransition spy leaks into the next row of the file. Pre-existing
pattern, now shared by more files. Nit.

## Abstraction
`describeNativeGroupPlatform` pays for itself (3 components x ~20 rows, one driver extension of 3
members). `hydrateFromServer` options (`mutate`, `client`, `inAct`, `flush`) each have users.
`ValueHarness` carrying `inForm` / `refusePlatform` / `forHydration` is a little platform-specific
for the value-action module but documented; acceptable.

# Wave 16, test conformance suites phase 3 (#106, tracker #100)

Branch `wave16/suites`. Audit: `memo/reviewer/refactor-audit-tests.md` (T2, T3, T13, leftovers of
T4/T6). Guard rail T20: jsdom titles from the JSON reporter, diffed per commit (script kept in a
private scratchpad: sorted `file > fullName` list).

Baseline (master 0578f90): jsdom 2923 tests, all pass.

## 1. `hydrateFromServer` (T3 leftover)

`__tests__/helpers.tsx` `hydrateFromServer(ui, { mutate?, client?, inAct?, flush? })`: renderToString
into a fresh container in `document.body`, `mutate` (may be async: accordion waits an immediate,
menu a task, the browser files a real `user.click`), hydrate (`inAct` renders inside an async `act`,
for trees that suspend), then `flush` (default `flushMicrotasks`, `null` for none, combobox
`flushTasks(2)`). If `mutate` throws, the container is removed (it is not rendered yet, so
`cleanup()` would leave it behind and later rows would see duplicate elements; found when an
experimental extra assertion failed and 10 later checkbox rows failed with it).

Replaced: the private `hydrate()` of use-native-checked, use-native-group-reconciliation (+
`hydrateLate`), slider, number-field, radio-group (+ 3 inline late-hydration copies),
checkbox-group (3 `hydrate` + `hydrateLate` + 4 inline), select (+ 2 inline -> local `hydrateLate`),
checkable-input-suite (+ 1 inline), combobox, accordion, checkbox (1 inline), menu (1 inline), and
the browser copies in radio-group.browser, checkbox-group.browser, checkable-input-browser-suite.
Pre-hydration assertions on the server HTML moved into `mutate` unchanged.
Not touched: dialog.test.tsx and popover.test.tsx (another developer owns them in parallel); their
two `hydrate()` copies can switch to `hydrateFromServer(ui, { mutate, flush: null })` later.
Titles: identical (2923 = 2923).

## 2. `sequencedDeferreds` (T2 helper)

`sequencedDeferreds(n)`: an array of `n` deferreds with `next()` (the n-th call gets `[n]`, throws
past the end) and a `calls` counter (button.test.tsx asserted `calls`). Replaced the
`[deferred(), …]; let calls = 0; ds[calls++]!.promise` idiom at 30 sites in 7 files.
Titles identical (2923).

## 3. Value-action suite (T2)

`__tests__/value-action-suite.tsx`: `describeValueAction(driver)` and
`describeValueTransitionTypes(driver)`, plus the exported `ValueHarness` (the "update on success"
harness, used by component rows that still need it) and `definedProps`. Drivers live in
`__tests__/drivers/<component>.tsx` because two test files use each one (the component file and its
`*-transition-types.test.tsx`; a test file cannot import another).

Driver contract: `values[0..3]` (initial, then the value gesture i dispatches), `gesture(user, i)`,
`expectShown(v)` (the optimistic DOM, as strong as each old row's DOM checks), `expectCommitted(v)`
(DOM that follows the committed value only: Tabs panel, `<details open>`), `pendingOn(i)` /
`pendingOff(i)`, `queryControl()` (gone once the boundary caught), `detailsFields(i)` (the
serialisable details; the suite asserts `Object.keys` and JSON against it), `eventType`, `props`
(names in the warnings), `commit` (how the parent commits; ToggleGroup patches), `readShown` /
`shown` (Profiler snapshots), `transitionTypes` (per gesture).

Transition types (T19): every value component gets a `*-transition-types.test.tsx` with
`vi.mock("react")` through `__tests__/transition-type-spy.ts` (`withTransitionTypeSpy`). The mock
stays in small files of its own, not in the big component files, so that T14 (no isolation) only
has to fence those files. So the suite asserts the types, but from a second entry point.

Rows of the suite (each in both modes unless noted): sync action; async action (optimistic +
pending, data-returning action, non-thenable return, unmount while pending); rejection (boundary,
sync throw, caught inside); overlapping (uncontrolled: both resolve orders, pending until all
settle); superseded rejection (after / while newer, first error kept + reportError, after unmount);
suspending content (harness suspender reading the committed value); post-await rule (controlled,
Profiler snapshots of every commit; and without startTransition); controlled veto; transition prop
(markup equal for a class and a type map; dispatch with each); details (virtual event; Server
Function shape); dev warnings (both props, uncontrolled -> controlled, none in normal use).

### Toggle (commit 3a)

Removed title (toggle.test.tsx, `Toggle …`) -> suite row (`Toggle: value action conformance …`):
- sync action (both) calls pressedChangeAction(next, { event }) and flips (row 6) -> sync action
  (both) dispatches (next, details) with the event and commits each gesture
- async action (both) shows optimistic state and data-pending until the action resolves (row 8) ->
  async action (both) shows the optimistic value and data-pending until the action resolves
  (`data-pressed` is in the driver's `expectShown`)
- async action (both) awaits an action that resolves with data (non-void return, row 8) -> same
  title without the row number; ignores a non-thenable return value (sync data, row 8) -> same;
  settles quietly when unmounted while pending (smoke test) -> same
- rejection (both) reaches the Error Boundary, reverts optimistic state, leaves committed state
  (row 9) -> rejection (both) reaches the Error Boundary and leaves the committed value (button
  gone = `queryControl()` null); treats a synchronous throw like a rejection (edge case) -> same;
  caught inside the action counts as success (row 10) -> caught inside the action counts as
  success; only a controlled parent reverts
- overlapping actions (uncontrolled) latest dispatch wins when resolved %s (row 11) -> the latest
  dispatch wins when resolved %s; stays pending until every in-flight action settles (row 12) ->
  same
- superseded rejection (both) rows 12a / 12b / reportError / after unmount -> same four suite rows
  (12a/12b assert the committed value of the newer dispatch, `false` here as before)
- suspending content (both) row 13 -> suspending content (both)
- post-await rule (row 17) aria-pressed and data-pending converge in one commit with
  startTransition -> post-await rule (controlled parent) the shown value and data-pending converge
  … (snapshots now from a Profiler around the control instead of a layout effect inside
  `children`; same per-commit reading. The old row asserted exactly one commit before the click;
  the suite asserts every pre-click commit shows the initial value, not pending)
- post-await rule (row 17) still ends in the right state without startTransition -> same
- controlled edge cases: snaps back when the parent never adopts the value (veto) -> controlled
  veto: snaps back …
- transition prop (row 18) renders the same markup with and without `transition` -> same (the map
  now lists every fsui-toggle type); still dispatches with a transition set -> still dispatches
  with a class / a type map as `transition` (two rows)
- details (row 21) both rows -> details: same two titles (keys now compared exactly, `[]`)
- dev warnings (row 19) three rows -> dev warnings: the same three (the first render of the
  uncontrolled->controlled row is still `<Toggle>` with neither prop; `implicitDefault`)
Kept in toggle.test.tsx: disabled never dispatches (row 7, now on `ValueHarness`), roles, keyboard,
function props, render prop, rebase while pending, refs.
New: toggle-transition-types.test.tsx (3 rows; Toggle had no type assertion before).
jsdom titles: 2923 -> 2927 (-35 +35 suite, +1 transition dispatch split, +3 types).

Mutations (toggle.tsx, reverted):
1. `data-pending` never set: 23 rows fail (16 suite rows).
2. press/release types swapped: the 3 transition-type rows fail.
3. A "sticky" aria-pressed that never reverts after a click: suite rows "caught inside
   (controlled)" and "controlled veto" fail.

### Tabs (commit 3b)

Suite changes made while mapping Tabs (they apply to every component): the sync row also compares
`Object.keys(details)`; the rejection row checks the committed DOM (`expectCommitted(values[0])`)
before the reject; "stays pending until every in-flight action settles" checks that nothing
committed while the older action is pending and the committed DOM after; the post-await row
checks the committed DOM mid-flight; the transition dispatch rows check the committed value; the
markup row normalises React's client `useId` values (`_r_<n>_`, which differ per root).

Removed title (tabs.test.tsx, `Tabs …`) -> suite row (`Tabs.Root: value action conformance …`):
- sync action (both) calls valueChangeAction(next, details) and swaps panels -> sync action (both)
  dispatches (next, details) … (reason, event, keys `["reason"]`, selection with tabindex and
  data-selected in `expectShown`, panel in `expectCommitted`, Root not pending, committed `b`)
- async action (both) pending on Root and the clicked Tab; old panel stays until resolve -> async
  action (both) shows the optimistic value and data-pending … (`pendingOn`: Root, tab B, Indicator;
  `pendingOff`: tabs A and C, the tabpanel; `expectCommitted(a)`: panel A mounted, B not)
- rejection (both) reaches the Error Boundary; committed value unchanged -> rejection (both)
  reaches the Error Boundary and leaves the committed value (panel A mounted before the reject)
- rejection (both) caught inside the action: resolves; uncontrolled commits, controlled reverts ->
  rejection (both) caught inside … (selection and panel text by mode)
- overlapping actions (uncontrolled) dispatch b then c, resolve b last -> overlapping actions
  (uncontrolled) stays pending until every in-flight action settles (resolves the newer first:
  C selected and pending, B not; Root pending; panel A still mounted; then panel c) and the latest
  dispatch wins (both orders)
- superseded rejection (both), the two rows -> superseded rejection (both) after / while the newer
  … (C selected after the newer resolved, boundary called once)
- post-await rule: a controlled parent updating in startTransition after its own await works end
  to end -> post-await rule (controlled parent) the shown value and data-pending converge …
  (B selected and pending with panel a mid-flight; B and panel b after)
- transition prop: Tab and Panel render with and without transition -> transition prop: renders
  the same markup … and still dispatches with a class / a type map (the driver puts `transition`
  on every Tab and Panel; the dispatch rows check the committed panel)
- tabs-transition-types: adds fsui-tabs and fsui-tabs-next for a later tab -> Tabs.Root:
  transition types gesture 0 / 1 (a->b, b->c: next); adds fsui-tabs and fsui-tabs-prev for an
  earlier tab -> gesture 2 (c->a: prev). The "no committed tab" row stays in that file.
Kept in tabs.test.tsx: disabled/selected no-ops, controlled veto with focus on the clicked tab,
cancelled intent (9.4), rapid arrows, the panel-suspending rows (keyed boundary), keepMounted,
Indicator, function props, render prop, focusgroup.
jsdom titles: 2927 -> 2953 (-17, +43: the suite adds dev-warning, details, overlap order, unmount,
non-thenable, sync throw, reportError and suspender rows Tabs did not have).

Mutations (reverted):
1. tabs-panel.tsx shows the optimistic selection instead of the committed one: 13 rows fail (8
   suite rows: async, rejection, overlap, suspending content, post-await).
2. tabs-root.tsx swaps next/prev: the 3 suite transition-type rows fail.
3. tabs-tab.tsx marks every tab pending while the Root is: 18 rows fail (suite `pendingOff`).

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

### ToggleGroup (commit 3c)

Suite changes: the committed and suspender text checks are exact (`textContent` equality;
jest-dom's `toHaveTextContent` is a substring match, too weak once values are lists: "bold" is in
"bold,italic"); `orderIndependentCommit` asserts the committed value after both overlap orders; the
sync row runs all three gestures (after mutation 3 below first slipped through the suite: only the
reportError row used gesture 2, without a DOM check).

Driver: multiple mode, gestures press Bold, press Italic, release Bold; parent commits by patching
with `added` / `removed` (the old harness's update); format = sorted, comma-joined.

Removed title (toggle-group.test.tsx, `ToggleGroup …`) -> suite row (`ToggleGroup.Root: value
action conformance …`):
- async action (row 3) (both) flips at once, pending on Root and Item, committed content unchanged
  until resolve -> async action (both) shows the optimistic value … (`pendingOn`: Root and the
  pressed Items; `pendingOff`: the others, Italic included; data-pressed also checked)
- rejection (row 4) (both) reaches the boundary above the Root; committed unchanged -> rejection
  (both) reaches the Error Boundary …; caught inside the action counts as success -> rejection
  (both) caught inside … (Root not pending, error text, Bold by mode)
- overlap (row 5) Bold then Italic resolved %s commits both -> overlapping actions (uncontrolled)
  the latest dispatch wins when resolved %s (calls `[["bold"], ["bold","italic"]]`, both pressed,
  Root not pending, committed `bold,italic` via `orderIndependentCommit`)
- superseded rejection (row 6) (both), two rows -> superseded rejection (both) after / while the
  newer … (committed `italic`, the newer's patch on `[]`, as before; boundary once)
- suspending content (row 7) (both) -> suspending content (both)
- post-await rule … converges (row 9) -> post-await rule (controlled parent) … (pressed and pending
  mid-flight, parent's value after)
- dev warnings (row 17) value and defaultValue together warn once -> dev warnings: warns once when
  `value` and `defaultValue` are both set (now exactly one console.error, matched)
- details.event is virtual (row 19) -> details: exposes `event` as a virtual, non-own property
  (keys `added`, `removed`; JSON `{ added: ["bold"], removed: [] }`)
- toggle-group-transition-types: press adds fsui-toggle-group and -press; release adds -release
  -> ToggleGroup.Root: transition types gesture 0 / 1 (press) and 2 (release). "an exclusive switch
  carries both" stays there.
Kept: value model rows (incl. exclusive), the same-Item second click, the controlled overlap /
re-base rows, function props, keyboard, roving tab stop, focusgroup, exclusive and duplicate
warnings.
jsdom titles: 2953 -> 2978 (-18, +43).

Mutations (reverted):
1. toggle-group-item.tsx: every Item pending while the Root is: 20 rows fail (18 suite rows).
2. toggle-group-root.tsx: press / release types swapped: all 4 type rows fail.
3. toggle-group-root.tsx: releasing a pressed Item dispatches an empty patch: before the sync-row
   change only the gesture-2 type row of the suite failed (+5 local rows); after it, the suite's
   sync rows (both modes) fail too.
### Accordion (commit 3d)

Suite changes: `label` (two drivers per component); `eventType(i)` per gesture (Tabs: in automatic
mode a click from one tab to another dispatches through `focusin`; the sync row now runs three
gestures); `detailsFields(i)` checked for every gesture of the sync row, keys in order (the old
Accordion row compared `["reason","item","open"]` in order; the others sorted, now stronger);
the overlap row checks the shown value and pending parts after the first gesture, the committed DOM
before any resolve and the call count after; the post-await snapshots also record the committed DOM
(`readCommitted`) and assert it never showed the new value while pending; the markup row asserts no
console.error.

Two drivers: multiple (open a, open b, close a) and exclusive (from "a": open b, open c, open a),
with the old harness's test ids; `pendingOn` lists Root plus Item and Trigger of every item whose
optimistic state differs from the committed one; `pendingOff` the other Items/Triggers and every
Panel; `expectShown` = `data-open` on Trigger and Item; `expectCommitted` = `details.open`, the
`open` attribute and the Panel's `open` state.

Removed title (accordion.test.tsx, `Accordion …`) -> suite row:

- sync action (both) click dispatches (next, { event, reason: 'activate', item, open }) and opens
  -> `Accordion.Root: …` sync action (both) (gestures 0 and 2 open and close "a": next, every
  details field, event type, open attribute, `.open`, data-open, Trigger/Root not pending, panel
  state, committed)
- sync action (both) multiple mode accumulates open items -> same suite row (a, then a+b, then b)
- async action (both) shows optimistic data-open and data-pending; details and Panel wait for the
  commit -> `Accordion.Root: …` async action (both)
- async action (both) exclusive: the closing and the opening item are both pending ->
  `Accordion.Root exclusive: …` async action (both) (from a, open b: a and b Item/Trigger pending,
  c not; data-open moved; the details element unchanged until resolve)
- async action (both) keeps working after unmounting while pending -> settles quietly when
  unmounted while pending (both drivers)
- rejection (both), two rows -> rejection rows of both drivers
- overlapping actions (uncontrolled, exclusive; walkthrough 9.3) latest dispatch wins when resolved
  B then C / C then B -> `Accordion.Root exclusive: …` overlapping actions the latest dispatch wins
  when resolved first then second / second then first (after b: a, b pending; after c: a, c
  pending and b not; a still open; finally only c open, Root idle, two calls)
- … (exclusive) stays pending until every in-flight action settles -> exclusive driver's row (from
  "a" instead of null)
- overlapping actions (uncontrolled, multiple) both opens survive when resolved %s -> multiple
  driver's "the latest dispatch wins when resolved %s" (both open after; the harness mirror is
  still not asserted: whole-set commits land in completion order)
- superseded rejection (both), two rows -> both drivers (committed `["a","b"]` for multiple)
- post-await rule `open` and data-pending converge in one commit with startTransition (exclusive,
  from null, MutationObserver on the item) -> post-await rows of both drivers (Profiler snapshots of
  data-open, data-pending and the `open` attributes; the `open` attribute never shows the new value
  while pending; the exclusive driver starts from "a")
- post-await rule still ends in the right state without startTransition -> both drivers
- controlled edge cases snaps back when the parent never adopts the value (veto) -> controlled veto
  rows of both drivers
- dev warnings warns once when `value` and `defaultValue` are both set -> both drivers
- transition prop (smoke) renders the same markup … in library mode (no console.error) / still
  dispatches with a transition set -> transition prop rows (the drivers put `transition` on Item,
  Trigger and Panel; no console.error asserted)
- details (virtual `event`) serialises to the plain fields only -> details rows of both drivers
  Kept: closing to null (exclusive), disabled and nested interactive content, the same-item second
  click, the lazily mounted panel content row, rebase, platform and hydration rows, mode-change and
  JS-free warnings, JS-free transition warnings.
  New: accordion-transition-types.test.tsx (6 rows; Accordion had no type assertion before).
  jsdom titles: 2978 -> 3034 (-30, +86).

Mutations (reverted):

1. accordion-item.tsx renders `open` from the optimistic state: 23 rows fail (21 suite rows).
2. accordion-root.tsx swaps expand / collapse: all 6 type rows fail.
3. accordion-item.tsx marks every Item pending while the Root is: 38 rows fail (36 suite rows).
### RadioGroup (commit 3e)

Suite change: the overlap row resolved in dispatch order ("first then second") now asserts the
committed value is the newer one for every driver (a whole-value parent commits in completion
order, which is dispatch order there); RadioGroup's "resolved in order, the latest still wins"
asserted exactly that.

Driver: radios a, b, c from "a"; gestures click b, c, a; `expectShown` = DOM `checked` and
`data-checked` lists; `pendingOn` = the fieldset and the optimistic radio, `pendingOff` the others;
`format` = `String` (the old harness's mirror).

Removed title (radio-group.test.tsx, `RadioGroup …`) -> suite row (`RadioGroup.Root: value action
conformance …`):

- sync action (both) calls valueChangeAction(next, details) with the native click -> sync action
  (both) (next, event type click, reason activate, checked and data-checked lists, no pending,
  committed)
- async action (both) shows the optimistic radio and data-pending on Root and that Item until
  resolve -> async action (both) (`dataPending()` = `["b"]` becomes pendingOn radio b + pendingOff a,
  c)
- rejection (both) reaches the Error Boundary and leaves committed state / caught inside the action
  counts as success -> rejection rows (both); the checked and data-checked lists by mode
- overlapping actions resolved in order, the latest still wins -> overlapping actions (uncontrolled)
  the latest dispatch wins when resolved first then second (checked c throughout, committed c)
- superseded rejection (both), two rows -> suite superseded rows (committed c)
- suspending content (both) keeps old content, no fallback, Root pending … -> suspending content
- details: exposes `event` …, can be passed straight to a Server-Function-shaped action -> details
  rows (JSON `{"reason":"activate"}`, keys exactly `["reason"]`)
- post-await rule checked and data-pending converge with startTransition after the await (layout
  effect in function children; DOM `checked` + fieldset pending) -> post-await rule (controlled
  parent) (Profiler; `readShown` = DOM `checked`, `pendingOn(0)[0]` = the fieldset)
- transition prop Item renders the same markup with and without `transition` -> transition prop
  markup row (also with a type map; `transition` on every Item); attaches the transition types
  without throwing (wiring smoke test) -> still dispatches with a class / a type map, and
  radio-group-transition-types.test.tsx now asserts the actual types
- dev warnings warns once when value and defaultValue are both set (anchored `^RadioGroup.Root:`)
  -> dev warnings both set (message matched, and exactly one warning starting with the name);
  warns once when switching from uncontrolled to controlled -> same (first render with neither prop)
  Kept: disabled / checked / cancelled-click no-ops, the controlled DOM rollback with focus, the
  arrow-key overlap, walkthrough 9.6, platform rows, preventDefault, forms, function props, render,
  9.9 value change while pending, unmatched value, "does not warn … nor without value or
  defaultValue" (the suite's no-warning row starts from defaultValue), Field rows.
  New: radio-group-transition-types.test.tsx (3 rows; RadioGroup had no type assertion before).
  jsdom titles: 3034 -> 3055 (-22, +43).

Mutations (reverted):

1. radio-group-item.tsx: every Item pending while the Root is: 23 rows fail (18 suite rows).
2. radio-group-root.tsx: types `fsui-radio` instead of `fsui-radio-group`: the 3 type rows fail.
3. radio-group-root.tsx: an extra serialisable details field: 4 suite rows fail (both sync rows and
   both details rows).
## Status (stopped early on the coordinator's request: usage limit)

Done and committed: 1 `hydrateFromServer`, 2 `sequencedDeferreds`, 3 value-action suite with
Toggle, Tabs, ToggleGroup, Accordion (multiple + exclusive) and RadioGroup migrated, each with its
transition-type file (T19 closed for those five; Toggle, Accordion and RadioGroup had none).
jsdom: 2923 -> 3055 tests, all pass (per-commit title diffs above).

Left (#106):

- T2: CheckboxGroup and Select are not on the suite yet (driver + row mapping + transition-types:
  CheckboxGroup already has a mocked file to switch to the shared spy; Select has none). Expect
  CheckboxGroup to need `commit` patching like ToggleGroup and `orderIndependentCommit`; Select's
  gesture is a `change` event (`eventType`), and its transition types are `fsui-select` only.
- T3: native-group platform suite (form reset, hydration reconciliation) for RadioGroup,
  CheckboxGroup, Select and the checkable inputs: not started.
- T13: trimming internal hook tests: not started (it depends on T3).
- dialog.test.tsx / popover.test.tsx still carry private `hydrate()` copies (out of scope here).
- Not run: the full gate after the RadioGroup commit (typecheck --noUnusedLocals and jsdom ran
  for every commit; lint/format were clean as of the ToggleGroup commit), shuffled jsdom runs,
  browser tests after step 1, CI.

## Resume attempt 2 (stopped again at the usage limit)

Resumed on the coordinator's go-ahead (order: CheckboxGroup, Select, T3, T13; leave the
dialog/popover hydrate copies; T7 only if origin/master has __tests__/view-transition-mount.tsx,
which it did not at 4506f37). Stopped while reading checkbox-group.test.tsx, before any edit:
nothing new is committed. Next step: CheckboxGroup driver (patch commit + orderIndependentCommit,
as ToggleGroup; harness initial ["a"]; switch checkbox-group-transition-types.test.tsx to the
shared spy).

## Resume attempt 3

### CheckboxGroup (commit 3f)

No suite change. Driver: Label, Parent "all" over a, b, c, Items a, b, c, from `["c"]`; gestures
click a (`next` `["a","c"]`: inserted in document order, stronger than appending), click the
mixed Parent (check all, `added: ["b"]`), click c (uncheck). `expectShown` = DOM `checked` and
`data-checked` lists plus the Parent's state (property and attributes agree: checked / mixed /
unchecked); `pendingOn(i)` = fieldset, Parent and the Items changed by gestures 0..i; `pendingOff`
the rest; `commit` = the design 2.6 patch, `orderIndependentCommit`; `format` = sorted join (the
old harness's mirror). #108 (controlled value identity) did not surface: every controlled row
passes, nothing adapted.

Removed title (checkbox-group.test.tsx, `CheckboxGroup …`) -> suite row
(`CheckboxGroup.Root: value action conformance …`):
- sync action (both) calls valueChangeAction(next, details) with a fresh array in document order
  -> sync action (both) dispatches … (next in document order, details JSON + keys per gesture,
  checked/data-checked, nothing pending, committed). Its "fresh array" assertion stays local as
  `sync action (both) passes a fresh \`next\` array on every dispatch` (the same two clicks from
  ["c"], `calls()` and `not.toBe`).
- async action (both) shows the optimistic box and data-pending on Root and the clicked Item only
  until resolve -> async action (both) shows the optimistic value … (pendingOn fieldset, Parent, a;
  pendingOff b, c: `dataPending()` exactly the clicked Item as before)
- rejection (both) reaches the Error Boundary and leaves committed state / caught inside the action
  counts as success -> the suite's rejection rows (checked and data-checked by mode, none pending)
- overlapping actions click A (slow) then B (fast) … final committed {a, b} (uncontrolled) -> the
  latest dispatch wins when resolved second then first (+ first then second) and stays pending
  until every in-flight action settles (both shown throughout, Root pending after the faster
  resolves, committed `a,b,c` by `orderIndependentCommit`). The second call's details
  (`added`) are checked by the sync row now, not the overlap row.
- superseded rejection (both), two rows -> suite rows (newer patch on ["c"]: `b,c`; the old
  `a,c` was the same patch on ["a"])
- suspending content (both) -> suspending content (both)
- details: both rows -> details rows (`{"reason":"activate","added":["a"],"removed":[]}`, keys
  exact; the old Server Function row used a Parent click: the Parent's details are in the sync
  row's gesture 1)
- post-await rule checked and data-pending converge with a functional startTransition -> post-await
  rule (controlled parent) (Profiler; readShown = checked list + Parent state; the harness's
  commit is the same functional patch)
- transition prop Item and Parent render the same markup … -> transition prop markup row (Label,
  Parent and Items, now also with a type map) + the two dispatch rows
- dev warnings both set / uncontrolled to controlled -> the suite's (message and exactly one
  `CheckboxGroup.Root` warning)
- checkbox-group-transition-types: check / uncheck / a Parent click that checks all -> gesture
  0 / 2 / 1; the file uses the shared spy now; "a reset that checks and unchecks adds both" stays.
Kept: rollback of the DOM (veto + focus), the controlled functional-update overlap, clicking A
twice, disabled / cancelled-click rows, value model, Parent rows, platform rows, forms, function
props, render, duplicate-value and no-warning rows, Field rows.
jsdom titles: 3055 -> 3076 (-25, +46).

Mutations (reverted):
1. checkbox-group-item.tsx: every Item pending while the Root is: 22 rows fail (18 suite rows).
2. checkbox-group-root.tsx: -check / -uncheck swapped: the 3 suite type rows + the reset row fail.
3. checkbox-group-parent.tsx: the Parent never pending: 21 rows fail (18 suite rows).

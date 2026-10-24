# Test suite audit for the refactoring wave (#100)

Reviewer audit, 2026-10-24, of `packages/ui/src` tests at commit 1208aa2. No source or test file was
changed. Experiments that needed edits were run in a scratch copy of `packages/ui` (node_modules
symlinked), never in the repository.

Goal reminder: tidier, smaller where redundant, faster; **no coverage drop, no weakened assertion**.

## 0. Baseline numbers

### jsdom project (53 files, 2865 tests, all pass)

| Run | Wall | Notes |
| --- | --- | --- |
| `vitest run --project jsdom` (3 runs) | 24.1 / 24.7 / 25.0 s (real 25-26 s) | user CPU 5m18s on 16 cores: the run is **CPU-bound**, not critical-path-bound |
| same, `--pool=threads` | 23.8 s | no gain |
| same, `--typecheck.enabled=false` | 23.1 s | within noise; typecheck matches no file (see T17) |
| scratch copy, `setupUser` with `delay: null` (T1) | **20.3 / 20.8 s** | 2865 pass, twice |
| scratch copy, `delay: null` + `--no-isolate` (T14) | **12.2-13.4 s** | 9 failures from the `vi.mock("react")` files; 1 order-dependent failure under shuffle (T15) |

Duration breakdown (vitest): tests ~51 %, environment (jsdom setup per file) ~34 %, setup ~10 %.

Per-file wall in the full run is inflated by contention (combobox 15.8 s, dialog 12.9 s,
checkbox-group 11.8 s, menu 11.7 s, popover 10.0 s, context-trigger 8.1 s, radio-group 7.2 s);
run alone, combobox + menu together take 5.6 s. Median per test: combobox 109 ms, menu 96 ms,
checkbox-group / radio-group 71 ms, dialog 63 ms, popover 60 ms; tooltip 28 ms (fake timers).
The slowest single tests (600-970 ms) are each file's **first** test (module warm-up), not real
outliers: e.g. toggle-group-transition-types 973 ms, checkbox-group-transition-types 857 ms,
number-field "renders the section 1 markup" 856 ms. 21 tests > 500 ms (14.1 s summed), 101 > 200 ms.

Conclusion: splitting big files does not speed the run up (CPU-bound, and each extra file pays a
jsdom environment); the levers are T1 (user-event delays) and T14 (isolation).

### browser project, Chromium only (`FUNSTACK_BROWSERS=chromium`, 25 files, 412 tests, 407 pass, 5 engine-gated skips)

Wall 20.7 s. Slowest files: dialog 15.3 s (38 tests), tooltip 14.0 s (35), popover 13.1 s (41),
menu-context-trigger 11.3 s (40), menu 7.0 s (31), combobox 6.5 s (23), number-field 5.0 s (17).
3 tests > 1 s (touch offset 1.27 s, the two tooltip skip-delay rows 1.2 s each).

Fixed waits written into browser files (per engine, and serial in Firefox, which runs files one at a
time): explicit `sleep(n)` totals menu-context-trigger 3740 ms (10 calls), dialog 1490 ms (11),
popover 1140 ms (9), menu 1040 ms (6), tooltip 650 ms (6), combobox 150, toast 120, select 20;
plus about 150 `flush()` calls that are `sleep(20)` inside `act` (combobox 31, popover 31,
context-trigger 47, menu 19, toast 16, select 11, dialog 6). Roughly 8 s of explicit sleeps and 3 s of
flush sleeps per engine.

## 1. Findings, ranked by value / risk

Legend: **Saves** = lines or seconds; **Risk** = could coverage silently drop.

### T1. `setupUser` without user-event's inter-action delay (speed, very low risk)
- Where: `src/__tests__/helpers.tsx:185-197` (`setupUser`), used by 771 calls in 27 files; one
  direct `userEvent.setup` in `tooltip/tooltip.test.tsx:129` (fake timers, leave it).
- Change: `userEvent.setup({ delay: null, ...options })`. Every interaction already runs inside one
  async `act()` (issue #36 fix), so the `setTimeout(0)` user-event inserts between key / pointer
  actions buys nothing but time.
- Measured: 25 s -> 20.3-20.8 s for the jsdom project, all 2865 pass (two runs); combobox + menu
  alone 5.6 s -> 3.9 s.
- Risk: a test that relied on a macrotask between two keys of one `user.keyboard("ab")` would now see
  both in one task. None failed; the async `toggle` of the popover shim is flushed by the tests'
  own `flush()`. Run the jsdom project 5x (and with `--sequence.shuffle`) before committing.
- Order: first. One-line change.

### T2. Shared value-action conformance suite (lines, medium risk)
- What repeats: the action-prop plumbing rows of the "value" components, each with its own harness
  doing the identical "update on success" dance (`committed` state, `catchErrors`, `boundary`
  `ErrorCatcher`, `<output data-testid="committed">`, Suspense + suspender):
  - sections `sync action`, `async action`, `rejection`, `overlapping actions`, `superseded
    rejection`, `suspending content`, `post-await rule`, `details` (virtual `event`, serialisation),
    `controlled edge cases`, `dev warnings` (value+defaultValue, uncontrolled->controlled),
    "unmount while pending".
  - Line ranges (approx.): toggle.test.tsx 200-563, 863-1115 (~520); accordion.test.tsx 465-913,
    1167-1223, 1638-1705, 1793-1811 (~590); radio-group.test.tsx 449-771, 1448-1486, 1719-1889
    (~460); checkbox-group.test.tsx 447-789, 2284-2320, 2573-2704 (~490); select.test.tsx 324-559,
    1440-1468, 1691-1986 (~340); tabs.test.tsx 665-965, 1469-1506 (~340); toggle-group.test.tsx
    282-561, 1040-1080 (~320). About 3000 lines in total.
  - Automated near-duplicate scan (normalised bodies, similarity >= 0.8 across files) found e.g.
    accordion/toggle 4 pairs, tabs/toggle-group 3, checkbox-group/toggle 3, accordion/radio 3,
    radio/toggle 3, and "superseded rejection" is written 8 times, "dispatches once under
    StrictMode" 5 times, "caught inside the action counts as success" 5 times, "exposes `event` as a
    virtual, non-own property" 5 times. The `ds[calls++]` deferred-sequencing idiom appears 26
    times in 6 files.
  - The only shared suite today is `checkable-input-suite.tsx` (Switch/Checkbox).
- Change: `src/__tests__/value-action-suite.tsx` exporting `describeValueAction(config)` with a
  driver: `{ name, renderHarness({ mode, initial, action, catchErrors, veto, boundary, suspender }),
  interact(n)` (the n-th user gesture that changes the value), `expectValue(v)` (DOM-level
  assertion: aria-pressed, `:checked`, aria-selected, `open`…), `pendingElement()`, `values: [a, b,
  c]` }. Provide a generic `useSuccessCommit()` hook + `<HarnessFrame>` so the harness boilerplate
  (~40-60 lines per file, 19 files define a `Harness`) also goes. Add `sequencedDeferreds(n)` to
  helpers.tsx for the `ds[calls++]` idiom. Component-specific rows (Accordion exclusive overlap,
  CheckboxGroup Parent, Tabs keepMounted, RadioGroup DOM rollback) stay in the component files.
  Generalise `renderBoth` to take the mode list so Slider / NumberField (three modes:
  uncontrolled / adopt / commit, `eachMode` at slider.test.tsx:241 and number-field.test.tsx:208)
  can use it too.
- Saves: estimated 1200-1800 lines net.
- Risk: medium. Rows assert component-specific DOM after each step (e.g. toggle's
  `aria-pressed` and "the button is replaced by the catcher", radio's `checkedValues()`); a
  driver that only checks `committed` would weaken them. Rule for the migration: every assertion
  in the removed rows must map to a driver call; keep per-component extras via an optional
  `afterRejection` / `afterSupersede` hook. Do it one component at a time and diff `vitest list`
  output (T20) before/after.
- Order: after T1, T3-T6 (it uses the shared helpers).

### T3. Shared native-group platform suite: form reset and hydration reconciliation (lines, medium risk)
- What repeats: RadioGroup, CheckboxGroup and Select (all on `useNativeGroupReconciliation`), and
  the single inputs in `checkable-input-suite.tsx`, each test the same platform rows: mount
  reconciliation (hydrated DOM value dispatched once with reason `platform` and no event; once
  under StrictMode; createRoot never dispatches), members that hydrate after the Root (late
  Suspense), `<button type=reset>` / `form.reset()` / cancelled reset / reset to the intended value
  / controlled parent refusing the reset gets the DOM re-synced / reset target by mode / React's
  automatic reset after a form action.
  - Ranges: radio-group.test.tsx 771-1405 (~630), checkbox-group.test.tsx 1552-2250 (~700),
    select.test.tsx 737-1405 (~670), plus `internal/use-native-group-reconciliation.test.tsx`
    (563 lines, which re-tests the same rows through a hand-made Harness).
  - Near-duplicate scan: checkbox-group/radio-group **25** pairs (the top pair of the whole repo,
    several at 0.98-0.99, e.g. "a cancelled reset dispatches nothing and leaves the DOM"),
    checkable-suite/radio 11, checkable-suite/checkbox-group 8, radio/select 6, checkable/select 5,
    checkbox-group/select 3.
  - 14 private copies of `hydrate(ui, mutate)` (renderToString -> mutate -> hydrate render ->
    flush): use-native-checked.test.tsx:45, use-native-group-reconciliation.test.tsx:175,
    dialog.test.tsx:1057, select.test.tsx:738, slider.test.tsx:1634, popover.test.tsx:1164,
    radio-group.test.tsx:772, combobox.test.tsx:1911, checkable-input-suite.tsx:1140,
    number-field.test.tsx:1392, checkbox-group.test.tsx:1157/1553/1648, accordion.test.tsx:1490.
- Change: `hydrateFromServer(ui, mutate?)` in helpers.tsx (first; zero risk, ~120 lines), then a
  `describeNativeGroupPlatform(config)` suite with driver `{ renderGroup, setDomValue(container, v),
  readDomValue(), defaultOf(mode), equalsNote }`. Then trim
  `use-native-group-reconciliation.test.tsx` to what only the hook can show (`equals` option,
  two groups in one form, a member added on the client) — keep any row the suite does not cover.
- Saves: ~120 (hydrate) + 800-1000 lines.
- Risk: medium (same mapping discipline as T2). CheckboxGroup's set-equality and Select's
  placeholder target are real differences; keep them as config, not as dropped rows.
- Order: after T2 (shares the harness pieces).

### T4. Shared jsdom flush / silence / spy helpers (lines, very low risk)
- `flush` is defined privately in **33 files** in four variants: `act(async () => {})` (13 files,
  e.g. checkbox.test.tsx:32, form.test.tsx:38, slider.test.tsx:112), two `setTimeout(0)` in `act`
  (combobox.test.tsx:191, dialog.test.tsx:171, menu.test.tsx:124, popover.test.tsx:164,
  menu-context-trigger.test.tsx:113, toolbar.test.tsx:26), one `setTimeout(0)`
  (use-popover-hooks.test.tsx:81, use-resolved-placement.test.tsx:26, field/form browser files),
  two microtasks (toast.test.tsx:89). Export `flushMicrotasks()` and `flushTasks(rounds = 1)` from
  helpers.tsx and import them; keep each file's current semantics (do not unify the variants
  blindly: the two-task flush is needed by the popover shim's queued `toggle`).
- `silenceErrors()` defined in 8 files; `vi.spyOn(console, "error").mockImplementation(() => {})`
  written inline 166 times in 35 files (accordion 20, checkbox-group 20, radio-group 16, slider
  13, toggle 10). Export `silenceErrors()`.
- `recordClicks()` x4 (button.test.tsx:47, dialog.test.tsx:1283, menu.test.tsx:946,
  popover.test.tsx:181; the button one returns a different shape), `watchShow()` x3
  (combobox.test.tsx:201, menu.test.tsx:138, menu-context-trigger.test.tsx:163; the recorded fields differ), `spyHide` x3 (menu.test.tsx:152, combobox.test.tsx:214, popover.test.tsx:173), the
  `MyButton` component-render fixture 7x (button.test.tsx:95/118/620, dialog.test.tsx:2816,
  menu.test.tsx:114, form.test.tsx:707, popover.test.tsx:1550). Move the identical ones to a
  `src/__tests__/overlay-helpers.tsx`.
- Saves: ~300-400 lines. Risk: very low (mechanical). Order: early, before T2/T3/T6.

### T5. `restoreMocks: true` in the jsdom project instead of 43 `afterEach(vi.restoreAllMocks)` (lines, low risk)
- 43 files carry `afterEach(() => { vi.restoreAllMocks(); })` (45 occurrences); some files forget it
  and restore by hand.
- Change: set `restoreMocks: true` in both projects of `vitest.config.ts`, delete the blocks.
- Nuance to check: the option restores **before each test**, while the file hook restores in
  `afterEach`, which (stack order) runs before the setup file's `cleanup()`. With the option, a
  `console.error` / `showPopover` spy stays active through `cleanup()` and `settleOpenDeferreds()`
  of the same test. That only silences more during unmount; no assertion reads spies after the
  test body. Files that combine fake timers and `restoreAllMocks` (5 files use
  `vi.useFakeTimers`) still need their own `useRealTimers`.
- Saves: ~150 lines. Order: early.

### T6. Shared browser helpers: flush, settle, page cleanup, styles, view-transition spy (lines + flakiness, low risk)
- `sleep` defined in 8 browser files, `flush` in 13 (variants: `sleep(20)` in act for combobox /
  dialog / menu / context-trigger / popover / select / toast; `setTimeout(0)` for field / form;
  `act(async () => {})` for checkbox-group / number-field / radio-group / slider and the checkable
  browser suite), `settle(check, timeout)` copied verbatim in combobox.browser.test.tsx:128,
  dialog.browser.test.tsx:41, field.browser.test.tsx:23.
- `addStyle` x6, `const cleanups` x7, and the afterEach that closes every open `<dialog>` and
  `[popover]` x9 browser files (menu, context-trigger, popover, dialog, combobox, select, toast,
  transition-boundary) + 4 jsdom files.
- View-transition plumbing: `type ActGlobal` in 10 files, the `startViewTransition` counting spy
  in 13 browser files, `outsideAct` (IS_REACT_ACT_ENVIRONMENT=false + await
  `__reactViewTransition.finished`) in button.browser.test.tsx:206 and re-implemented in
  menu/popover/dialog/combobox `beforeEach`.
- Change: `src/__tests__/browser-helpers.ts` with `sleep`, `flush`, `settle`, `addStyle` returning
  a disposer registered on an automatic afterEach, `closeOpenTopLayer()`, `spyViewTransitions()`
  (`{ calls, transitions }`), `outsideAct()`. Optionally a browser-only setup file that runs
  `closeOpenTopLayer()` after `cleanup()`.
- Saves: ~350 lines. Risk: low; keep each file's flush duration identical in the first pass.
- Order: early, with T4.

### T7. Shared browser row: "a mount in a transition starts no view transition without `transition`, one with `none`" (lines, low risk)
- Same `Late` component + spy + two cases in button.browser.test.tsx:240,
  toggle-group.browser.test.tsx:67-118, toolbar.browser.test.tsx:320-367,
  checkbox-group.browser.test.tsx:300-357, and similar in select.browser.test.tsx /
  toggle-group.test.tsx. Also "never starts a document view transition" in
  slider.browser.test.tsx:490, number-field.browser.test.tsx:628, progress.browser.test.tsx:143,
  toast.browser.test.tsx:378, select.browser.test.tsx:622.
- Change: `describeLateMountViewTransition({ name, renderLate(transition?) })` on top of T6's spy.
- Saves: ~150 lines. Risk: low. Order: after T6.

### T8. Dialog / Popover open-state conformance suite (lines, medium-high risk)
- dialog.test.tsx (3449 lines) and popover.test.tsx (2274) have the same section skeleton and
  near-identical rows: roles/ARIA token-merge, JS-free trigger, Enter/Space, foreign invoker,
  `rejection` (dialog.test.tsx:606-677 vs popover.test.tsx:646-729, line for line except
  `showModal`/`showPopover` and `requestClose`/`hidePopover`), refused close / veto, overlap,
  suspending content + keepMounted, function props, render element + forwards refs, post-await
  rule, platform path (pre-hydration open, StrictMode once), Close part re-entry (dialog D1-D6 vs
  popover P1-P4), "disabled on link and component renders (#83)" (dialog.test.tsx:2815-3023 vs
  popover.test.tsx:1549-1692), focus return / initialFocus, held content (design 4.4), mode guard
  and dev warnings. The automated scan found **22** cross-file near-duplicate pairs (second only to
  T3). Browser files mirror it again (dialog.browser vs popover.browser: "Escape closes with reason
  'dismiss'; focus returns to the Trigger", exit animation + deferred unmount, ViewTransition
  "pop" rows; menu.browser vs popover.browser has a 1.00-similarity VT row).
- Change: `describeOverlayOpenState(config)` with a driver `{ Harness, trigger(), popup(),
  isOpen(), spyShow(), spyHide(), dismiss(), nativeCloseValue? }`, used by both files; keep
  dialog-only rows (modal, returnValue, `method="dialog"` forms, closedby, nested confirm) and
  popover-only rows (anchoring, nested popovers, hint) local. Consider Menu and Combobox later:
  they share `use-popover-root/trigger/popup` but their tests overlap much less.
- Saves: 600-900 lines (jsdom), ~200 (browser).
- Risk: medium-high: the two components differ in subtle ways the rows pin (a dismissal is
  notified after the platform closed it; dialog close returns a value; dialog JS-free mode uses
  `request-close`). Do it last among the suites, one section at a time.
- Order: after T2, T3.

### T9. Fixed sleeps in browser tests (flakiness + time, medium value)
- Negative assertions with a fixed wait ("still closed / no second view transition after N ms"):
  tooltip.browser.test.tsx:152 (400 ms), :188/:202/:256/:279 (50 ms), menu.browser.test.tsx:471
  (300), :895/:898 (50), dialog.browser.test.tsx:864/890/943/976/1008, popover.browser.test.tsx
  :731/:816/:843, combobox.browser.test.tsx:734/:773 (50). These are inherent to "nothing happens"
  checks; keep them but name them (`await quietPeriod(ms, reason)`) so they are greppable, and
  make the duration relative to the delay under test (e.g. tooltip `closeDelay * 4`).
- Waits that stand in for an observable event and can be replaced:
  - "the enter fade" `sleep(250)` (dialog.browser.test.tsx:934/956/985,
    popover.browser.test.tsx:724/761) -> `await Promise.allSettled(popup().getAnimations().map(a =>
    a.finished))` (toast.browser.test.tsx:207 already does this, then still adds `sleep(30)`).
  - `sleep(350)` before checking a running progress bar (dialog.browser:662, popover.browser:583)
    -> poll `bar.playState === "running"` / `currentTime > 0`.
  - menu.browser.test.tsx:346 `sleep(600)` to expire the typeahead buffer -> this is a 500 ms
    library timeout; acceptable but it costs 600 ms x 3 engines; a polling loop on a second
    typeahead would not be clearer. Keep, comment the 500 ms source.
  - combobox.browser.test.tsx:719 `press()` = keyboard + `sleep(30)` -> `settle(check)`.
  - menu-context-trigger.browser long-press `sleep(600)` x6 (lines 700, 729, 1075, 1101, 1124,
    1174; 3.6 s per engine): needed to let the 500 ms timer fire inside `act`. Could become a
    poll inside `act` (`await act(() => expect.poll(isOpen).toBe(true))`, as `actPoll` in
    placement-browser.ts already does) and finish as soon as the menu opens (~500 ms), saving
    ~100 ms each; mostly a robustness gain under load (600 vs 500 is only a 100 ms margin).
  - every `flush()` = `sleep(20)`: the dialog file already migrated to `settle(check)` for issue
    #49; do the same in popover / menu / context-trigger / combobox / toast where the following
    assertion is positive.
- jsdom real-time waits (should be fake timers or a shim task flush):
  menu-context-trigger.test.tsx:1571 (150 ms, against a 100 ms submenu delay) and :1580 (200 ms),
  toast.test.tsx:2309 (80 ms). These are the only real-time waits in jsdom.
- Saves: ~2-4 s per engine (Firefox serial: all of it on the wall clock); fewer load flakes.
- Risk: low if each replacement polls for the same condition the sleep was guarding.

### T10. Stale comments / TODOs (tidiness, zero risk)
- accordion.test.tsx:3-12 "Browser-mode TODOs ... belong in a sibling accordion.browser.test.tsx":
  that file exists and covers Enter/Space on the summary (accordion.browser.test.tsx:41) and
  `<details name>` exclusivity (:71); ViewTransition is covered by
  internal/transition-boundary.browser.test.tsx:181 "Accordion expand". Rewrite the header to
  point there.
- accordion.test.tsx:260 "TODO(browser mode): assert that opening B closes A through the platform's
  `name` group" — done at accordion.browser.test.tsx:71. Delete.
- checkable-input-browser-suite.tsx:9 TODO (Firefox form-state restoration across reload needs
  E2E) is legitimate; leave it, or file a repo issue so it is tracked outside a comment.
- No `.skip` / `.todo` / `.only` anywhere. Engine gates use `runIf` / complementary
  `runIf`/`skipIf` pairs (tooltip.browser.test.tsx:311/338), which follows CLAUDE.md.

### T11. Duplicate engine-probe rows (tidiness, zero risk)
- "Chromium has native focusgroup; Firefox and WebKit do not" is asserted in
  tabs.browser.test.tsx:155 and toolbar.browser.test.tsx:303; select.browser.test.tsx:117 has its
  own "environment: the feature checks match the engine". The home for these is
  `__tests__/environment.browser.test.tsx`, which already pins other probes (#89, #92). Move them
  there (one row per probe in engine.ts).
- Saves: ~20 lines.

### T12. Within-file table-driven candidates (lines, low risk)
Within-file near duplicates are rare (scan at >= 0.82 similarity found 26 pairs in 16 files); the
worthwhile ones:
- menu.test.tsx:1297 vs :1499 "a rejection reaches the boundary" (0.99): CheckboxItem vs
  RadioGroup -> `it.each`.
- dialog.test.tsx:1212 vs :1589 (Close action rejects vs Form action throws, 0.93).
- popover.test.tsx:1877 vs :1899 (0.93), menu.browser.test.tsx:378 vs :394 (Escape vs ArrowLeft
  closes only the submenu, 0.96), dialog.browser.test.tsx:129 vs :146 (returnValue via Close vs
  form, 0.88), toast.test.tsx:528 vs :554 (throwing success vs error function, 0.90).
- dev-warning rows "warns once when value and defaultValue are both set" / "switching from
  uncontrolled to controlled" / "duplicate Item values" (checkbox-group.test.tsx:2643/2658/2672,
  radio-group.test.tsx:1844/1859, select) -> `it.each` of `[render, rerender, message]`; better,
  fold into T2's suite.
- superseded-rejection pairs (combobox.test.tsx:1231/1257, select.test.tsx:496/516,
  tabs.test.tsx:862/886, toggle-group.test.tsx:494/516) -> fold into T2.
- Saves: ~200 lines outside T2. Risk: low; keep the per-row assertions in the table.

### T13. Component tests vs internal hook tests (lines, low-medium risk)
- `internal/use-native-group-reconciliation.test.tsx` (563) duplicates most of what RadioGroup /
  CheckboxGroup / Select test (see T3); `internal/use-native-checked.test.tsx` (338) overlaps
  checkable-input-suite rows 20-24 (mount reconciliation and form reset of single inputs; e.g.
  "reports the hydrated DOM value once", "does not report when the reset matches").
  `use-action-trigger.test.tsx:101-130` superseded rejection rows were explicitly moved there
  from the Close / Item rows (#81), the right direction.
- Recommendation: keep hook tests for invariants the components cannot reach (warnings about the
  wrong element, `equals`, re-apply order, `onItemMounted` under StrictMode) and let the
  component suites own the user-visible rows. Do this only after T3 so every removed hook row has
  a component-suite row with an equal or stronger assertion.

### T14. Run jsdom without per-file isolation (speed, medium-high risk)
- Measured in the scratch copy: `--no-isolate` (with T1) runs the jsdom project in 12.2-13.4 s
  (vs 25 s today; vs 18.7 s with no-isolate alone).
- Blockers:
  1. The three `vi.mock("react")` files (`tabs/tabs-transition-types.test.tsx`,
     `toggle-group/toggle-group-transition-types.test.tsx`,
     `checkbox-group/checkbox-group-transition-types.test.tsx`) fail or pass depending on which
     files the worker loaded first (9 failures in one run, 0 in the next). Put them in a separate
     small `jsdom-mocked` project with `isolate: true` (or merge them into one file there).
  2. One order-dependent test (T15).
  3. Module state shared across files once isolation is off: the toast manager, tooltip warm
     state (`internal/tooltip-warm.ts`), modal registry, the React-hoisted `<style>` resources
     left in `document.head`, the popover / dialog shims' module state. Shuffled no-isolate runs
     (seeds 1-3) showed only T15, but a leak could make a later test pass for the wrong reason.
- Recommendation: do it last, after T15 is fixed, with 10 shuffled runs green and a per-test
  `document.head` / top-layer reset in vitest.setup.ts. Coverage itself does not drop, so the
  risk is false passes, not missing rows.

### T15. Order-dependent test (correctness, fix first)
- `menu/menu-context-trigger.test.tsx:1299` "one hoisted `<style>` after the first point open; a
  second Root adds none" fails under `--sequence.shuffle` (seeds 1 and 2, isolated runs too): it
  assumes no earlier test in the file hoisted the `@funstack/ui/menu-point` `<style>` into
  `document.head` (React keeps hoisted resources after unmount). Today it passes only because of
  declaration order. Fix: assert the count relative to before the open, or remove leftover
  `style[data-precedence="fsui"]` in a `beforeEach` of that describe.
- Recommend adding a periodic `--sequence.shuffle` run (e.g. a CI matrix entry or a documented
  local check) to catch more of these.

### T16. Organisation and naming (tidiness, zero-low risk)
- Sections named after review history instead of behaviour: dialog.test.tsx:1778 "review of #46
  (memo/reviewer/dialog-46.md)", :3025 "review fixes", dialog.browser.test.tsx:440 "review rows
  (browser)"; 64 test titles carry review ids (M1, L4, H1, P2, D3...) and 19 carry issue / wave
  numbers. Move each row into the behaviour section it tests (Close part, focus, nested dialogs,
  forms) and keep the review id as a trailing comment; a reader looking for "Escape during a Form
  save" should not need to know it came from review L2.
- Missing top-level component `describe`: slider.test.tsx, number-field.test.tsx, meter.test.tsx,
  progress.test.tsx (and their browser files) start with `describe("roles and ARIA")`, so reports
  show ambiguous names ("roles and ARIA renders the section 1 attributes" exists for both meter and
  progress). Wrap them in `describe("Slider")` etc. Zero risk.
- Very long titles: 38 > 100 characters, 2 > 130 (dialog.test.tsx and popover.test.tsx mostly).
  Shorten while moving rows in T8; not worth a pass of its own.
- dialog.test.tsx (3449) should be split once T8 has removed the shared rows: core / Close part
  and part-initiated closes / disabled renders / focus. Not for speed (see section 0), only for
  navigation.
- `controlModes` (helpers.tsx:131) is exported but only used inside helpers.tsx; un-export it or
  use it from the new suites.

### T17. vitest `typecheck` setting is a no-op (config, zero risk)
- `vitest.config.ts` jsdom project sets `typecheck: { enabled: true }`, but there are no
  `*.test-d.ts(x)` files (vitest's default `typecheck.include`), so it type-checks nothing. The
  `*.types.test.tsx` files (accordion, number-field, progress, slider) say "pnpm typecheck and
  vitest's typecheck make these fail"; in fact only `pnpm typecheck` (tsc over `src`) does.
  Either remove the option and fix the comments, or set `typecheck.include` to
  `src/**/*.types.test.tsx` deliberately. Saves ~1 s and a misleading comment.

### T18. Browser-vs-jsdom placement
- No browser row was found that jsdom could equally observe: the browser rows that look like
  jsdom duplicates (accordion platform path, dialog returnValue, checkbox-group reset) are the
  oracle for the jsdom shims and should stay.
- The reverse (jsdom rows that only test shim behaviour): `popover.test.tsx:1766-1822` "focus on
  open (the platform's focusing steps, emulated by the shim)" and `popover.test.tsx:2259` "invoker
  shim" test the shim more than the component; they are cheap and guard the shim against
  drifting from popover.browser.test.tsx:271 "platform probe", so keep them, but group them in a
  `describe("jsdom shim fidelity")` so nobody mistakes them for component coverage.

### T19. Transition-type coverage gap (observation, not a refactor)
- Only Tabs, ToggleGroup and CheckboxGroup assert the `fsui-*` types they add (the three
  `vi.mock("react")` files); Switch/Checkbox check only that a type map renders like a string
  (checkable-input-suite.tsx:836-845), and Accordion / Toggle / RadioGroup / Select assert no
  type at all in jsdom. If T14 moves the mocked files into their own project, extend that project
  with one file covering every component's types (`for each component: [gesture, expected
  types]`). Record as an issue rather than mixing it into the behaviour-preserving wave.

### T20. Guard rail for the whole wave
- Before starting: save `pnpm --filter @funstack/ui exec vitest list --project jsdom` and the
  browser list (Chromium) to a file. After each step, diff: every title that disappears must be
  listed with the suite row that replaces it in the commit message. Test count may go up
  (suites generate rows per mode); it must not go down unexplained.
- Count `expect(` per removed row vs replacement row during review of T2/T3/T8.

## 2. Suggested sequence

1. T15 (fix the order-dependent row) and T10 / T11 / T16-describe-wrap / T17 (zero-risk cleanups).
2. T1 (`delay: null`), verified with 5 runs + 2 shuffled runs. -> jsdom ~20 s.
3. T5 (`restoreMocks`), T4 (jsdom helpers incl. `hydrateFromServer`, `silenceErrors`,
   `sequencedDeferreds`), T6 (browser helpers). Mechanical, file by file.
4. T9 (replace stand-in sleeps; name the quiet periods; fake timers for the three jsdom waits).
5. T2 value-action suite, one component per commit (Toggle first: smallest and closest to the
   checkable suite; then Tabs, ToggleGroup, Accordion, RadioGroup, CheckboxGroup, Select).
6. T3 native-group platform suite, then T13 trimming of the hook tests.
7. T7 browser VT mount row; T12 leftovers.
8. T8 Dialog / Popover overlay suite, then split dialog.test.tsx and regroup the review sections
   (T16).
9. T14 no-isolate (separate project for the `vi.mock` files), after 10 green shuffled runs.
   -> jsdom ~12-13 s.

Estimated total: 3500-5000 test lines removed (of ~57k), jsdom wall 25 s -> ~20 s after step 2
and ~12-13 s after step 9, browser 2-4 s less per engine after step 4.

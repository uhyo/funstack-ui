# Test safety audit for the refactoring wave (#157)

Reviewer audit, 2026-11-24, of `packages/ui/src` at 93b9dcb. Read-only: no source or test file was
changed. Mutations ran in a scratch `git worktree` (node_modules symlinked to the main checkout),
each applied alone, run against the suite, then reverted; the worktree was removed afterwards.
Duplication mapping is the architect's (memo/architect/refactor-audit.md); this file only says
where the tests would catch a behaviour change.

## 0. Method and limits

- **Coverage (step 1): skipped.** `@vitest/coverage-v8` is not installed (no `@vitest/coverage-*`
  in either `node_modules`), and adding it was out of scope. Mutation results stand in for it.
- **Baseline:** jsdom + jsdom-isolated, 71 files, 3597 tests, all pass in ~20 s (after a `tsdown`
  build in the worktree, which `directives.test.ts` needs: without `dist` it fails 200 rows, so a
  mutation harness that does not build first reports everything as killed).
- **Mutations:** 134, over 17 files. Each ran against the **whole** jsdom suite (not just the
  file's own tests), so "survived" means no jsdom test anywhere noticed. The 16 jsdom survivors
  that plausibly matter in a real engine were then re-run against the related browser files in
  Chromium; the five killed there were re-run in Firefox. WebKit is not runnable on this machine
  (Playwright's WebKit build has no `DEPENDENCIES_VALIDATED`), so WebKit is CI-only.
- "Killed by N" = number of failing test rows. **N = 1 means a single test guards the rule**:
  safe today, fragile if a refactor also rewrites or merges that test.

## 1. Rating table

| Area | Mutations | jsdom killed | + browser | Rating | Survivors that matter |
| --- | --- | --- | --- | --- | --- |
| `use-controllable-action.ts` | 12 | 10 | - | **strong** | UCA6, UCA12: unreachable through today's callers (see 2.1) |
| `use-action-trigger.ts` | 8 | 7 | 0 (Cr) | **strong** | UAT6 (three overlapping runs) |
| `report-dropped.ts` | 3 | 3 | - | **strong** | - |
| `call-urgent-handler.ts` | 4 | 3 | - | **strong** | CUH3 (function thenable; exotic) |
| `use-overlay-root.ts` | 11 | 10 | 0 (Cr) | **adequate** | UOR8 (facts skip `onDispatch`) |
| `use-popover-popup.ts` | 14 | 11 | +1 Cr only | **adequate** | UPP2 (refused re-open + quiet focus), UPP6 (sync focus return); UPP14 caught in Chromium only |
| `use-overlay-close.ts` | 6 | 6 | - | **strong** | - |
| `css-transition-cut.ts` | 8 | 4 | +2 Cr only | **thin** | CTC3 (longhand restore), CTC1 (nested cut); CTC6/CTC7 Chromium only |
| `use-native-group-reconciliation.ts` | 9 | 8 | 0 (Cr) | **strong** (one gap) | NGR9 (second wave of late members) |
| `use-roving-focus.ts` | 12 | 11 | 0 (Cr) | **adequate** | RF6 (observer attribute records); 7 of 11 kills by one test |
| `use-render.tsx` + `merge-props.ts` + `render-element.ts` | 12 | 12 | - | **strong** | - |
| `dialog/dialog-popup.tsx` | 14 | 14 | - | **strong** (fragile) | none, but 8 of 14 kills by one test |
| `overlay-popup.tsx` (close hold, focus return, content) | 7 | 5 | +1 Cr+Ff | **adequate** | OP5 (near-equivalent), OP7 caught in browser only |
| `use-native-checked.ts` | 5 | 4 | 0 (Cr) | **adequate** | NC3 (equal reset restores `checked`) |
| `use-popover-trigger.ts` | 5 | 4 | +1 Cr+Ff | **adequate** | PT4 caught in browser only |
| `use-field-control.ts` (`useFieldValueChange`) | 4 | 3 | 0 (Cr) | **thin** for `useFieldValueChange` | FC3 |

Totals: 134 mutations; 115 killed in jsdom; of the 19 jsdom survivors, 5 killed in Chromium
(2 of those also in Firefox), 14 survive everywhere checked (3 of them unreachable or equivalent).

## 2. Per area: survivors and missing tests

Mutation ids refer to the list in section 4.

### 2.1 use-controllable-action (strong)

Kills are broad (5 to 32 rows each) except UCA7 (adoptFact makes `next` the in-flight intent:
one unit row). Survivors:

- **UCA6** `adoptFact` keeps the burst. Only `useOverlayRoot` calls `adoptFact`, and it passes no
  `reducer`, so the burst is always empty there. Unreachable today; becomes live the moment a
  refactor lets a reducer-mode component (Accordion, CheckboxGroup) adopt a fact.
- **UCA12** `adopt` writes internal state while controlled. Its one caller
  (`use-native-select-value.ts`, adopt mode) only runs uncontrolled. Unreachable today.

Missing tests (hook level, `use-controllable-action.test.tsx`), needed only if the refactor
widens who calls these:
1. reducer mode, uncontrolled: dispatch A in flight, `adoptFact(x)`, A resolves: committed is `x`,
   A is not replayed.
2. controlled: `adopt(x)` changes nothing (committed still the prop).

### 2.2 use-action-trigger (strong)

- **UAT6** (a new run does not clear the previous latest run's resolved continuation) survives jsdom
  and Chromium. Needs three overlapping runs: C (slow) in flight, A resolves while C is pending
  (A's `then` waits), B starts and rejects, C settles: `then` must **not** run. Add to
  `use-action-trigger.test.tsx`.
- UAT7 (continuation at the first settle instead of the last) is caught by a single row.

### 2.3 report-dropped, call-urgent-handler (strong)

- CUH3 (a function with a `then` is not treated as a thenable): add one row to
  `call-urgent-handler.test.ts` if anyone touches `isThenable`. Low priority.

### 2.4 use-overlay-root (adequate)

- **UOR8** facts no longer call `onDispatch`. Survives jsdom and Chromium. Menu's `onDispatch`
  cancels hover-intent timers and resets the open cause (`menu-root.tsx:184`). Missing test:
  submenu hover-open timer pending, the root is dismissed (Escape / `hidePopover()` fact), advance
  timers: the submenu does not open. Also: a fact resets `nextCause` (a cause recorded before a
  dismissal does not leak into the next open).
- UOR9 / PT1 (#115 hidden-before-toggle) and UOR6 (`unlessRecorded`) are guarded by one popover row
  each (plus its controlled twin). Menu and Combobox share the code but have no row of their own.

### 2.5 use-popover-popup (adequate)

Survivors in jsdom and Chromium:
- **UPP2** a refused re-open resolves initial focus again. Masked for normal targets by the `inert`
  window, but Menu's **quiet** target (pointer open, `focus({ focusVisible: false })` after the
  show, outside the inert window) would move focus on a refused re-open. Missing browser row
  (Chromium + Firefox, `supportsFocusVisibleOption`): controlled Menu opened with the pointer,
  parent refuses an Escape dismissal: focus stays where the dismissal put it (#155 for the pointer
  path).
- **UPP6** no synchronous focus return after the library's own hide; the `toggle` task returns it
  a task later, so only the in-between state differs. Missing test: library close with
  `transition` whose commit unmounts the focused content: focus is on the Trigger in the same
  act, before the `toggle` task runs (fake timers, assert before advancing).

Caught only in a browser:
- **UPP14** no `exit.afterClose` at the close `toggle`: killed by 5 rows in **Chromium only**
  (Firefox finds no exit animations at close, see CloseHold). jsdom's `getAnimations()` is `[]`.
  Refactoring the close-hold path relies on Chromium locally and WebKit on CI.

Single-row guards: UPP7 (reshow keeps the generation: one ContextTrigger row), UPP10 (detach clears
`shown`), UPP13 (no focus to a Trigger inside a hidden popover). All in one component's file
only; a merge of popover/menu/combobox tests must keep them.

Coverage hole by component: `overlay-open-state-suite` runs for Dialog, Menu and Popover in
jsdom, **not Combobox**; Combobox gets the shared overlay suite only in the browser project.

### 2.6 use-overlay-close (strong)

All six killed (3 to 58 rows).

### 2.7 css-transition-cut (thin)

jsdom kills only the four rules its unit test names (CTC2, CTC4, CTC5, CTC8; one row each).
- **CTC3** longhands not restored: survives jsdom and Chromium. Missing jsdom row: inline
  `transition-duration: 300ms` only (no shorthand), cut, call: the longhand is back with its
  priority.
- **CTC1** nested cut not detected: survives everywhere; nearly equivalent (inner and outer
  restore in turn). A row for Menu's reshow under a view transition would pin "one cut", if the
  architect plans to change nesting.
- **CTC6** (no forced style recalc) and **CTC7** (`cutting` never cleared) are caught by 7 rows
  in **Chromium only** (Dialog / Combobox ViewTransition + CSS transition rows); Firefox passes
  with either mutation. jsdom cannot see either. CTC7 could have a jsdom row: two cuts on the same
  element in sequence both cut.

### 2.8 use-native-group-reconciliation (strong, one gap)

- **NGR9** the late-queue flag is never cleared: a **second** batch of late members (a second
  Suspense boundary resolving in a later commit) is never reconciled. Survives jsdom and Chromium.
  Missing row in `native-group-platform-suite.tsx`: two late boundaries resolving in separate
  commits, each with a pre-hydration change: both dispatch.
- NGR8 (reset reported as `"mount"`) is caught by one unit row only.

### 2.9 use-roving-focus (adequate)

- **RF6** the MutationObserver ignores attribute records: survives jsdom and Chromium. The
  existing "re-applies on observer records" row is driven by child-list changes. Missing row: an
  item's `disabled` (or `hidden`, `inert`, `aria-disabled`) attribute flips with **no** re-render
  of the container (set it on the DOM node directly): the Tab stop moves.
- 7 of 11 kills come from exactly one row (RF2 memory, RF3 popover exclusion, RF4 tabindex
  restore, RF8 radio Tab, RF9 Alt modifier, RF11 stale `0`). Toolbar and standalone ToggleGroup
  exercise different halves (memory vs not): keep both files' rows through any consolidation.

### 2.10 use-render / merge-props / render-element (strong)

All 12 killed; most by 5 to 34 rows across components. MP4 (className order) and MP6 (callback
ref nulled on detach) rest on one unit row each.

### 2.11 dialog-popup (strong, fragile)

All 14 killed, but 8 by a single row (DP1, DP5, DP6, DP8, DP10, DP11, DP14 and DP2 by two
twins). Dialog's refused-re-open, awaiting-close, library-close echo and submit rules duplicate
use-popover-popup's, and each side is pinned by its own component's rows; a shared
implementation must keep both sets.

Browser-only Dialog behaviour not mutated here but CI-dependent: real light dismiss and Escape
(close watcher), `closedby` (Chromium, Firefox; Safari 27.0 lacks it, so the JS baseline runs),
platform focus return.

### 2.12 overlay-popup (adequate)

- **OP7** `returnFocusToTrigger` no longer leaves focus that already moved outside: killed only in
  the browser (2 ContextTrigger rows, Chromium and Firefox). Missing jsdom row: focus moved to an
  outside element before the close `toggle`: the Trigger does not take it.
- OP5 (library echo with `transition` still computes the hold): survives; near-equivalent while
  the cut removes the CSS transition.
- OP3 and OP4 rest on one row each (OP4: one Menu submenu row).

### 2.13 use-native-checked (adequate)

- **NC3** a form reset whose target equals the intent no longer restores `checked`: survives jsdom
  and Chromium. Missing row (checkable-input-suite): controlled `checked` with a pending dispatch
  (or `defaultChecked` equal to the value) where the reset algorithm leaves the DOM different
  from the intent: `checked` is written back, no dispatch.
- NC4 (re-apply order) is one unit row.

### 2.14 use-popover-trigger (adequate)

- **PT4** `beforeOpen` not called: killed only in the browser ("a pointer open focuses the first
  item without :focus-visible", Chromium and Firefox; one row). jsdom has no
  `focus({ focusVisible })`. A jsdom row could assert the recorded open cause instead.
- PT5 (late JS-free Trigger picks up `data-open`) is one row.

### 2.15 use-field-control / useFieldValueChange (thin for the value-change half)

- **FC3** the change detection is broken (notifies on every commit, or never once the first value
  is `undefined`): survives jsdom and Chromium. Missing rows: re-rendering a control in a Field
  with an unchanged value calls `validate` / the mirror zero times; a control whose first value is
  `undefined` (empty Combobox) still notifies on the first change.
- FC1 (error id in `aria-describedby`) is one row.

## 3. Behaviour that only browser tests cover

Local runs use Chromium and Firefox; **WebKit runs only on CI** here. Refactors touching these
paths need a CI run on all three before they can be called safe:

| Behaviour | Where | Local net |
| --- | --- | --- |
| Exit animation and deferred unmount (`useCloseHold`, `afterClose`) | overlay-browser-suite | Chromium only (Firefox finds no animation at close); UPP14 proves jsdom is blind |
| CSS transition cut under a view transition (forced recalc, `cutting` bookkeeping) | dialog / combobox ViewTransition rows, css-transition-cut.browser | Chromium only (CTC6, CTC7) |
| ViewTransition wiring in general (`transition-boundary`, `transition` props) | *.browser ViewTransition rows | Chromium + Firefox |
| Quiet focus on pointer open (`focus({ focusVisible: false })`) | menu.browser | Chromium + Firefox (PT4); WebKit 18.4+ per engine.ts, CI only |
| Focus return when focus left the popup (ContextTrigger) | menu-context-trigger.browser | Chromium + Firefox (OP7) |
| Light dismiss, Escape / close watcher, platform focus return | all overlay browser files; shims model none of it (popover-shim header) | Chromium + Firefox |
| `interestfor` (Tooltip, Popover lost-interest) | tooltip / popover browser | Chromium only, by platform |
| `popover="hint"` stacking | tooltip browser | WebKit (Safari 27.0 lacks it) CI only for the degraded branch |
| Anchor positioning, placement flips | placement-browser, tooltip, menu submenus | Chromium + Firefox; WebKit submenu anchoring rows CI only (cross-engine memo) |
| Native radio arrows, range keys (WebKit maps differently) | radio-group, slider, toolbar browser | WebKit branches CI only |
| Focus on mousedown (macOS WebKit does not) | tabs, toolbar, button browser | CI only for WebKit |
| Native `focusgroup`, customizable select, `closedby` | toolbar / toggle-group, select, dialog browser | Chromium (+ Firefox for `closedby`) |

The jsdom shims (popover-shim, dialog-shim, invoker-shim, interest-shim) are themselves a model of
the platform. A refactor that changes **when** the library calls `showPopover` / `hidePopover` /
`close` relative to `beforetoggle` / `toggle` is checked against the shim's model in jsdom and
against the platform only in the browser project.

## 4. Mutation list

`K(n)` killed by n jsdom rows; `S` survived jsdom; browser outcome in brackets.

use-controllable-action: UCA1 epoch filter off K(5); UCA2 latest guard off K(22); UCA3 rethrow
ignores `connected` K(2); UCA4 replay folds rejected K(16); UCA5 adoptFact no supersede K(12);
UCA6 adoptFact keeps burst S; UCA7 adoptFact not in-flight intent K(1); UCA8 rejected never
settles K(32); UCA9 `whole` through reducer K(7); UCA10 mode-switch warning off K(10); UCA11 no
transition types K(28); UCA12 adopt while controlled S.

use-action-trigger: UAT1 ignore off K(26); UAT2 rendered `pending` K(10); UAT3 superseded `then`
K(9); UAT4 generation guard off K(11); UAT5 rethrow ignores `connected` K(5); UAT6 continuation
not cleared S [Cr S]; UAT7 `then` at first settle K(1); UAT8 superseded rethrown K(21).

report-dropped: RD1 no `reportError` K(179); RD2 never disconnects K(7); RD3 swallows K(180).
call-urgent-handler: CUH1 sync throw escapes K(11); CUH2 rejection unreported K(10); CUH3
function thenable S; CUH4 console only K(20).

use-overlay-root: UOR1 `onOpenChange` alone not library K(2); UOR2 requestOpen no-op off K(12);
UOR3 requestClose no-op off K(2); UOR4 open does not advance generation K(15); UOR5 stale-intent
clear K(17); UOR6 `unlessRecorded` off K(2); UOR7 intended ignores in-flight K(7); UOR8 facts skip
`onDispatch` S [Cr S]; UOR9 `hiddenBeforeToggle` false K(1); UOR10 W1 off K(3); UOR11 fact not
adopted K(108).

use-popover-popup: UPP1 refused not inert K(2); UPP2 refused resolves focus S [Cr S]; UPP3 re-open
while awaiting close K(8); UPP4 library hide as fact K(20); UPP5 echo not consumed K(10); UPP6
no sync focus return S [Cr S]; UPP7 reshow bumps generation K(1); UPP8 foreign open not cancelled
K(13); UPP9 command at hidden popup K(2); UPP10 detach keeps `shown` K(1); UPP11 refusedFact
never reset K(2); UPP12 whileShown not stopped K(6); UPP13 focus to Trigger in hidden popover
K(1); UPP14 no `afterClose` S [Cr K(5), Ff S].

use-overlay-close: UOC1 default `run` K(10); UOC2 disabled acts K(8); UOC3 click not cancelled
K(58); UOC4 no aria-disabled while pending K(6); UOC5 no generation K(9); UOC6 `commandfor` on
non-button K(3).

css-transition-cut: CTC1 nested not detected S [Cr S]; CTC2 priority lost K(1); CTC3 longhands
not restored S [Cr S]; CTC4 empty style attr left K(1); CTC5 listener's transition overwritten
K(1); CTC6 no forced recalc S [Cr K(7), Ff S]; CTC7 `cutting` not cleared S [Cr K(7), Ff S]; CTC8
cut without VT K(2).

use-native-group-reconciliation: NGR1 Root-commit members queue late K(6); NGR2 late never K(15);
NGR3 `dispatchEqualReset` off K(3); NGR4 dispatch when equal K(249); NGR5 `equals` ignored
K(106); NGR6 no `onResetEvent` K(6); NGR7 mount reads defaults K(63); NGR8 reset as mount K(1);
NGR9 late flag never cleared S [Cr S].

use-roving-focus: RF1 loop ignored K(3); RF2 memory ignored K(1); RF3 popover content items K(1);
RF4 no tabindex restore K(1); RF5 RTL ignored K(2); RF6 observer ignores attributes S [Cr S]; RF7
representative ignores checked K(6); RF8 radio Tab rule off K(1); RF9 Alt navigates K(1); RF10
consumer `-1` items K(4); RF11 stale `0` kept K(1); RF12 disabled items K(10).

use-render / merge-props / render-element: UR1 ref not memoised K(15); UR2 element ref dropped
K(8); UR3 consumer ref dropped K(34); MP1 owned `undefined` kept K(29); MP2 handler order K(5);
MP3 id-ref lists overridden K(13); MP4 className order K(1); MP5 style precedence K(5); MP6
callback ref not nulled K(1); RE1 component render loses `type` K(9); RE2 disabled stays invoker
K(18); RE3 `handlesClick` ignored K(2).

dialog-popup: DP1 refused non-modal not inert K(1); DP2 re-open while awaiting close K(2); DP3
library close as fact K(6); DP4 returnValue dropped K(29); DP5 no focus return after unmount
K(1); DP6 `stopPropagation` opt-out ignored K(1); DP7 prevented submit closes K(2); DP8 Escape
taken from inner layer K(1); DP9 non-modal dismiss without press K(2); DP10 backdrop without
press K(1); DP11 native open no generation K(1); DP12 fact returnValue dropped K(5); DP13 no
non-modal Escape K(3); DP14 modal refused treated as refused K(1).

overlay-popup: OP1 keepMounted ignored K(14); OP2 hold with transition K(5); OP3 `canFocus`
ignored K(1); OP4 release ignores awaitingClose K(1); OP5 echo with transition holds S [Cr S];
OP6 Toolbar context leaks K(3); OP7 focus stolen from outside S [Cr K(2), Ff K(2)].

use-native-checked: NC1 no mount reconciliation K(15); NC2 `checked` written in mount commit
K(24); NC3 equal reset no restore S [Cr S]; NC4 re-apply order K(1); NC5 cancelled click
dispatches K(9).

use-popover-trigger: PT1 #115 branch off K(1); PT2 disabled toggles K(5); PT3 aria-expanded from
optimistic K(22); PT4 no `beforeOpen` S [Cr K(1), Ff K(1)]; PT5 late JS-free Trigger K(1).

use-field-control: FC1 error not described K(1); FC2 no aria-labelledby K(4); FC3 change
detection broken S [Cr S]; FC4 edit never dismisses K(3).

## 5. Before refactoring, add (priority order)

1. css-transition-cut: jsdom rows for longhand-only restore (CTC3) and two sequential cuts (CTC7).
2. use-roving-focus: attribute flip without a container render moves the stop (RF6).
3. use-overlay-root / Menu: a fact cancels hover timers and the recorded open cause (UOR8).
4. use-popover-popup: refused re-open of a pointer-opened Menu keeps focus (UPP2, browser);
   synchronous focus return after a library close with `transition` (UPP6).
5. use-native-group-reconciliation: two late member batches (NGR9).
6. use-native-checked: equal-target reset writes `checked` back (NC3).
7. useFieldValueChange: no notification for an unchanged value; first change from `undefined`
   (FC3).
8. use-action-trigger: three overlapping runs, latest rejects (UAT6).
9. overlay-popup: jsdom row for "focus already outside is left alone" (OP7); Combobox in the
   jsdom `overlay-open-state-suite`.
10. Only if the refactor widens their callers: adoptFact with a reducer, adopt while controlled
   (UCA6, UCA12).

Any change to the close-hold or the cut must also be run in Chromium locally (Firefox does not
see either) and on WebKit through CI.

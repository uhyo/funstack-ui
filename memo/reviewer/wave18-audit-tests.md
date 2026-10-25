# Wave 18 test audit (tidy-up)

Reviewer audit, 2026-10-25, of `packages/ui/src` tests at 6d70a91 (after alpha.14). Read-only: no
tracked file changed. Timing experiments ran in a scratch copy of `packages/ui` (node_modules
symlinked). Follows `refactor-audit-tests.md` (T1-T20, wave 16), whose suites, helpers,
`delay: null`, `restoreMocks` in the setup file and jsdom no-isolate have landed.

Goal: tidier, faster, less duplicated; no coverage drop, no weakened assertion.

## 0. Numbers

### jsdom (`pnpm --filter @funstack/ui test:jsdom`, 16 cores)
- 3360 tests (2865 at wave 16). Wall 21.0 s (vitest "Duration" 18.4-19.5 s), user CPU 3m53s.
  Breakdown: tests ~50 %, environment ~43 %.
- 8 failures in that run, all `__tests__/directives.test.ts` "built files": `dist/` predates the
  source (built 2026-10-24 13:33; `menu-outside.mjs`, `toast-queue.mjs` … missing). The filter
  command skips turbo's `build` dependency; root `pnpm test:jsdom` builds first. Not a test defect.
- Slowest files (wall inside the full run; inflated about 3x by contention): combobox 14.2 s
  (158 tests), popover 13.8 s (240), checkbox-group 13.5 s (168), menu 13.5 s (195), radio-group
  8.9 s, tabs 8.3 s, menu-context-trigger 7.7 s, toggle-group 7.3 s, select 7.3 s, dialog 6.8 s,
  number-field 6.6 s. Run alone: combobox 3.7 s of tests (5.8 s wall), popover 3.7 s (5.6 s wall).
- Slowest tests: each file's first row (module warm-up, 400-960 ms: production-bundle 985,
  checkbox-group conformance 957, menu suite 874 …). 13 tests > 500 ms, 49 > 200 ms, none > 1 s.
  No real-time wait is left in any jsdom file (wave 16 T9 done).
- `--maxWorkers` 4 / 6 / 8 / 12 / default: 20.6 / 19.9 / 17.8-18.8 / 18.5 / 19.5 s wall. Within
  noise; fewer workers only save CPU. Not worth changing.

### Browser, Chromium (`FUNSTACK_BROWSERS=chromium … --project browser`)
- 521 tests: 515 pass, 6 engine-gated skips. Wall 26.0 s; test phase 19.8 s = the dialog file.
- Slowest files: dialog 19.8 s (58 tests), popover 18.5 s (65), combobox 16.5 s (57), tooltip
  16.0 s (40), menu 14.1 s (56), menu-context-trigger 11.5 s (40), number-field 5.1 s, toolbar
  3.6 s, button 3.5 s. The other 20 files are 1-2.7 s each.
- Shared overlay browser suite rows: dialog 12.7 s of 19.8, popover 8.6 of 18.5, menu 7.4 of 14.1.
- Slowest tests: touch offset 1.28 s, the two tooltip skip-delay rows 1.20 s each, tooltip "stays
  open while the pointer moves into the popup" 1.06 s; 4 > 1 s, 78 > 500 ms, 247 > 200 ms.
- Fixed waits still in browser files (ms written as literals; plus 104 bare `flushFor()` = 20 ms
  each): menu-context-trigger 3720 ms / 45 calls (seven `sleep(600)` long-press holds), combobox
  2420 / 41, popover 2200 / 32, menu 1220 / 28, tooltip 800 / 14, overlay-browser-suite 690 / 14,
  dialog 470 / 22.

## 1. Findings, ranked by value / risk

Format: id, where, what, change, lines saved, coverage risk, effort.

### T1. Move per-file top-layer / DOM / act / mouse teardown into the setup files
- Where:
  - jsdom: the same `afterEach` (restore mocks, hide every open `[popover]`, `body.innerHTML = ""`)
    in menu/menu.test.tsx:140-149, menu/menu-context-trigger.test.tsx:208-217,
    popover/popover.test.tsx:118-126, combobox/combobox.test.tsx:221-230, toast/toast.test.tsx:116-126,
    and the restore + body clear in dialog/dialog.test.tsx:65-69, dialog-close.test.tsx:33-37,
    dialog-form.test.tsx:27-31, dialog-disabled.test.tsx:14-18.
  - browser: `closeOpenTopLayer(); runCleanups();` afterEach in 8 files (dialog:59, menu:73,
    menu-context-trigger:75, popover:70, combobox:140, select:70, toast:69,
    transition-boundary:45); `mouse.releaseHeld()` in 19 afterEach hooks; `let restoreAct` +
    `restoreAct?.()` afterEach in 15 places (combobox 8 uses, popover 4, menu 3, dialog 3, suite 2).
- Change: in vitest.setup.ts, after `vi.restoreAllMocks()` and before `cleanup()`, call
  `closeOpenTopLayer()` (move it from browser-helpers.ts to a DOM-neutral module); for jsdom only
  (`navigator.userAgent.includes("jsdom")`) clear `document.body` after `cleanup()`. Add a
  browser-only setup file (second entry in the browser project's `setupFiles`) whose afterEach
  awaits `mouse.releaseHeld()`. Make `leaveActEnvironment()` register its restore with
  `onCleanup` so callers drop the `let restoreAct` bookkeeping (keep the return value for rows
  that restore mid-test).
- Why beyond lines: with `isolate: false`, an element or open popover one jsdom file leaves
  behind is seen by the next file of the worker; today only the 9 files above clear it.
- Saves ~150 lines. Risk: low. Order: setup hooks run after the file hooks (stack order), so a
  file hook that must run on a still-open popup keeps working; a file that relied on the body
  surviving into the next test would break (none found; run the jsdom project with
  `--sequence.shuffle` twice). Effort: M.

### T2. Shared two-channel commit suite for Slider and NumberField
- Where: same skeleton, same harness (`Fixture` with `mode` = uncontrolled / commit / adopt,
  `boundary`, `retry`, `below`, `<output data-testid="parent">`; identical `eachMode` at
  slider.test.tsx:217 and number-field.test.tsx:190) and same rows: async commit
  (slider 677-696 / number-field 1091-1108), rejection x3 (698-763 / 1110-1172, assertions line for
  line: boundary replaces the Root, uncontrolled reports a `"dismiss"` change with no event,
  retry shows the parent's value, caught error commits), rollback with the control mounted
  (765-808 / 1174-1227), no snap (810 / 1229), overlap (938 / 1285), superseded rejection across
  channels (1022 / 1356), suspending content (1080 / 1403), mount reconciliation (1678 / 1437),
  form reset + controlled specifics (1753-1930 / 1509-1627), post-await rule (1931 / 2052).
  Wave 16 T2 proposed generalising `renderBoth` for these two; not done.
- Change: `src/__tests__/commit-action-suite.tsx` with `describeCommitAction(driver)`; driver:
  `{ name, Fixture, gesture(n) (press / step / type+blur), expectShown(v), pendingParts(),
  initial, values, sourceKey ("thumb" | "source") }`. Keep component-only rows local (Slider
  pointer, geometry, keyboard normalisation; NumberField typing drafts, hold, wheel, hidden
  input mirror, "a draft open at the rollback stays open").
- Saves ~500 lines. Risk: medium (per-component DOM checks such as `--slider-value` and the hidden
  input must become driver assertions, not be dropped; diff `vitest list` and count `expect(`
  per migrated row). Effort: L.

### T3. Dialog.Close / Popover.Close action part: one shared section
- Where: dialog/dialog-close.test.tsx:41-400 vs popover/popover.test.tsx:1404-1685. Pairs: data-pending
  then close (41 / 1434), rejection inside the popup, popup stays (81 / 1478), rejection then
  reset runs again (D4 111 / P3 1509), re-entry in library mode (D1 151 / P1 1546), JS-free
  re-entry (D1 204 / P1 1602), two clicks in one task (D2 242 / P2 1583), render element's
  aria-disabled owned (D6 287 / P4 1629), stale close after dismiss + re-open (308 / 1457),
  disabled Close (379 / 1653). The bodies differ only in the native close (`close(value)` vs
  `hidePopover()`), the harness prop that places the Close, and `popup().open` vs `isOpen()`.
- Change: a "Close part with action" section in overlay-open-state-suite.tsx (or a sibling
  `overlay-close-part-suite.tsx`) with config `{ renderClose(props), spyNativeClose,
  nativeCloseArgs, openStatic }`; Dialog keeps returnValue, form and veto rows, Popover keeps
  its JS-free native-invoker rows.
- Saves ~250 lines; Dialog gains the mode-parametrised variants Popover already runs. Risk:
  medium-low (same shapes). Effort: M.

### T4. Held-content rows into the overlay open-state suite
- Where: dialog-close.test.tsx:876-1006 "held content (design 4.4)", popover.test.tsx:2226-2305
  "held content and transition smoke (design 4.4)", menu.test.tsx "transition (smoke)" (the two
  rows after the context-menu block). Same rows: without transition a part close keeps the
  children through the close commit; with transition they are gone in it; keepMounted Activity
  visible through the close commit, hidden after; renders with and without `transition`.
- Change: a `held content` describe in the suite (it already has `partClose`, `spyClose`,
  `keepMounted`). Saves ~120 lines. Risk: low. Effort: S-M.

### T5. Menu's Trigger-close rows through the suite: `partCloses` as a list
- Where: menu.test.tsx:2360-2420 "a Trigger click while open closes through the action (#110)"
  re-tests, for Menu's Trigger, what the suite's part-initiated close rows test for Popover's
  Trigger (Popover's `partClose` is the Trigger, Menu's is an item).
- Change: let `OverlayOpenStateConfig.partClose` be a list (the browser suite already has
  `partCloses`), give Menu `[item, Trigger]`, delete the local block. Menu's Trigger then also
  gets the veto, overlap and rejection-caught rows. Saves ~60 lines, coverage goes up; the suite
  grows by about 20 Menu rows (~1 s of jsdom CPU). Risk: low. Effort: S.

### T6. Shared real-press helpers for browser files
- Where: `centre()` / `center()` defined 6 times (menu.browser:1224, combobox.browser:948 and 1658,
  tooltip.browser:404, menu-context-trigger.browser:902, slider.browser:91) plus ~20 inline
  `Math.round(r.left + r.width / 2)` pairs; `pressOn` / `press` (down, `sleep(20)`, snapshot,
  up, `sleep(20)`) 5 times (dialog.browser:990, menu.browser:528, popover.browser:713,
  combobox.browser:1447, select.browser:631) and inline in popover.browser:1295 and :1350,
  tooltip.browser:421, overlay-browser-suite:468.
- Change: `centre(element, at?)` and `mouse.pressOn(target, { at?, atPress?: () => T }) ->
  Promise<T>` in browser-commands.ts, keeping the 20 ms waits as they are.
- Saves ~120 lines. Risk: very low. Effort: S.

### T7. One foreign-invoker press suite for Menu and Combobox (#126)
- Where: the two users of `listenInvokerPresses`:
  - browser: menu.browser.test.tsx:1197-1304 and combobox.browser.test.tsx:1618-1713 are the same
    rows (popovertarget and commandfor + toggle-popover: focus kept at the press, one `(false,
    'activate')` with the event naming the button, no re-open; a dragged-off press does nothing),
    written with different act styles (menu wraps `mouse` in `act`, combobox leaves the act
    environment).
  - jsdom: menu.test.tsx:2303-2358 and combobox.test.tsx:2302-2399 split the classifier matrix
    between them (Menu: custom command, another popover; Combobox: `<input type=button>`, submit
    in a form, unmount removes the listener), all of which `internal/invoker-press.test.ts`
    (152 lines) already pins at unit level.
- Change: browser: `describeForeignInvokerPressInBrowser({ render(withForeign), open,
  focusedWhileOpen, afterClose? })`. jsdom: keep per component one wiring row (guarded while
  shown, not while closed, focus kept) plus Combobox's end-to-end submit-in-form row and the
  unmount row; drop the classifier cases the unit test owns.
- Saves ~110 lines. Risk: low. Effort: M.

### T8. Direction / resolved-side placement helpers (browser)
- Where: 'the same inside a dir="rtl" container (Firefox: Mozilla 2019601, asserted)' in
  popover.browser:1152, tooltip.browser:737, menu.browser:855, combobox.browser:177, each with
  its own `if (anchorPositionHonoursParentDirection) … else expect(near(…)).toBe(false) x2`
  branch and the same Firefox comment; the scroller `scrollTo` + `placedOn` in
  popover.browser:1042-1121 and tooltip.browser:609-671 (popover hand-rolls `placedOn` instead of
  `placedSide`).
- Change: in placement-browser.ts, `expectInlineEdges(popup, anchor, pairs)` that asserts the
  meeting edges, or "meets neither" where `!anchorPositionHonoursParentDirection` (one comment
  for the Mozilla bug, one place to delete when it is fixed), and `scrollContainerTo(scroller,
  top)`; popover uses `placedSide`.
- Saves ~90 lines. Risk: very low. Effort: S.

### T9. Titles and describes carrying issue / review / wave ids (132 titles)
- Where: 132 `describe`/`it` titles with `#nnn`, `wave nn`, `review …` or a review row id
  (`D1`, `P3`, `T2`, `C5`, `F1`); most in popover.test (15), toast.test (13), popover.browser (10),
  combobox.test (8), menu.browser, dialog-close (7 each). Examples: combobox.test.tsx:2050
  "Trigger close (#112)", :2302 "… (#126)", :2401 "Input press (#123)";
  popover.browser.test.tsx:1004 "resolved side (wave 11, #20)", :1267/:1326 "(browser, #117)";
  dialog-close.test.tsx:151-287 "D1:" … "D6:"; checkbox.test.tsx:89-259 "(C1)" … "(C9)";
  toast.test.tsx:849-958 "T1:" … "T4:", :252/:1252/:2051/:2071 "(#63 L5)" etc.;
  toolbar.browser.test.tsx:104 and use-roving-focus.test.tsx:257 "(review finding n)".
- Change: name the behaviour, keep the id as a trailing comment on the `it` line or above the
  describe. Same pass: wrap each overlay browser file in `describe("<Component> (browser)")` and
  drop the per-describe "(browser)" suffixes; dialog.browser and popover.browser both report
  "JS-free mode (browser)", "library mode (browser)", "ViewTransition (browser)", and popover and
  tooltip both report "resolved side (wave 11, #20)". Also rename popover.test.tsx:624
  `describe("keyboard")`, which now holds the foreign-invoker #125 rows (652-833), and :2306
  "invoker shim", which tests the component (see T11).
- Saves 0 lines. Risk: none (titles only; keep `vitest list` counts equal). Effort: M (mechanical).

### T10. Shorter animations in the overlay browser suite (speed, measured)
- Where: overlay-browser-suite.tsx:299-300 (`.pop` view-transition keyframes 200 ms) and :402
  (#64 row's `fade` 300 ms enter + exit).
- Measured in the scratch copy, Chromium, dialog + popover + menu browser files, two runs: 60 ms
  keyframes and a 100 ms fade: 177/177 pass both runs; suite rows 11.3 -> 10.5 s (dialog),
  7.3 -> 6.4 s (popover), 6.7 -> 5.9 s (menu); about 0.8 s per file, 2.5 s per engine (Firefox runs
  files serially, so its wall gains all of it).
- Why safe: the VT rows inspect pseudo-elements at `ready`; the CSS exit fades that must still run
  at `ready` (`addExitStyle("fade", "200ms")`) are left alone; the #64 claim (the release waits for
  the CSS exit, not a 10 s bar) holds at 100 ms.
- Risk: low; run 3 engines x 3 before committing. Effort: S.

### T11. Popover "invoker shim" describe re-tests a covered row
- Where: popover.test.tsx:2306-2333. "dispatchCommand drives a foreign command event" duplicates
  :667 "a foreign hide-popover invoker records an 'activate' intent" (which runs in both modes
  through a real click); the second row (case-insensitive command name) tests the library's
  matching, not the shim.
- Change: delete the first row, move the second next to :667 under the foreign-invoker describe.
- Saves ~15 lines. Risk: none. Effort: S.

### T12. Small helper leftovers
- combobox.test.tsx:200 private `watchShow` (records `children`) next to the shared one in
  overlay-helpers.ts: add `children` to the shared record and import it.
- button.test.tsx:50-61 private `recordClicks` plus its own `cleanups` array and afterEach,
  duplicating `onCleanup` (cleanups.ts) and the shared `recordClicks`; the shared one could
  register its own `stop` with `onCleanup`, which also removes the five `try { … } finally {
  clicks.stop(); }` wrappers (dialog-close.test.tsx x2, popover.test.tsx x2, menu.test.tsx x1).
- Saves ~40 lines. Risk: none. Effort: S.

### T13. Within-file / cross-file table candidates (minor)
- radio-group.test.tsx:1227 vs checkbox-group.test.tsx:2087 "warns in development when the
  mounted element is not a fieldset / … input" (0.82 normalised similarity) and :1199 vs :2059
  "function form on Item receives (props, state)" (0.75): rows for native-group-platform-suite
  or a small `describeGroupItemRender`.
- menu.test.tsx:1277 vs :1506 "a rejection reaches the boundary" (CheckboxItem vs RadioGroup,
  wave 16 T12, still open): `it.each`.
- combobox.test.tsx:1199 / :1225 and slider.test.tsx:1025 / :1052 superseded-rejection pairs:
  `it.each`.
- Saves ~100 lines. Risk: low. Effort: S.

## 2. Not worth changing

- Splitting big jsdom files for speed: the run is CPU-bound (combobox 3.7 s alone, 14.2 s in the
  full run); more files only add environment setup. Split only for navigation, after T2-T5.
- Splitting big browser files: the dialog file is the Chromium critical path (19.8 s of a 19.8 s
  test phase); moving the suite rows to their own file would cut about 3 s of Chromium / WebKit
  wall and nothing in Firefox (serial). Revisit only if the browser job becomes a bottleneck.
- `--maxWorkers` tuning: measured, within noise.
- Combobox in the overlay open-state suite: its opens come from typing and the Input, not a
  Trigger; the driver would be bigger than the rows it removes.
- Per-component jsdom "resolved placement (wave 11)" rows (menu.test:1921, popover.test:2072,
  tooltip.test:1400): short wiring checks over `internal/use-resolved-placement.test.tsx`; each
  pins a different popup.
- Browser rows that look like jsdom duplicates (combobox.browser "typing while a save is pending",
  "Enter submits with the new value", "text typed before hydration", the announcements row):
  they verify engine scheduling, implicit submission order and real `ariaNotify`; they are the
  oracle for the jsdom rows.
- Dialog / Popover "real press on a foreign invoker" rows (dialog.browser:1030,
  popover.browser:1276) as a browser-suite entry: the invoker is inside and awaited for Dialog,
  outside and hidden at the click for Popover; a shared row would be two branches.
- menu-context-trigger.browser `sleep(600)` long-press holds (686, 715, 1050, 1077, 1100, 1150):
  polling would save about 0.1 s each, and :1063 ("held still for 600 ms") is the behaviour.
- The re-entry rows of Toast.Action (toast.test:849-958) and Menu.Item (menu.test:932-1114): same
  idea as T3 but different parts and outcomes; `use-action-trigger.test.tsx` holds the shared
  core.
- An automated near-duplicate scan (6- and 8-token shingles, raw and identifier-normalised) now
  finds only 10 cross-row pairs above 0.6, against 22+ for Dialog / Popover alone in wave 16:
  the remaining duplication is structural (same scenario, different API), which is why T2-T5
  and T7 need drivers rather than copy removal.

## 3. Suggested order

1. T9 titles, T11, T12 (zero risk, mechanical).
2. T1 setup-file teardown (then shuffle the jsdom project twice), T6, T8 browser helpers.
3. T10 animations (3 engines x 3 runs).
4. T5 (`partCloses` list), T4 held content, T3 Close part section.
5. T7 foreign-invoker press suite.
6. T2 Slider / NumberField commit suite, one component per commit, with `vitest list` diffs.

Estimate: ~1450 lines removed, jsdom unchanged (CPU-bound), browser ~2.5 s less per engine from
T10.

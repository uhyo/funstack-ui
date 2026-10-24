# Wave 16, test infrastructure phase 1 (#101, tracker #100)

Branch `wave16/test-infra`, audit `memo/reviewer/refactor-audit-tests.md`. Done: T15, T10, T11, T16
(describe wrap + `controlModes`), T17, T1, T5, T4, T6, T9. Not done here: T2/T3/T7/T8/T13/T14 (#106,
#107), T16's regrouping of the review-named dialog sections and the long titles (the audit puts them
with T8, step 8).

## T20 guard rail: test titles before / after

Lists taken with the JSON reporter (`vitest list` printed 1856 lines for 2865 tests, so it was not
used): jsdom project, and the browser project on Chromium + Firefox (WebKit cannot run on this
machine; CI runs it).

- jsdom: 2865 -> 2865 (2866 after the rebase onto master: #102 added production-bundle.test.ts).
  No title removed. Renamed by prefix only (T16 describe wrap, 333 titles):
  - `src/slider/slider.test.tsx > X` -> `> Slider X`
  - `src/number-field/number-field.test.tsx > X` -> `> NumberField X`
  - `src/meter/meter.test.tsx > X` -> `> Meter X`
  - `src/progress/progress.test.tsx > X` -> `> Progress X`
  After stripping those prefixes the before/after lists are identical.
- browser: 412 -> 411 per engine (824 -> 822 on two engines). Moved / merged (T11):
  - `tabs.browser > Tabs.List experimental_focusgroup > Chromium has native focusgroup; Firefox and
    WebKit do not` and `toolbar.browser > Toolbar: native focusgroup detection > (same title)`:
    true duplicates (identical body), merged into `environment.browser > browser test environment >
    Chromium has native focusgroup; Firefox and WebKit do not`.
  - `select.browser > Select (browser) > environment: the feature checks match the engine` ->
    `environment.browser > browser test environment > customizable select: the feature checks match
    the engine` (same body).
  - Prefix renames: `meter.browser > X` -> `> Meter (browser) X`, `progress.browser > X` ->
    `> Progress (browser) X`.
  Nothing else changed.

## Notes worth keeping

- Order-dependent rows found by `--sequence.shuffle` (fixed): the context-trigger `<style>` rows
  (React's per-document hoisted-resource record; rows now render into a document of their own, with
  `defaultView` lent), the quiet-focus spy recording the library's one-time `focusVisible` probe on a
  detached div, the close-on-scroll rows using timer-driven frames (now fake rAF), and Select rows
  asserting no console.error that hit React's once-per-file `<selectedcontent>` warning (beforeAll
  warm-up that fails when React stops warning).
- T5 deviates from the audit: not `restoreMocks: true` (restores before the next test, so the unmount
  would run on spies) but `vi.restoreAllMocks()` at the start of the setup file's afterEach, before
  `cleanup()`, i.e. where the per-file hooks had it. Six jsdom files keep their own call because their
  afterEach calls the real `hidePopover` after restoring.
- T9: polling for a long-press open inside `act` does not work (React queues the open in the act
  scope until it ends; tried, every row timed out). The 600 ms sleeps after the 500 ms timer are
  deterministic (same-thread timer order), so they stay with a comment.
- `hydrateFromServer` (listed under T3 and in the audit's step 3) and `sequencedDeferreds` (T2) were
  left for those phases.
